import { BRAND } from '@gramify/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DiagramRole,
  DiagramVersionInfo as DiagramVersion,
  PresenceState,
} from '@gramify/shared';
import { useVersionContent } from '../history/useVersionContent';
import { serializeState } from '@gramify/shared';
import clsx from 'clsx';
import { ChevronRight, Eye, History, Link2, Share2, Square, Users } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import * as Y from 'yjs';
import { PointerLayer } from '../collab/PointerLayer';
import { PresenceAvatars } from '../collab/PresenceAvatars';
import { RemoteCursorStyles } from '../collab/RemoteCursorStyles';
import { useYMapValue, useYText, type DiagramSession } from '../collab/session';
import { useCollab, type CollabStatus } from '../collab/useCollab';
import { ThemeToggle, TopBar } from '../components/TopBar';
import { ShareDialog } from '../components/ShareDialog';
import { UserMenu } from '../components/UserMenu';
import { Button, Menu, Spinner } from '../components/ui';
import { EditorWorkspace } from '../editor/EditorWorkspace';
import type { monaco } from '../editor/monaco';
import { HistoryPanel } from '../history/HistoryPanel';
import { api, ApiError } from '../lib/api';
import { FullPageSpinner, useMe } from '../lib/auth';
import { TourHost } from '../tour/Tour';
import { formatDateTime } from '../lib/time';
import { throttleTrailing } from '../lib/throttle';
import { useLocalState } from '../lib/useLocalState';
import type { PreviewHandle, SharedView } from '../render/Preview';

function StatusBadge({
  status,
  synced,
  unsynced,
}: {
  status: CollabStatus;
  synced: boolean;
  unsynced: number;
}) {
  const label =
    status === 'connected'
      ? synced && unsynced === 0
        ? 'Saved'
        : 'Saving…'
      : status === 'connecting'
        ? 'Connecting…'
        : 'Offline: keep this tab open';
  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted sm:flex"
      data-testid="status"
      data-tour="status"
      data-status={status}
    >
      <span
        className={clsx(
          'size-2 rounded-full',
          status === 'connected'
            ? unsynced
              ? 'bg-amber-500'
              : 'bg-green-500'
            : status === 'connecting'
              ? 'animate-pulse bg-amber-500'
              : 'bg-danger',
        )}
      />
      {label}
    </span>
  );
}

function TitleInput({ session, fallback }: { session: DiagramSession; fallback: string }) {
  const live = useYMapValue<string>(session.meta, 'title');
  const title = live ?? fallback;
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    document.title = `${title} · Gramify`;
    return () => {
      document.title = BRAND.name;
    };
  }, [title]);
  const commit = () => {
    const v = draft?.trim();
    if (v && v !== title) session.meta.set('title', v.slice(0, 200));
    setDraft(null);
  };
  return (
    <input
      value={draft ?? title}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
      readOnly={session.readOnly}
      aria-label="Diagram title"
      data-testid="title-input"
      data-tour="title"
      className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium outline-none hover:border-border focus:border-accent sm:max-w-80"
    />
  );
}

