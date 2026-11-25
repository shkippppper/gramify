import { useId } from 'react';
import type { BoardTemplate } from './templates';

/**
 * Illustrations for the new-board picker. Drawn by hand (not rendered diagrams) so they read
 * at a glance, animate on hover, and follow the app theme in light and dark mode.
 */
export function TemplateArt({ id }: { id: BoardTemplate['id'] }) {
  const uid = useId().replace(/:/g, '');
  const dots = `tp-dots-${uid}`;
  const arrow = `tp-arrow-${uid}`;
  return (
    <svg viewBox="0 0 200 120" className="block h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={dots} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="var(--tp-border)" />
        </pattern>
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
      </defs>
      <rect width="200" height="120" fill={`url(#${dots})`} />
      {id === 'empty' && <EmptyArt />}
      {id === 'mermaid' && <MermaidArt arrow={arrow} />}
      {id === 'c4' && <C4Art arrow={arrow} />}
      {id === 'bpmn' && <BpmnArt arrow={arrow} />}
    </svg>
  );
}

const line = { stroke: 'var(--tp-muted)', strokeWidth: 1.2, fill: 'none' } as const;

function EmptyArt() {
  return (
    <g className="tp-bob">
      <rect
        x="50"
        y="22"
        width="100"
        height="76"
        rx="10"
        fill="var(--tp-surface)"
        stroke="var(--tp-muted)"
        strokeWidth="1.4"
        strokeDasharray="5 4"
        opacity="0.9"
      />
      <circle cx="100" cy="60" r="15" fill="var(--tp-accent)" />
      <path
        d="M100 52 V68 M92 60 H108"
        stroke="var(--tp-accent-fg)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </g>
  );
}

function MermaidArt({ arrow }: { arrow: string }) {
  const code = [
    { w: 34, c: 'var(--tp-accent)' },
    { w: 46, c: 'var(--tp-muted)', x: 6 },
    { w: 30, c: 'var(--tp-muted)', x: 6 },
    { w: 40, c: 'var(--tp-muted)', x: 6 },
    { w: 24, c: 'var(--tp-muted)', x: 6 },
  ];
  return (
    <>
      {/* Code on the left… */}
      <g className="tp-bob">
        <rect
          x="12"
          y="20"
          width="70"
          height="80"
          rx="7"
          fill="var(--tp-surface)"
          stroke="var(--tp-border)"
        />
        {code.map((l, i) => (
          <rect
            key={i}
            x={20 + (l.x ?? 0)}
            y={32 + i * 13}
            width={l.w}
            height="4"
            rx="2"
            fill={l.c}
            opacity={i === 0 ? 1 : 0.55}
          />
        ))}
      </g>
      <path d="M88 60 H102" {...line} strokeWidth={1.6} markerEnd={`url(#${arrow})`} />
      {/* …becomes a diagram on the right. */}
      <g className="tp-bob tp-bob-1">
        <rect
          x="122"
          y="14"
          width="44"
          height="18"
          rx="4"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="1.4"
        />
        <path d="M144 32 V43" {...line} markerEnd={`url(#${arrow})`} />
        <path
          d="M144 45 L158 58 L144 71 L130 58 Z"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="1.4"
        />
        <path d="M134 66 L124 84 M154 66 L164 84" {...line} markerEnd={`url(#${arrow})`} />
        <rect x="106" y="86" width="34" height="16" rx="4" fill="var(--tp-accent)" opacity="0.85" />
        <rect
          x="148"
          y="86"
          width="34"
          height="16"
          rx="8"
          fill="var(--tp-surface)"
          stroke="var(--tp-accent)"
          strokeWidth="1.4"
        />
      </g>
    </>
  );
}

