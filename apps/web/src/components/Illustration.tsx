import clsx from 'clsx';
import { useId } from 'react';

export type IllustrationName =
  | 'boards'
  | 'starred'
  | 'recent'
  | 'shared'
  | 'trash'
  | 'folder'
  | 'search'
  | 'missing'
  | 'error'
  | 'welcome';

/**
 * Small spot illustrations in the same style as the new-board picker: drawn with the theme
 * colors (so they work in light and dark), with parts that float gently (`tp-bob`).
 */
export function Illustration({
  name,
  className,
  framed = false,
}: {
  name: IllustrationName;
  className?: string;
  /** Draw on a dotted panel, like the template cards. */
  framed?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const arrow = `tp-ill-arrow-${uid}`;
  const dots = `tp-ill-dots-${uid}`;
  return (
    <svg
      viewBox="0 0 200 120"
      className={clsx('tp-idle block', className)}
      aria-hidden="true"
      data-illustration={name}
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L6 3 L0 6 z" fill="var(--tp-muted)" />
        </marker>
        <pattern id={dots} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="var(--tp-border)" />
        </pattern>
      </defs>
      {framed && <rect width="200" height="120" fill={`url(#${dots})`} />}
      {ART[name](arrow)}
    </svg>
  );
}

const line = { stroke: 'var(--tp-muted)', strokeWidth: 1.2, fill: 'none' } as const;
const card = { fill: 'var(--tp-surface)', stroke: 'var(--tp-border)', strokeWidth: 1.2 } as const;

/** A board card with a tiny flowchart on it. */
function Board({ x, y, arrow, w = 64 }: { x: number; y: number; arrow: string; w?: number }) {
  const h = w * 0.72;
  const cx = x + w / 2;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="6" {...card} />
      <rect
        x={cx - w * 0.17}
        y={y + h * 0.14}
        width={w * 0.34}
        height={h * 0.2}
        rx="2.5"
        fill="none"
        stroke="var(--tp-accent)"
        strokeWidth="1.3"
      />
      <path d={`M${cx} ${y + h * 0.34} V${y + h * 0.5}`} {...line} markerEnd={`url(#${arrow})`} />
      <path
        d={`M${cx} ${y + h * 0.52} l${w * 0.1} ${h * 0.14} l${-w * 0.1} ${h * 0.14} l${-w * 0.1} ${-h * 0.14} z`}
        fill="var(--tp-accent)"
        opacity="0.85"
      />
    </>
  );
}