export function DiagramPage() {
  const id = useParams<{ id: string }>().id?.toLowerCase();
  const me = useMe();
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ['diagram', id],
    queryFn: () => api.getDiagram(id!),
    enabled: !!id,
    retry: false,
  });
  const folders = useQuery({ queryKey: ['folders'], queryFn: api.listFolders });
  const collab = useCollab(summary.data && !summary.data.deletedAt ? id : undefined, me.data, {
    readOnly: summary.data?.role === 'viewer',
  });
  const [shareOpen, setShareOpen] = useState(false);
  const session = collab.session;

  const [historyOpen, setHistoryOpen] = useLocalState('tp-history-open', false);
  const [previewing, setPreviewing] = useState<DiagramVersion | null>(null);
  const [following, setFollowing] = useState<number | null>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Cmd/Ctrl+S: everything is saved automatically, so offer a named version instead of the browser dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setHistoryOpen(true);
        toast.message('Changes save automatically', {
          description: 'Use “Save version” to name this point in history.',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setHistoryOpen]);

  useEffect(() => {
    // Keep the library list fresh when we leave.
    return () => void qc.invalidateQueries({ queryKey: ['diagrams'] });
  }, [qc]);

  // ---- presence: pointer + view broadcast ----
  const onPointer = useCallback(
    (p: { x: number; y: number } | null) => session?.awareness?.setLocalStateField('pointer', p),
    [session],
  );
  // Broadcast our view (throttled, always delivering the final one) for followers.
  const sendView = useMemo(
    () =>
      throttleTrailing(
        (view: SharedView) => session?.awareness?.setLocalStateField('view', view),
        100,
      ),
    [session],
  );
  useEffect(() => () => sendView.cancel(), [sendView]);
  const onUserView = useCallback(
    (view: SharedView, byUser: boolean) => {
      if (byUser) setFollowing(null);
      sendView(view);
    },
    [sendView],
  );

  // ---- follow mode: mirror the followed user's preview view and caret ----
  useEffect(() => {
    const aw = session?.awareness;
    if (!aw || following == null) return;
    let lastView = '';
    let lastSel = '';
    const apply = () => {
      const st = aw.getStates().get(following) as PresenceState | undefined;
      if (!st) {
        setFollowing(null);
        toast.message('They left the diagram');
        return;
      }
      // Awareness changes for every peer's pointer at ~30 Hz: only act on real changes.
      const viewKey = JSON.stringify(st.view);
      const selKey = JSON.stringify((st as unknown as { selection?: unknown }).selection ?? null);
      if (viewKey === lastView && selKey === lastSel) return;
      const viewChanged = viewKey !== lastView;
      lastView = viewKey;
      lastSel = selKey;
      if (st.view && viewChanged) previewRef.current?.setView(st.view);
      const sel = (st as unknown as { selection?: { head?: Y.RelativePosition } }).selection;
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (sel?.head && editor && model && model.getLanguageId() === 'mermaid') {
        const abs = Y.createAbsolutePositionFromRelativePosition(sel.head, session.doc);
        if (abs && abs.type === session.code) {
          editor.revealPositionInCenterIfOutsideViewport(model.getPositionAt(abs.index));
        }
      }
    };
    apply();
    aw.on('change', apply);
    return () => aw.off('change', apply);
  }, [session, following]);

  // Typing stops following.
  const onEditorReady = useCallback((editor: monaco.editor.IStandaloneCodeEditor | null) => {
    editorRef.current = editor;
    editor?.onKeyDown(() => setFollowing(null));
  }, []);

  const followedName = useMemo(() => {
    if (following == null) return null;
    const st = session?.awareness?.getStates().get(following) as PresenceState | undefined;
    return st?.user.name ?? null;
  }, [following, session]);

  if (summary.isPending || me.isPending) return <FullPageSpinner />;
  if (summary.isError || summary.data?.deletedAt) {
    const notFound = summary.error instanceof ApiError && summary.error.status === 404;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted">
          {summary.data?.deletedAt
            ? 'This diagram is in the trash.'
            : notFound
              ? 'This diagram does not exist.'
              : (summary.error as Error).message}
        </p>
        <Link
          to={summary.data?.deletedAt ? '/?view=trash' : '/'}
          className="text-sm text-accent hover:underline"
        >
          Back to library
        </Link>
      </div>
    );
  }
  const d = summary.data!;
  if (collab.error) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-danger">{collab.error}</div>
    );
  }
  if (!session || !collab.synced) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
        <Spinner />
        {collab.status === 'disconnected' ? 'Waiting for connection…' : 'Opening diagram…'}
      </div>
    );
  }

  const folder = folders.data?.find((f) => f.id === d.folderId);

  return (
    <>
      <RemoteCursorStyles session={session} />
      <TourHost tour="editor" userId={me.data?.id} />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} diagram={d} />
      <DiagramWorkspace
        diagramId={d.id}
        session={session}
        title={d.title}
        previewRef={previewRef}
        previewing={previewing}
        onEditorReady={onEditorReady}
        onPointer={onPointer}
        onUserView={onUserView}
        header={
          <TopBar
            left={
              <>
                <Link
                  to={folder ? `/?folder=${folder.id}` : '/'}
                  className="hidden shrink-0 items-center gap-1 text-sm text-muted hover:text-fg md:flex"
                >
                  {folder?.name ?? 'Library'} <ChevronRight size={14} />
                </Link>
                <TitleInput session={session} fallback={d.title} />
                <StatusBadge
                  status={collab.status}
                  synced={collab.synced}
                  unsynced={collab.unsynced}
                />
                {d.role === 'viewer' && (
                  <span
                    className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
                    data-testid="view-only"
                  >
                    View only
                  </span>
                )}
              </>
            }
            right={
              <>
                <PresenceAvatars session={session} following={following} onFollow={setFollowing} />
                <ShareMenu id={d.id} session={session} onManage={() => setShareOpen(true)} />
                <Button
                  size="sm"
                  variant={historyOpen ? 'secondary' : 'ghost'}
                  onClick={() => {
                    if (historyOpen) setPreviewing(null);
                    setHistoryOpen(!historyOpen);
                  }}
                  aria-pressed={historyOpen}
                  data-tour="history"
                >
                  <History size={14} /> <span className="hidden lg:inline">History</span>
                </Button>
                <ThemeToggle />
                <UserMenu />
              </>
            }
          />
        }
        side={
          historyOpen ? (
            <HistoryPanelLive
              role={d.role}
              diagramId={d.id}
              session={session}
              previewing={previewing}
              onPreview={setPreviewing}
              onClose={() => {
                setHistoryOpen(false);
                setPreviewing(null);
              }}
            />
          ) : undefined
        }
        banner={
          previewing ? (
            <Banner tone="accent">
              <Eye size={14} className="shrink-0 text-accent" />
              <span className="truncate" title="The editor still shows the live diagram">
                Previewing <strong>{previewing.name ?? 'version'}</strong> ·{' '}
                {formatDateTime(previewing.createdAt)}
              </span>
              <Button size="sm" onClick={() => setPreviewing(null)}>
                Back to live
              </Button>
            </Banner>
          ) : followedName ? (
            <Banner tone="follow">
              <Eye size={14} /> Following {followedName}
              <Button size="sm" onClick={() => setFollowing(null)}>
                <Square size={11} /> Stop
              </Button>
            </Banner>
          ) : null
        }
      />
    </>
  );
}

