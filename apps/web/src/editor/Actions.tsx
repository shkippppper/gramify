import { serializeState } from '@tidepool/shared';
import { Clipboard, Code2, ExternalLink, FileCode, FileImage, Image } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '../components/ui';
import { slugify } from '../lib/download';
import { useLocalState } from '../lib/useLocalState';
import { canCopyImage, copyPng, downloadSvg, downloadText, fileName, svgToPng, type SizeMode } from '../render/export';
import { downloadBlob } from '../lib/download';

interface Props {
  getSvg: () => string | null;
  code: string;
  config: string;
  title: string;
}

function previewBackground() {
  return getComputedStyle(document.documentElement).getPropertyValue('--tp-surface').trim() || '#ffffff';
}

export function Actions({ getSvg, code, config, title }: Props) {
  const [mode, setMode] = useLocalState<SizeMode>('tp-png-mode', 'auto');
  const [size, setSize] = useLocalState('tp-png-size', 1080);
  const [transparent, setTransparent] = useLocalState('tp-png-transparent', false);
  const [busy, setBusy] = useState(false);

  const svgOrToast = () => {
    const svg = getSvg();
    if (!svg) toast.error('Nothing to export yet: fix the diagram first.');
    return svg;
  };
  const bg = () => (transparent ? null : previewBackground());
  const png = (svg: string) => svgToPng(svg, { mode, size: Math.min(10000, Math.max(3, size || 1080)), background: bg() });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };

  return (
    <div className="space-y-3 text-xs" data-testid="actions">
      <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <legend className="sr-only">PNG size</legend>
        {(['auto', 'width', 'height'] as const).map((m) => (
          <label key={m} className="flex items-center gap-1 capitalize">
            <input type="radio" name="png-mode" checked={mode === m} onChange={() => setMode(m)} />
            {m}
          </label>
        ))}
        {mode !== 'auto' && (
          <Input
            type="number"
            min={3}
            max={10000}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-7 w-20 text-xs"
            aria-label="PNG size in pixels"
          />
        )}
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
          Transparent
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const svg = svgOrToast();
              if (svg) downloadBlob(fileName(title, 'png'), await png(svg));
            })
          }
        >
          <FileImage size={14} /> PNG
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const svg = svgOrToast();
            if (svg) downloadSvg(svg, title, bg());
          }}
        >
          <Image size={14} /> SVG
        </Button>
        {canCopyImage() && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const svg = svgOrToast();
                if (!svg) return;
                await copyPng(png(svg));
                toast.success('Image copied to clipboard');
              })
            }
          >
            <Clipboard size={14} /> Copy image
          </Button>
        )}
        <Button size="sm" onClick={() => downloadText(code, `${slugify(title)}.mmd`)}>
          <FileCode size={14} /> .mmd
        </Button>
        <Button size="sm" onClick={() => void copy('```mermaid\n' + code.trimEnd() + '\n```\n', 'Markdown')}>
          <Code2 size={14} /> Copy Markdown
        </Button>
        <Button
          size="sm"
          title="Open a copy in the public mermaid.live editor (content is placed in the URL)"
          onClick={() =>
            window.open(`https://mermaid.live/edit#${serializeState({ code, mermaid: config })}`, '_blank', 'noopener')
          }
        >
          <ExternalLink size={14} /> mermaid.live
        </Button>
      </div>
    </div>
  );
}
