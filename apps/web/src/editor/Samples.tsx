import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { SAMPLE_FAMILIES } from './samples';

export function Samples({ onPick }: { onPick: (code: string, title: string) => void }) {
  const [openName, setOpenName] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-2 gap-1" data-testid="samples">
      {SAMPLE_FAMILIES.map((fam) => (
        <div key={fam.name} className="relative">
          <div className="flex rounded-md border border-border bg-surface text-xs hover:border-accent/50">
            <button
              type="button"
              className="min-w-0 flex-1 truncate px-2 py-1.5 text-left"
              title={fam.description || fam.name}
              onClick={() => onPick(fam.examples[0]!.code, fam.examples[0]!.title)}
            >
              {fam.name}
            </button>
            {fam.examples.length > 1 && (
              <button
                type="button"
                aria-label={`More ${fam.name} examples`}
                className="border-l border-border px-1 text-muted hover:text-fg"
                onClick={() => setOpenName(openName === fam.name ? null : fam.name)}
              >
                <ChevronDown size={12} />
              </button>
            )}
          </div>
          {openName === fam.name && (
            <div className="absolute z-30 mt-1 w-64 rounded-lg border border-border bg-surface p-1 shadow-lg">
              {fam.examples.map((ex) => (
                <button
                  key={ex.title}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-surface-2"
                  onClick={() => {
                    setOpenName(null);
                    onPick(ex.code, ex.title);
                  }}
                >
                  {ex.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
