import clsx from 'clsx';
import { useState } from 'react';
import { Dialog, stagger } from '../components/ui';
import { APP_VERSION, BUILD_SHA, CHANGELOG } from './changelog';

const SEEN_KEY = 'tp-seen-version';

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

const formatDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

/** The app version; click for release notes. A dot marks a version you haven't opened yet. */
export function VersionBadge({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(() => readSeen() !== APP_VERSION);
  const show = () => {
    setOpen(true);
    setUnseen(false);
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      /* private mode: the dot just comes back next time */
    }
  };
  return (
    <>
      <button
        type="button"
        data-tour="version"
        data-testid="version-badge"
        onClick={show}
        title={unseen ? 'Gramify was updated: see what’s new' : 'What’s new in Gramify'}
        className={clsx(
          'pointer-events-auto relative inline-flex items-center gap-1.5 rounded border border-border bg-surface/90 px-2 py-0.5 font-mono text-[11px] text-muted shadow-sm backdrop-blur transition-colors hover:border-accent hover:text-fg',
          className,
        )}
      >
        {unseen && (
          <span className="relative flex size-1.5" aria-label="New">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
          </span>
        )}
        Gramify v{APP_VERSION}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="What’s new in Gramify"
        width="max-w-lg"
      >
        <p className="mb-4 text-xs text-muted">
          You’re on <strong className="text-fg">v{APP_VERSION}</strong>
          {BUILD_SHA && (
            <>
              {' '}
              · build <span className="font-mono">{BUILD_SHA}</span>
            </>
          )}
        </p>
        <ol
          className="tp-stagger max-h-[60vh] space-y-5 overflow-y-auto pr-1"
          data-testid="changelog"
        >
          {CHANGELOG.map((r, i) => (
            <li
              key={r.version}
              style={stagger(i)}
              className="relative border-l-2 border-border pl-4"
            >
              <span
                className={clsx(
                  'absolute top-1 -left-[5px] size-2 rounded-full',
                  i === 0 ? 'bg-accent' : 'bg-border',
                )}
              />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs font-semibold text-accent">v{r.version}</span>
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="ml-auto text-[11px] text-muted">{formatDate(r.date)}</span>
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted marker:text-border">
                {r.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}