function Banner({ tone, children }: { tone: 'accent' | 'follow'; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        'pointer-events-auto absolute top-3 left-3 z-20 flex max-w-[calc(100%-13rem)] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs whitespace-nowrap shadow-sm',
        tone === 'accent'
          ? 'border-accent/40 bg-surface text-fg'
          : 'border-accent bg-accent text-accent-fg',
      )}
    >
      {children}
    </div>
  );
}

/** Wraps the workspace so live code (for previews/diffs) is read from the shared doc. */
function DiagramWorkspace({
  diagramId,
  session,
  title,
  header,
  side,
  banner,
  previewing,
  previewRef,
  onEditorReady,
  onPointer,
  onUserView,
}: {
  diagramId: string;
  session: DiagramSession;
  title: string;
  header: React.ReactNode;
  side?: React.ReactNode;
  banner: React.ReactNode;
  previewing: DiagramVersion | null;
  previewRef: React.RefObject<PreviewHandle | null>;
  onEditorReady: (e: monaco.editor.IStandaloneCodeEditor | null) => void;
  onPointer: (p: { x: number; y: number } | null) => void;
  onUserView: (v: SharedView, byUser: boolean) => void;
}) {
  const liveTitle = useYMapValue<string>(session.meta, 'title') ?? title;
  const previewContent = useVersionContent(diagramId, previewing?.id);
  return (
    <EditorWorkspace
      session={session}
      title={liveTitle}
      header={header}
      side={side}
      previewOverride={
        previewContent.data && previewing
          ? { code: previewContent.data.code, config: previewContent.data.config }
          : null
      }
      confirmSampleReplace
      fullscreenHref={`${location.pathname}/view`}
      previewRef={previewRef}
      onEditorReady={onEditorReady}
      onPointer={previewing ? undefined : onPointer}
      onUserView={onUserView}
      overlay={(api) => (
        <>
          {!previewing && <PointerLayer session={session} api={api} />}
          {banner}
        </>
      )}
    />
  );
}

function HistoryPanelLive(props: {
  role: DiagramRole;
  diagramId: string;
  session: DiagramSession;
  previewing: DiagramVersion | null;
  onPreview: (v: DiagramVersion | null) => void;
  onClose: () => void;
}) {
  // Deferred: typing stays snappy while a version diff is open.
  const code = useDeferredValue(useYText(props.session.code));
  const config = useDeferredValue(useYText(props.session.config));
  return <HistoryPanel {...props} currentCode={code} currentConfig={config} />;
}

function ShareMenu({
  id,
  session,
  onManage,
}: {
  id: string;
  session: DiagramSession;
  onManage: () => void;
}) {
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };
  return (
    <Menu
      trigger={(p) => (
        <Button size="sm" variant="ghost" data-tour="share" {...p}>
          <Share2 size={14} /> <span className="hidden lg:inline">Share</span>
        </Button>
      )}
      items={[
        { label: 'People with access…', icon: <Users size={14} />, onSelect: onManage },
        'separator',
        {
          label: 'Copy editor link',
          icon: <Link2 size={14} />,
          onSelect: () => void copy(`${location.origin}/d/${id}`, 'Link'),
        },
        {
          label: 'Copy full-screen view link',
          icon: <Eye size={14} />,
          onSelect: () => void copy(`${location.origin}/d/${id}/view`, 'View link'),
        },
        'separator',
        {
          label: 'Open a copy in the Playground',
          onSelect: () =>
            window.open(
              `/play#${serializeState({ code: session.code.toString(), mermaid: session.config.toString() })}`,
              '_blank',
            ),
        },
      ]}
    />
  );
}
