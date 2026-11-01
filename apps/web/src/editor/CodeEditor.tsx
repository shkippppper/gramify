import type { PresenceState } from '@gramify/shared';
import { useEffect, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import * as Y from 'yjs';
import type { DiagramSession } from '../collab/session';
import { monaco, setupMonaco } from './monaco';

export type EditorTab = 'code' | 'config';

export interface EditorMarker {
  line: number;
  message: string;
}

interface Props {
  session: DiagramSession;
  tab: EditorTab;
  dark: boolean;
  codeMarker: EditorMarker | null;
  configMarker: EditorMarker | null;
  /** Called once the editor exists (used by follow mode to reveal positions). */
  onReady?: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;
}

let modelSeq = 0;

/**
 * One Monaco editor with two models (code + config), each bound to a Y.Text.
 * Undo/redo is routed to a Y.UndoManager that only tracks *local* edits,
 * so Ctrl+Z never reverts a teammate's changes.
 */
export function CodeEditor({ session, tab, dark, codeMarker, configMarker, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<{
    code: monaco.editor.ITextModel;
    config: monaco.editor.ITextModel;
  } | null>(null);
  const undoRef = useRef<{ code: Y.UndoManager; config: Y.UndoManager } | null>(null);
  const viewStates = useRef<Partial<Record<EditorTab, monaco.editor.ICodeEditorViewState | null>>>(
    {},
  );
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    setupMonaco();
    const seq = ++modelSeq;
    const code = monaco.editor.createModel(
      '',
      'mermaid',
      monaco.Uri.parse(`inmemory://tp/${seq}/diagram.mmd`),
    );
    const config = monaco.editor.createModel(
      '',
      'json',
      monaco.Uri.parse(`inmemory://tp/${seq}/config.json`),
    );
    code.setEOL(monaco.editor.EndOfLineSequence.LF);
    config.setEOL(monaco.editor.EndOfLineSequence.LF);
    modelsRef.current = { code, config };

    const editor = monaco.editor.create(host.current!, {
      model: tabRef.current === 'code' ? code : config,
      automaticLayout: true,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 4,
      readOnly: session.readOnly,
      renderLineHighlight: 'line',
      fixedOverflowWidgets: true,
      padding: { top: 8 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    });
    editorRef.current = editor;

    const editors = new Set([editor]);
    const codeBinding = new MonacoBinding(session.code, code, editors, session.awareness);
    const configBinding = new MonacoBinding(session.config, config, editors, session.awareness);
    const undo = {
      // 'sample' = loading a sample replaces the code; make that undoable with Ctrl+Z too.
      code: new Y.UndoManager(session.code, {
        trackedOrigins: new Set<unknown>([codeBinding, 'sample']),
      }),
      config: new Y.UndoManager(session.config, { trackedOrigins: new Set([configBinding]) }),
    };
    undoRef.current = undo;
    const current = () => undo[tabRef.current];
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => current().undo());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () =>
      current().redo(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => current().redo());

    const focusSub = editor.onDidFocusEditorText(() =>
      session.awareness?.setLocalStateField('tab', tabRef.current satisfies PresenceState['tab']),
    );
    onReady?.(editor);

    return () => {
      onReady?.(null);
      focusSub.dispose();
      undo.code.destroy();
      undo.config.destroy();
      codeBinding.destroy();
      configBinding.destroy();
      editor.dispose();
      code.dispose();
      config.dispose();
      editorRef.current = null;
      modelsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.doc, session.awareness]); // not `session`: a role change must not rebuild the editor

  // Switch tabs by swapping models, preserving scroll/cursor per tab.
  useEffect(() => {
    const editor = editorRef.current;
    const models = modelsRef.current;
    if (!editor || !models) return;
    const next = models[tab];
    if (editor.getModel() === next) return;
    const prevTab: EditorTab = tab === 'code' ? 'config' : 'code';
    viewStates.current[prevTab] = editor.saveViewState();
    editor.setModel(next);
    const vs = viewStates.current[tab];
    if (vs) editor.restoreViewState(vs);
    session.awareness?.setLocalStateField('tab', tab);
  }, [tab, session]);

  useEffect(() => {
    monaco.editor.setTheme(dark ? 'mermaid-dark' : 'mermaid');
  }, [dark]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: session.readOnly });
  }, [session.readOnly]);

  // Error markers
  useEffect(() => {
    const models = modelsRef.current;
    if (!models) return;
    const set = (model: monaco.editor.ITextModel, marker: EditorMarker | null) => {
      if (!marker || marker.line < 1 || marker.line > model.getLineCount()) {
        monaco.editor.setModelMarkers(model, 'gramify', []);
        return;
      }
      monaco.editor.setModelMarkers(model, 'gramify', [
        {
          severity: monaco.MarkerSeverity.Error,
          message: marker.message,
          startLineNumber: marker.line,
          endLineNumber: marker.line,
          startColumn: model.getLineFirstNonWhitespaceColumn(marker.line) || 1,
          endColumn: model.getLineMaxColumn(marker.line),
        },
      ]);
    };
    set(models.code, codeMarker);
    set(models.config, configMarker);
  }, [codeMarker, configMarker]);

  return <div ref={host} className="h-full w-full" data-testid="code-editor" />;
}