const ART: Record<IllustrationName, (arrow: string) => React.ReactNode> = {
  boards: (arrow) => (
    <>
      <g opacity="0.55">
        <rect x="58" y="20" width="76" height="55" rx="6" {...card} />
      </g>
      <g opacity="0.8">
        <rect x="64" y="28" width="76" height="55" rx="6" {...card} />
      </g>
      <g className="tp-bob">
        <Board x={70} y={36} w={76} arrow={arrow} />
      </g>
      <g className="tp-bob tp-bob-1">
        <circle cx="146" cy="90" r="13" fill="var(--tp-accent)" />
        <path
          d="M146 84 V96 M140 90 H152"
          stroke="var(--tp-accent-fg)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </>
  ),
  starred: (arrow) => (
    <>
      <g className="tp-bob tp-bob-1">
        <Board x={62} y={34} w={76} arrow={arrow} />
      </g>
      <g className="tp-bob">
        <path
          d="M140 16 l5.3 10.8 11.9 1.7 -8.6 8.4 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.6 -8.4 11.9 -1.7 z"
          fill="#f59e0b"
          stroke="#d97706"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </g>
      <g className="tp-bob tp-bob-2" fill="#f59e0b">
        <circle cx="52" cy="30" r="2" />
        <circle cx="160" cy="70" r="1.6" />
        <circle cx="46" cy="86" r="1.4" />
      </g>
    </>
  ),
  recent: (arrow) => (
    <>
      <g className="tp-bob tp-bob-1">
        <Board x={54} y={34} w={76} arrow={arrow} />
      </g>
      <g className="tp-bob">
        <circle
          cx="134"
          cy="38"
          r="17"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="2"
        />
        <path
          d="M134 28 V38 L141 43"
          stroke="var(--tp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </>
  ),
  shared: (arrow) => (
    <>
      <g className="tp-bob tp-bob-1">
        <Board x={62} y={38} w={76} arrow={arrow} />
      </g>
      <path d="M44 44 C 52 52, 56 56, 62 58" {...line} strokeDasharray="3 3" />
      <path d="M156 44 C 148 52, 144 56, 138 58" {...line} strokeDasharray="3 3" />
      <g className="tp-bob">
        <circle cx="36" cy="34" r="12" fill="var(--tp-accent)" />
        <circle cx="36" cy="30" r="4" fill="var(--tp-accent-fg)" opacity="0.9" />
        <path d="M28 41 a8 6 0 0 1 16 0" fill="var(--tp-accent-fg)" opacity="0.9" />
      </g>
      <g className="tp-bob tp-bob-2">
        <circle cx="164" cy="34" r="12" fill="#8b5cf6" />
        <circle cx="164" cy="30" r="4" fill="#fff" opacity="0.9" />
        <path d="M156 41 a8 6 0 0 1 16 0" fill="#fff" opacity="0.9" />
      </g>
    </>
  ),
  trash: () => (
    <>
      <g className="tp-bob tp-bob-1">
        <path d="M78 42 h44 l-4 58 a5 5 0 0 1 -5 4.5 h-26 a5 5 0 0 1 -5 -4.5 z" {...card} />
        <path
          d="M91 52 v40 M100 52 v40 M109 52 v40"
          stroke="var(--tp-border)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g className="tp-bob">
        <rect x="72" y="32" width="56" height="7" rx="3.5" fill="var(--tp-muted)" opacity="0.7" />
        <rect x="92" y="26" width="16" height="7" rx="3" fill="var(--tp-muted)" opacity="0.7" />
      </g>
      <g className="tp-bob tp-bob-2" fill="var(--tp-accent)">
        <path d="M140 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
        <path
          d="M58 62 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 z"
          opacity="0.7"
        />
      </g>
    </>
  ),
  folder: (arrow) => (
    <>
      <path
        d="M48 46 h30 l8 8 h66 a4 4 0 0 1 4 4 v42 a4 4 0 0 1 -4 4 h-100 a4 4 0 0 1 -4 -4 z"
        fill="var(--tp-surface-2)"
        stroke="var(--tp-border)"
        strokeWidth="1.2"
      />
      <g className="tp-bob">
        <g strokeDasharray="4 3">
          <rect
            x="70"
            y="16"
            width="60"
            height="43"
            rx="6"
            fill="var(--tp-surface)"
            stroke="var(--tp-muted)"
            strokeWidth="1.2"
          />
        </g>
        <path d="M100 26 V46" {...line} markerEnd={`url(#${arrow})`} />
      </g>
      <path
        d="M44 64 h112 l-6 40 h-100 z"
        fill="var(--tp-surface)"
        stroke="var(--tp-border)"
        strokeWidth="1.2"
      />
    </>
  ),
  search: (arrow) => (
    <>
      <g className="tp-bob tp-bob-1">
        <Board x={50} y={34} w={76} arrow={arrow} />
      </g>
      <g className="tp-bob">
        <circle
          cx="128"
          cy="54"
          r="17"
          fill="var(--tp-surface)"
          fillOpacity="0.6"
          stroke="var(--tp-accent)"
          strokeWidth="3"
        />
        <path d="M140 67 L156 84" stroke="var(--tp-accent)" strokeWidth="5" strokeLinecap="round" />
      </g>
    </>
  ),
  missing: () => (
    <>
      <g className="tp-bob tp-bob-1">
        <rect
          x="62"
          y="34"
          width="76"
          height="55"
          rx="6"
          fill="var(--tp-surface)"
          stroke="var(--tp-muted)"
          strokeWidth="1.3"
          strokeDasharray="5 4"
        />
      </g>
      <g className="tp-bob">
        <circle cx="138" cy="34" r="15" fill="var(--tp-accent)" />
        <text
          x="138"
          y="40"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill="var(--tp-accent-fg)"
        >
          ?
        </text>
      </g>
    </>
  ),
  error: (arrow) => (
    <>
      <g className="tp-bob tp-bob-1">
        <Board x={58} y={36} w={76} arrow={arrow} />
      </g>
      <g className="tp-bob">
        <path
          d="M140 18 L158 50 H122 Z"
          fill="#fef3c7"
          stroke="#d97706"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M140 29 V39" stroke="#b45309" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="140" cy="44.5" r="1.5" fill="#b45309" />
      </g>
    </>
  ),
  welcome: (arrow) => (
    <>
      {/* A shared diagram… */}
      <g className="tp-bob tp-bob-1">
        <rect
          x="70"
          y="14"
          width="60"
          height="20"
          rx="5"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="1.4"
        />
        <rect x="84" y="22" width="32" height="4" rx="2" fill="var(--tp-accent)" opacity="0.6" />
        <path d="M100 34 V50" {...line} markerEnd={`url(#${arrow})`} />
        <path
          d="M100 52 L116 66 L100 80 L84 66 Z"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="1.4"
        />
        <path d="M86 74 L70 92 M114 74 L130 92" {...line} markerEnd={`url(#${arrow})`} />
        <rect x="42" y="94" width="40" height="16" rx="4" fill="var(--tp-accent)" opacity="0.85" />
        <rect
          x="118"
          y="94"
          width="40"
          height="16"
          rx="8"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="1.4"
        />
      </g>
      {/* …with two people's cursors on it. */}
      <g className="tp-bob">
        <path
          d="M40 34 l0 16 4.5 -4 3 7 3 -1.3 -3 -6.8 6 -0.4 z"
          fill="#ec4899"
          stroke="#fff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <rect x="50" y="52" width="26" height="10" rx="3" fill="#ec4899" />
        <rect x="54" y="56" width="18" height="2.5" rx="1.25" fill="#fff" opacity="0.9" />
      </g>
      <g className="tp-bob tp-bob-2">
        <path
          d="M150 58 l0 16 4.5 -4 3 7 3 -1.3 -3 -6.8 6 -0.4 z"
          fill="#8b5cf6"
          stroke="#fff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <rect x="160" y="76" width="26" height="10" rx="3" fill="#8b5cf6" />
        <rect x="164" y="80" width="18" height="2.5" rx="1.25" fill="#fff" opacity="0.9" />
      </g>
    </>
  ),
};