export function C4Art({ arrow }: { arrow: string }) {
  return (
    <>
      {/* A person… */}
      <g className="tp-bob">
        <circle cx="62" cy="20" r="8" fill="#08427b" />
        <rect x="46" y="27" width="32" height="16" rx="8" fill="#08427b" />
        <rect x="54" y="33" width="16" height="2.5" rx="1.25" fill="#fff" opacity="0.8" />
      </g>
      <path d="M62 44 V58" {...line} markerEnd={`url(#${arrow})`} />
      {/* …uses our system (inside our boundary)… */}
      <rect
        x="16"
        y="60"
        width="100"
        height="52"
        rx="6"
        fill="none"
        stroke="var(--tp-muted)"
        strokeDasharray="4 3"
      />
      <g className="tp-bob tp-bob-1">
        <rect x="26" y="68" width="44" height="24" rx="4" fill="#1168bd" />
        <rect x="33" y="76" width="30" height="3" rx="1.5" fill="#fff" opacity="0.85" />
        <rect x="37" y="82" width="22" height="2.5" rx="1.25" fill="#fff" opacity="0.5" />
        <path d="M70 80 H78" {...line} markerEnd={`url(#${arrow})`} />
        {/* database */}
        <path d="M82 72 v18 a12 4 0 0 0 24 0 v-18" fill="#1168bd" />
        <ellipse cx="94" cy="72" rx="12" ry="4" fill="#3b82c4" />
      </g>
      {/* …which talks to outside systems. */}
      <path d="M116 80 H134" {...line} markerEnd={`url(#${arrow})`} />
      <g className="tp-bob tp-bob-2">
        <rect x="136" y="54" width="50" height="22" rx="4" fill="#8a8a8a" />
        <rect x="144" y="62" width="34" height="3" rx="1.5" fill="#fff" opacity="0.85" />
        <rect x="136" y="84" width="50" height="22" rx="4" fill="#8a8a8a" />
        <rect x="144" y="92" width="34" height="3" rx="1.5" fill="#fff" opacity="0.85" />
      </g>
    </>
  );
}

export function BpmnArt({ arrow }: { arrow: string }) {
  return (
    <>
      {/* Two swimlanes. */}
      <g stroke="var(--tp-border)" fill="var(--tp-surface)">
        <rect x="8" y="12" width="184" height="46" rx="4" />
        <rect x="8" y="62" width="184" height="46" rx="4" />
      </g>
      <rect
        x="8"
        y="12"
        width="12"
        height="46"
        rx="3"
        fill="var(--tp-surface-2)"
        stroke="var(--tp-border)"
      />
      <rect
        x="8"
        y="62"
        width="12"
        height="46"
        rx="3"
        fill="var(--tp-surface-2)"
        stroke="var(--tp-border)"
      />
      <rect x="12.5" y="25" width="3" height="20" rx="1.5" fill="var(--tp-muted)" opacity="0.6" />
      <rect x="12.5" y="75" width="3" height="20" rx="1.5" fill="var(--tp-muted)" opacity="0.6" />

      <g className="tp-bob">
        {/* start event → task */}
        <circle cx="36" cy="35" r="8" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.6" />
        <path d="M44 35 H54" {...line} markerEnd={`url(#${arrow})`} />
        <rect
          x="56"
          y="25"
          width="36"
          height="20"
          rx="5"
          fill="#eff6ff"
          stroke="#2563eb"
          strokeWidth="1.3"
        />
        <path d="M74 45 V73" {...line} markerEnd={`url(#${arrow})`} />
      </g>
      <g className="tp-bob tp-bob-1">
        {/* gateway (decision) in the second lane */}
        <path d="M74 74 L86 85 L74 96 L62 85 Z" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1.3" />
        <path d="M86 85 H104" {...line} markerEnd={`url(#${arrow})`} />
        <rect
          x="106"
          y="75"
          width="36"
          height="20"
          rx="5"
          fill="#eff6ff"
          stroke="#2563eb"
          strokeWidth="1.3"
        />
        <path d="M74 74 C 90 52, 120 40, 128 40" {...line} markerEnd={`url(#${arrow})`} />
      </g>
      <g className="tp-bob tp-bob-2">
        <rect
          x="130"
          y="28"
          width="36"
          height="20"
          rx="5"
          fill="#eff6ff"
          stroke="#2563eb"
          strokeWidth="1.3"
        />
        <path d="M142 85 H164" {...line} markerEnd={`url(#${arrow})`} />
        {/* end event */}
        <circle cx="173" cy="85" r="8" fill="#fee2e2" stroke="#dc2626" strokeWidth="3" />
      </g>
    </>
  );
}
