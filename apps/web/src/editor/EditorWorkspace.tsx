import clsx from 'clsx';
import { BookOpen } from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { replaceText, useYText, type DiagramSession } from '../collab/session';
import { Collapsible, Dialog, Button, Tabs } from '../components/ui';
import { useTheme } from '../lib/theme';
import { useLocalState } from '../lib/useLocalState';
import { docsUrlFor } from '../render/mermaid';
import { Preview, type PreviewApi, type PreviewHandle, type SharedView } from '../render/Preview';
import { useDiagramRender } from '../render/useDiagramRender';
import { Actions } from './Actions';
import { CodeEditor, type EditorTab } from './CodeEditor';
import { ErrorBar } from './ErrorBar';
import { Samples } from './Samples';
import { monaco as monacoApi, type monaco } from './monaco';
import { candidatesFromElement, locateInCode, type CodeRange } from '../render/locate';
import { toast } from 'sonner';

interface Props {
  session: DiagramSession;
  title: string;
  header: ReactNode;
  /** Optional right-hand panel (e.g. version history). */
  side?: ReactNode;
  /** Override what the preview shows (e.g. a version being previewed). */
  previewOverride?: { code: string; config: string } | null;
  confirmSampleReplace?: boolean;
  fullscreenHref?: string | (() => string);
  previewRef?: Ref<PreviewHandle>;
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;
  onPointer?: (p: { x: number; y: number } | null) => void;
  onUserView?: (view: SharedView, byUser: boolean) => void;
  overlay?: (api: PreviewApi) => ReactNode;
  editorOverlay?: ReactNode;
}

const mobileQuery = typeof window !== 'undefined' ? matchMedia('(max-width: 639px)') : null;
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      mobileQuery?.addEventListener('change', cb);
      return () => mobileQuery?.removeEventListener('change', cb);
    },
    () => !!mobileQuery?.matches,
  );
}

