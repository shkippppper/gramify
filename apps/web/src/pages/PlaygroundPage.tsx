import { deserializeState, serializeState, DEFAULT_CODE, DEFAULT_CONFIG } from '@gramify/shared';
import { Link2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createLocalDoc, sessionFromDoc } from '../collab/session';
import { ThemeToggle, TopBar } from '../components/TopBar';
import { Button } from '../components/ui';
import { EditorWorkspace } from '../editor/EditorWorkspace';
import { load, save } from '../lib/storage';
import { SaveToLibraryButton } from './playgroundSave';

const STORE_KEY = 'tp-playground';

function initialState() {
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      const s = deserializeState(hash);
      return { code: s.code, config: s.mermaid || '{}' };
    } catch (e) {
      toast.error(`Could not read diagram from link: ${(e as Error).message}`);
    }
  }
  return load(STORE_KEY, { code: DEFAULT_CODE, config: DEFAULT_CONFIG });
}

/** Single-player scratchpad, state lives in the URL hash (mermaid.live compatible). */
export function PlaygroundPage() {
  const session = useMemo(() => {
    const s = initialState();
    return sessionFromDoc(createLocalDoc(s.code, s.config));
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const state = { code: session.code.toString(), config: session.config.toString() };
        save(STORE_KEY, state);
        history.replaceState(
          null,
          '',
          `#${serializeState({ code: state.code, mermaid: state.config })}`,
        );
      }, 250);
    };
    session.doc.on('update', sync);
    sync();
    return () => {
      clearTimeout(t);
      session.doc.off('update', sync);
    };
  }, [session]);

  return (
    <EditorWorkspace
      session={session}
      title="playground"
      fullscreenHref={`/play/view${location.hash}`}
      header={
        <TopBar
          left={<span className="truncate text-sm font-medium">Playground</span>}
          right={
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(location.href);
                  toast.success('Link copied');
                }}
              >
                <Link2 size={14} /> Copy link
              </Button>
              <SaveToLibraryButton session={session} />
              <ThemeToggle />
            </>
          }
        />
      }
    />
  );
}
