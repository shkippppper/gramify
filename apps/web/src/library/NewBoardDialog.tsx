import { Shapes } from 'lucide-react';
import { Dialog, stagger } from '../components/ui';
import { TemplateArt } from './TemplateArt';
import { BOARD_TEMPLATES, type BoardTemplate } from './templates';

/** Shown when creating a board: pick what kind of diagram to start from. */
export function NewBoardDialog({
  open,
  onClose,
  onPick,
  onBrowseSamples,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (template: BoardTemplate) => void;
  onBrowseSamples: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Create a new board" width="max-w-5xl">
      <div
        data-testid="new-board"
        className="tp-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {BOARD_TEMPLATES.map((t, i) => (
          <button
            key={t.id}
            type="button"
            data-template={t.id}
            data-autofocus={i === 0 ? '' : undefined}
            aria-label={t.name}
            onClick={() => onPick(t)}
            style={stagger(i)}
            className="group tp-lift flex min-w-0 flex-row overflow-hidden rounded-xl border border-border bg-surface text-left focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none sm:flex-col"
          >
            <span className="block aspect-[5/3] w-32 shrink-0 self-center border-r border-border bg-surface-2 sm:w-auto sm:self-auto sm:border-r-0 sm:border-b">
              <TemplateArt id={t.id} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {t.name}
                {t.id === 'empty' && (
                  <kbd className="ml-auto hidden rounded border border-border px-1 font-sans text-[10px] font-normal text-muted sm:inline">
                    Enter
                  </kbd>
                )}
              </span>
              <span className="line-clamp-2 text-xs leading-relaxed text-muted sm:line-clamp-none">
                {t.description}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          Every board is Mermaid code underneath, so you can mix and change types anytime.
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-accent hover:bg-surface-2"
          onClick={onBrowseSamples}
        >
          <Shapes size={14} /> Browse all samples
        </button>
      </div>
    </Dialog>
  );
}