export function EditorWorkspace(props: Props) {
  const { session, title, header, side, previewOverride, confirmSampleReplace } = props;
  const { dark } = useTheme();
  const liveCode = useYText(session.code);
  const liveConfig = useYText(session.config);
  const code = previewOverride?.code ?? liveCode;
  const config = previewOverride?.config ?? liveConfig;
  const { result, error, pending } = useDiagramRender(
    code,
    config,
    dark,
    previewOverride ? 'preview' : 'live',
  );
  // Markers belong to the live code; a previewed version's error is shown in the bar only.
  const liveError = previewOverride ? null : error;

  const [tab, setTab] = useState<EditorTab>('code');
  const [rough, setRough] = useLocalState('tp-rough', false);
  const [grid, setGrid] = useLocalState('tp-grid', true);
  const [samplesOpen, setSamplesOpen] = useLocalState('tp-samples-open', false);
  const [actionsOpen, setActionsOpen] = useLocalState('tp-actions-open', true);
  const [mobileView, setMobileView] = useState<'edit' | 'view'>('edit');
  const [pendingSample, setPendingSample] = useState<{ code: string; title: string } | null>(null);
  const isMobile = useIsMobile();
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const mobileViewRef = useRef(mobileView);
  mobileViewRef.current = mobileView;

  // ---- click a diagram element → jump to its code ----
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const flashRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const propsOnEditorReady = props.onEditorReady;
  const onEditorReady = useCallback(
    (ed: monaco.editor.IStandaloneCodeEditor | null) => {
      editorRef.current = ed;
      propsOnEditorReady?.(ed);
    },
    [propsOnEditorReady],
  );
  const revealRange = useCallback((r: CodeRange) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model || model.getLanguageId() !== 'mermaid' || r.line > model.getLineCount())
      return;
    const range = new monacoApi.Range(r.line, r.startColumn, r.line, r.endColumn);
    ed.setSelection(range);
    ed.revealRangeInCenterIfOutsideViewport(range, monacoApi.editor.ScrollType.Smooth);
    flashRef.current?.clear();
    flashRef.current = ed.createDecorationsCollection([
      {
        range: new monacoApi.Range(r.line, 1, r.line, 1),
        options: { isWholeLine: true, className: 'tp-flash-line' },
      },
      { range, options: { inlineClassName: 'tp-flash-token' } },
    ]);
    const flash = flashRef.current;
    setTimeout(() => flash.clear(), 1800);
    ed.focus();
  }, []);
  const jumpToCode = useCallback(
    (target: Element, svg: SVGSVGElement) => {
      const range = locateInCode(session.code.toString(), candidatesFromElement(target, svg));
      if (!range) {
        toast.message('Couldn’t find that element in the code', { duration: 2000 });
        return;
      }
      const needsSwitch =
        tabRef.current !== 'code' || (isMobileRef.current && mobileViewRef.current !== 'edit');
      setTab('code');
      setMobileView('edit');
      // Let the editor swap models / become visible before revealing.
      if (needsSwitch) setTimeout(() => revealRange(range), 60);
      else revealRange(range);
    },
    [session, revealRange],
  );

  const innerPreviewRef = useRef<PreviewHandle>(null);
  const setPreviewRef = useCallback(
    (h: PreviewHandle | null) => {
      innerPreviewRef.current = h;
      const r = props.previewRef;
      if (typeof r === 'function') r(h);
      else if (r) (r as { current: PreviewHandle | null }).current = h;
    },
    [props.previewRef],
  );

  const loadSample = (sampleCode: string) => {
    const before = session.code.toString();
    replaceText(session.code, sampleCode, 'sample');
    toast.success('Sample loaded', {
      action: { label: 'Undo', onClick: () => replaceText(session.code, before, 'sample') },
    });
    setTab('code');
  };

  const layout = useDefaultLayout({
    id: side ? 'tp-layout-3' : 'tp-layout-2',
    storage: localStorage,
  });

  const codeMarker =
    liveError?.source === 'code' && liveError.line
      ? { line: liveError.line, message: liveError.message }
      : null;
  const configMarker =
    liveError?.source === 'config' && liveError.line
      ? { line: liveError.line, message: liveError.message }
      : null;

  const editorPane = (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'code', label: 'Code' },
            { value: 'config', label: 'Config' },
          ]}
        />
        <div className="flex items-center gap-2">
          {session.readOnly && <span className="text-xs text-muted">Read-only</span>}
          <a
            href={docsUrlFor(result?.diagramType)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
          >
            <BookOpen size={13} /> Docs
          </a>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <CodeEditor
          session={session}
          tab={tab}
          dark={dark}
          codeMarker={codeMarker}
          configMarker={configMarker}
          onReady={onEditorReady}
        />
        {props.editorOverlay}
      </div>
      <ErrorBar
        error={
          previewOverride
            ? error
              ? { ...error, message: `This version has an error:\n${error.message}` }
              : null
            : liveError
        }
      />
      <div className="max-h-[45%] shrink-0 overflow-auto">
        {!session.readOnly && (
          <Collapsible
            title="Sample diagrams"
            open={samplesOpen}
            onToggle={() => setSamplesOpen((o) => !o)}
          >
            <Samples
              onPick={(c, t) =>
                confirmSampleReplace && liveCode.trim()
                  ? setPendingSample({ code: c, title: t })
                  : loadSample(c)
              }
            />
          </Collapsible>
        )}
        <Collapsible title="Actions" open={actionsOpen} onToggle={() => setActionsOpen((o) => !o)}>
          <Actions
            getSvg={() => innerPreviewRef.current?.getExportSvg() ?? null}
            code={code}
            config={config}
            title={title}
          />
        </Collapsible>
      </div>
    </div>
  );

  const previewPane = (
    <Preview
      ref={setPreviewRef}
      svg={result?.svg ?? null}
      bindFunctions={result?.bindFunctions}
      stale={!!error || (pending && !result)}
      rough={rough}
      grid={grid}
      onToggleRough={() => setRough((r) => !r)}
      onToggleGrid={() => setGrid((g) => !g)}
      fullscreenHref={props.fullscreenHref}
      onPointer={props.onPointer}
      onUserView={props.onUserView}
      overlay={props.overlay}
      onElementClick={previewOverride ? undefined : jumpToCode}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {header}
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex justify-center border-b border-border bg-surface p-1.5">
            <Tabs
              value={mobileView}
              onChange={setMobileView}
              items={[
                { value: 'edit', label: 'Edit' },
                { value: 'view', label: 'View' },
              ]}
            />
          </div>
          <div className={clsx('min-h-0 flex-1', mobileView !== 'edit' && 'hidden')}>
            {editorPane}
          </div>
          <div className={clsx('min-h-0 flex-1', mobileView !== 'view' && 'hidden')}>
            {previewPane}
          </div>
        </div>
      ) : (
        <Group
          orientation="horizontal"
          className="min-h-0 flex-1"
          defaultLayout={layout.defaultLayout}
          onLayoutChanged={layout.onLayoutChanged}
        >
          <Panel id="pane-editor" defaultSize="32" minSize="15">
            {editorPane}
          </Panel>
          <Separator className="w-px" />
          <Panel id="pane-preview" minSize="15">
            {previewPane}
          </Panel>
          {side && (
            <>
              <Separator className="w-px" />
              <Panel id="pane-side" defaultSize="24" minSize="15">
                {side}
              </Panel>
            </>
          )}
        </Group>
      )}
      <Dialog
        open={!!pendingSample}
        onClose={() => setPendingSample(null)}
        title="Replace diagram?"
        footer={
          <>
            <Button onClick={() => setPendingSample(null)}>Cancel</Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                if (pendingSample) loadSample(pendingSample.code);
                setPendingSample(null);
              }}
            >
              Replace
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Load <strong className="text-fg">{pendingSample?.title}</strong>? This replaces the code
          for everyone in this diagram. You can undo it right after (Undo in the notification, or
          Ctrl+Z in the editor).
        </p>
      </Dialog>
    </div>
  );
}
