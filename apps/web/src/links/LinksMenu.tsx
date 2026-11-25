import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useYText, type DiagramSession } from '../collab/session';
import { Button, Menu, type MenuItem } from '../components/ui';
import { api } from '../lib/api';
import { useResolvedLinks } from './useLinks';

const open = (href: string) => window.open(href, '_blank', 'noopener');
const muted = (text: string) => ({
  header: <span className="block max-w-64 text-xs text-muted">{text}</span>,
});

/** Header button: the boards this one links to, and the boards that link here (backlinks). */
export function LinksMenu({ diagramId, session }: { diagramId: string; session: DiagramSession }) {
  const code = useYText(session.code);
  const links = useResolvedLinks(code);
  const backlinks = useQuery({
    queryKey: ['backlinks', diagramId],
    queryFn: () => api.backlinks(diagramId),
    staleTime: 15_000,
  });
  const back = backlinks.data ?? [];
  const seen = new Set<string>();
  const outgoing = links.filter((l) => {
    const k = `${l.shape}\u0000${l.href ?? l.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const count = outgoing.length + back.length;

  const items: Array<MenuItem | 'separator' | { header: ReactNode }> = [
    { header: <span className="text-xs font-semibold text-muted uppercase">Links to</span> },
    ...(outgoing.length
      ? outgoing.map<MenuItem>((l) => ({
          label: (
            <span className="min-w-0 truncate">
              <span className="text-muted">{l.shape} → </span>
              {l.kind === 'url' ? l.title : l.title || 'Linked board'}
            </span>
          ),
          icon: <ArrowUpRight size={14} />,
          disabled: !l.href,
          onSelect: () => l.href && open(l.href),
        }))
      : [muted('No links yet. Right-click a shape in the diagram and choose “Link to board…”.')]),
    'separator',
    { header: <span className="text-xs font-semibold text-muted uppercase">Linked from</span> },
    ...(back.length
      ? back.map<MenuItem>((d) => ({
          label: <span className="min-w-0 truncate">{d.title}</span>,
          icon: <ArrowDownLeft size={14} />,
          onSelect: () => open(new URL(`/d/${d.id}`, location.origin).href),
        }))
      : [muted(backlinks.isPending ? 'Loading…' : 'No boards link here yet.')]),
  ];

  return (
    <Menu
      trigger={(p) => (
        <Button size="sm" variant="ghost" data-tour="links" aria-label="Links" {...p}>
          <Link2 size={14} /> <span className="hidden lg:inline">Links</span>
          {count > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
              {count}
            </span>
          )}
        </Button>
      )}
      items={items}
    />
  );
}
