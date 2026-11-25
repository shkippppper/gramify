import { useId, type ReactNode } from 'react';
import { BpmnArt, C4Art } from './TemplateArt';

/**
 * One illustration per diagram type, in the same style as the new-board picker: theme colors,
 * placeholder bars instead of text, and parts that float on hover (`tp-bob`). Keyed by the
 * sample family's id (see editor/samples.ts).
 */
export function DiagramArt({ id, compact = false }: { id: string; compact?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const arrow = `tp-da-arrow-${uid}`;
  const dots = `tp-da-dots-${uid}`;
  const draw = ART[id] ?? ART.flowchart!;
  return (
    <svg
      viewBox="0 0 200 120"
      className="block h-full w-full"
      aria-hidden="true"
      data-art={ART[id] ? id : 'flowchart'}
    >
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
      {!compact && <rect width="200" height="120" fill={`url(#${dots})`} />}
      {draw(`url(#${arrow})`)}
    </svg>
  );
}

// ---- palette (fills are light tints that read on both themes) ----
const A = 'var(--tp-accent)';
const AFG = 'var(--tp-accent-fg)';
const S = 'var(--tp-surface)';
const S2 = 'var(--tp-surface-2)';
const BD = 'var(--tp-border)';
const M = 'var(--tp-muted)';
const FG = 'var(--tp-fg)';
const BLUE = ['#2563eb', '#eff6ff'] as const;
const GREEN = ['#16a34a', '#dcfce7'] as const;
const AMBER = ['#ca8a04', '#fef9c3'] as const;
const RED = ['#dc2626', '#fee2e2'] as const;
const VIOLET = ['#8b5cf6', '#ede9fe'] as const;
const PINK = ['#db2777', '#fce7f3'] as const;
const ORANGE = ['#ea580c', '#ffedd5'] as const;
const TEAL = ['#0d9488', '#ccfbf1'] as const;

const line = { stroke: M, strokeWidth: 1.2, fill: 'none' } as const;
const dashed = { ...line, strokeDasharray: '3 3' } as const;

/** A placeholder for a line of text. */
function Bar({
  x,
  y,
  w,
  h = 3.5,
  fill = M,
  o = 0.55,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
  o?: number;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} opacity={o} />;
}

/** A box with a tinted header band and a few rows (class, table, requirement). */
function Table({
  x,
  y,
  w,
  h,
  color,
  rows = 3,
  split = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: readonly [string, string];
  rows?: number;
  split?: boolean;
}) {
  const head = 12;
  const step = (h - head - 6) / rows;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={S} stroke={color[0]} strokeWidth="1.3" />
      <path d={`M${x} ${y + head} H${x + w}`} stroke={color[0]} strokeWidth="1" />
      <rect x={x + 0.6} y={y + 0.6} width={w - 1.2} height={head - 0.6} rx="3.5" fill={color[1]} />
      <Bar x={x + w / 2 - w * 0.22} y={y + 4.2} w={w * 0.44} fill={color[0]} o={0.8} />
      {Array.from({ length: rows }, (_, i) => (
        <Bar key={i} x={x + 6} y={y + head + 5 + i * step} w={(w - 12) * (i % 2 ? 0.55 : 0.75)} />
      ))}
      {split && (
        <path
          d={`M${x} ${y + head + 5 + step * 2 - 3} H${x + w}`}
          stroke={color[0]}
          strokeWidth="0.8"
          opacity="0.6"
        />
      )}
    </>
  );
}

function pieSlice(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [
    cx + r * Math.cos((a * Math.PI) / 180),
    cy + r * Math.sin((a * Math.PI) / 180),
  ];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

/** A sankey flow between two node edges. */
function band(x1: number, a1: number, b1: number, x2: number, a2: number, b2: number) {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${a1} C${mx} ${a1} ${mx} ${a2} ${x2} ${a2} L${x2} ${b2} C${mx} ${b2} ${mx} ${b1} ${x1} ${b1} Z`;
}

function Face({ x, y, mood }: { x: number; y: number; mood: 1 | 0 | -1 }) {
  const mouth =
    mood === 1
      ? `M${x - 3.5} ${y + 1.5} Q${x} ${y + 5} ${x + 3.5} ${y + 1.5}`
      : mood === -1
        ? `M${x - 3.5} ${y + 4} Q${x} ${y + 0.5} ${x + 3.5} ${y + 4}`
        : `M${x - 3.5} ${y + 2.8} H${x + 3.5}`;
  return (
    <>
      <circle cx={x} cy={y} r="8" fill="#fde68a" stroke="#ca8a04" strokeWidth="1.2" />
      <circle cx={x - 2.8} cy={y - 2} r="1" fill="#713f12" />
      <circle cx={x + 2.8} cy={y - 2} r="1" fill="#713f12" />
      <path d={mouth} stroke="#713f12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}

const ART: Record<string, (arrow: string) => ReactNode> = {
  flowchart: (arrow) => (
    <>
      <g className="tp-bob">
        <rect x="78" y="8" width="44" height="18" rx="4" fill={S} stroke={A} strokeWidth="1.4" />
        <Bar x={88} y={15} w={24} fill={A} o={0.7} />
      </g>
      <path d="M100 26 V38" {...line} markerEnd={arrow} />
      <g className="tp-bob tp-bob-1">
        <path d="M100 40 L118 56 L100 72 L82 56 Z" fill={S} stroke={A} strokeWidth="1.4" />
      </g>
      <path d="M88 66 L66 88 M112 66 L134 88" {...line} markerEnd={arrow} />
      <g className="tp-bob tp-bob-2">
        <rect x="40" y="90" width="48" height="20" rx="4" fill={A} opacity="0.85" />
        <rect x="112" y="90" width="48" height="20" rx="10" fill={S} stroke={A} strokeWidth="1.4" />
        <Bar x={122} y={98} w={28} fill={A} o={0.6} />
      </g>
    </>
  ),

  class: () => (
    <>
      <g className="tp-bob">
        <Table x={70} y={6} w={60} h={44} color={VIOLET} split />
      </g>
      <path d="M54 72 V62 H146 V72 M100 62 V58" {...line} />
      <path d="M100 51 L95 58 H105 Z" fill={S} stroke={M} strokeWidth="1.2" />
      <g className="tp-bob tp-bob-1">
        <Table x={24} y={72} w={60} h={42} color={BLUE} rows={2} />
      </g>
      <g className="tp-bob tp-bob-2">
        <Table x={116} y={72} w={60} h={42} color={TEAL} rows={2} />
      </g>
    </>
  ),

  sequence: (arrow) => (
    <>
      <path d="M48 26 V114 M100 26 V114 M152 26 V114" {...dashed} />
      <g className="tp-bob">
        {[48, 100, 152].map((x) => (
          <g key={x}>
            <rect
              x={x - 20}
              y="8"
              width="40"
              height="18"
              rx="4"
              fill={S}
              stroke={A}
              strokeWidth="1.4"
            />
            <Bar x={x - 11} y={15} w={22} fill={A} o={0.7} />
          </g>
        ))}
      </g>
      <rect x="97" y="38" width="6" height="62" rx="1.5" fill={S} stroke={A} strokeWidth="1.1" />
      <g className="tp-bob tp-bob-1">
        <path d="M48 42 H95" {...line} strokeWidth={1.4} markerEnd={arrow} />
        <Bar x={60} y={35} w={22} />
        <path d="M103 58 H150" {...line} strokeWidth={1.4} markerEnd={arrow} />
        <Bar x={116} y={51} w={22} />
      </g>
      <g className="tp-bob tp-bob-2">
        <path d="M152 76 H105" {...dashed} strokeWidth={1.4} markerEnd={arrow} />
        <path d="M97 96 H50" {...dashed} strokeWidth={1.4} markerEnd={arrow} />
        <Bar x={60} y={89} w={26} />
      </g>
    </>
  ),

  'entity-relationship': () => (
    <>
      <path d="M80 58 H120" {...line} strokeWidth={1.4} />
      <path d="M86 53 V63 M90 53 V63" {...line} strokeWidth={1.4} />
      <path d="M112 58 L120 52 M112 58 L120 64" {...line} strokeWidth={1.4} />
      <circle cx="108" cy="58" r="2.6" fill={S} stroke={M} strokeWidth="1.2" />
      <g className="tp-bob">
        <Table x={18} y={30} w={62} h={56} color={PINK} rows={3} />
      </g>
      <g className="tp-bob tp-bob-1">
        <Table x={120} y={22} w={62} h={72} color={TEAL} rows={4} />
      </g>
    </>
  ),

  state: (arrow) => (
    <>
      <circle cx="20" cy="60" r="6" fill={FG} />
      <path d="M27 60 H38" {...line} markerEnd={arrow} />
      <g className="tp-bob">
        <rect
          x="40"
          y="48"
          width="46"
          height="24"
          rx="12"
          fill={BLUE[1]}
          stroke={BLUE[0]}
          strokeWidth="1.3"
        />
        <Bar x={52} y={58} w={22} fill={BLUE[0]} o={0.7} />
      </g>
      <path d="M86 60 H104" {...line} markerEnd={arrow} />
      <path d="M128 48 C 128 22, 63 22, 63 45" {...line} markerEnd={arrow} />
      <path d="M63 72 C 63 98, 128 98, 128 75" {...dashed} markerEnd={arrow} />
      <g className="tp-bob tp-bob-1">
        <rect
          x="106"
          y="48"
          width="46"
          height="24"
          rx="12"
          fill={GREEN[1]}
          stroke={GREEN[0]}
          strokeWidth="1.3"
        />
        <Bar x={118} y={58} w={22} fill={GREEN[0]} o={0.7} />
      </g>
      <path d="M152 60 H166" {...line} markerEnd={arrow} />
      <g className="tp-bob tp-bob-2">
        <circle cx="176" cy="60" r="8" fill="none" stroke={FG} strokeWidth="1.5" />
        <circle cx="176" cy="60" r="4.5" fill={FG} />
      </g>
    </>
  ),

  mindmap: () => {
    const nodes = [
      { x: 38, y: 22, c: GREEN, cls: 'tp-bob tp-bob-1' },
      { x: 34, y: 96, c: AMBER, cls: 'tp-bob tp-bob-2' },
      { x: 160, y: 20, c: VIOLET, cls: 'tp-bob tp-bob-2' },
      { x: 168, y: 62, c: PINK, cls: 'tp-bob' },
      { x: 150, y: 102, c: TEAL, cls: 'tp-bob tp-bob-1' },
    ];
    return (
      <>
        {nodes.map((n) => (
          <path
            key={`${n.x}-${n.y}`}
            d={`M100 60 Q ${(100 + n.x) / 2} ${n.y}, ${n.x} ${n.y}`}
            stroke={n.c[0]}
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />
        ))}
        {nodes.map((n) => (
          <g key={`n${n.x}`} className={n.cls}>
            <rect
              x={n.x - 17}
              y={n.y - 7}
              width="34"
              height="14"
              rx="7"
              fill={n.c[1]}
              stroke={n.c[0]}
              strokeWidth="1.2"
            />
            <Bar x={n.x - 9} y={n.y - 1.75} w={18} fill={n.c[0]} o={0.7} />
          </g>
        ))}
        <g className="tp-bob">
          <circle cx="100" cy="60" r="17" fill={A} />
          <Bar x={90} y={58} w={20} fill={AFG} o={0.9} />
        </g>
      </>
    );
  },

  architecture: () => {
    const Svc = ({ x, y, children }: { x: number; y: number; children: ReactNode }) => (
      <g>
        <rect x={x} y={y} width="28" height="28" rx="5" fill="#1168bd" />
        {children}
        <Bar x={x - 2} y={y + 32} w={32} />
      </g>
    );
    return (
      <>
        <rect
          x="18"
          y="10"
          width="164"
          height="102"
          rx="7"
          fill="none"
          stroke={M}
          strokeDasharray="4 3"
        />
        <rect x="24" y="15" width="10" height="7" rx="2" fill={A} opacity="0.8" />
        <Bar x={38} y={17} w={30} />
        <path d="M66 44 H132 M50 58 V74 M150 58 V74 M66 88 H132" {...line} strokeWidth={1.4} />
        <g className="tp-bob">
          <Svc x={36} y={30}>
            <path
              d="M42 38 H58 M42 44 H58 M42 50 H58"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svc>
        </g>
        <g className="tp-bob tp-bob-1">
          <Svc x={136} y={30}>
            <ellipse cx="150" cy="38" rx="7" ry="2.5" fill="none" stroke="#fff" strokeWidth="1.5" />
            <path
              d="M143 38 V50 A7 2.5 0 0 0 157 50 V38"
              fill="none"
              stroke="#fff"
              strokeWidth="1.5"
            />
          </Svc>
        </g>
        <g className="tp-bob tp-bob-2">
          <Svc x={36} y={74}>
            <circle cx="50" cy="88" r="7" fill="none" stroke="#fff" strokeWidth="1.5" />
            <path
              d="M43 88 H57 M50 81 C46 85 46 91 50 95 C54 91 54 85 50 81"
              fill="none"
              stroke="#fff"
              strokeWidth="1.2"
            />
          </Svc>
          <Svc x={136} y={74}>
            <rect
              x="143"
              y="82"
              width="14"
              height="12"
              rx="2"
              fill="none"
              stroke="#fff"
              strokeWidth="1.5"
            />
            <path d="M146 86 H154 M146 90 H151" stroke="#fff" strokeWidth="1.3" />
          </Svc>
        </g>
      </>
    );
  },

  block: (arrow) => (
    <>
      <g className="tp-bob">
        <rect x="16" y="10" width="52" height="26" rx="3" fill={S} stroke={A} strokeWidth="1.3" />
        <rect x="74" y="10" width="52" height="26" rx="3" fill={A} opacity="0.8" />
        <rect x="132" y="10" width="52" height="26" rx="3" fill={S} stroke={A} strokeWidth="1.3" />
      </g>
      <g className="tp-bob tp-bob-1">
        <rect
          x="16"
          y="44"
          width="110"
          height="26"
          rx="3"
          fill={VIOLET[1]}
          stroke={VIOLET[0]}
          strokeWidth="1.3"
        />
        <Bar x={52} y={55} w={38} fill={VIOLET[0]} o={0.7} />
        <rect x="132" y="44" width="52" height="26" rx="13" fill={S} stroke={A} strokeWidth="1.3" />
      </g>
      <path d="M71 70 V82" {...line} markerEnd={arrow} />
      <g className="tp-bob tp-bob-2">
        <path
          d="M16 84 H104 L120 97 L104 110 H16 Z"
          fill={GREEN[1]}
          stroke={GREEN[0]}
          strokeWidth="1.3"
        />
        <Bar x={36} y={95} w={44} fill={GREEN[0]} o={0.7} />
        <path d="M144 84 L184 84 L172 110 L132 110 Z" fill={S} stroke={A} strokeWidth="1.3" />
      </g>
    </>
  ),

  c4: (arrow) => <C4Art arrow={arrow.slice(5, -1)} />,

  bpmn: (arrow) => <BpmnArt arrow={arrow.slice(5, -1)} />,

  'cynefin-framework': () => {
    const Q = ({
      x,
      y,
      c,
      cls,
    }: {
      x: number;
      y: number;
      c: readonly [string, string];
      cls: string;
    }) => (
      <g className={cls}>
        <rect
          x={x}
          y={y}
          width="80"
          height="48"
          rx="10"
          fill={c[1]}
          stroke={c[0]}
          strokeWidth="1.2"
        />
        <circle cx={x + 12} cy={y + 12} r="4" fill={c[0]} opacity="0.8" />
        <Bar x={x + 20} y={y + 10.3} w={30} fill={c[0]} o={0.7} />
        <Bar x={x + 10} y={y + 26} w={52} />
        <Bar x={x + 10} y={y + 34} w={36} />
      </g>
    );
    return (
      <>
        <Q x={16} y={8} c={VIOLET} cls="tp-bob" />
        <Q x={104} y={8} c={BLUE} cls="tp-bob tp-bob-1" />
        <Q x={16} y={64} c={RED} cls="tp-bob tp-bob-2" />
        <Q x={104} y={64} c={GREEN} cls="tp-bob" />
        <circle
          cx="100"
          cy="60"
          r="13"
          fill={S2}
          stroke={M}
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        <path d="M94 60 Q97 56 100 60 T106 60" stroke={M} strokeWidth="1.2" fill="none" />
      </>
    );
  },

  'event-modeling': (arrow) => {
    const Note = ({ x, y, c }: { x: number; y: number; c: readonly [string, string] }) => (
      <>
        <rect
          x={x}
          y={y}
          width="26"
          height="24"
          rx="2"
          fill={c[1]}
          stroke={c[0]}
          strokeWidth="1.2"
        />
        <Bar x={x + 5} y={y + 7} w={16} fill={c[0]} o={0.7} />
        <Bar x={x + 5} y={y + 13} w={10} fill={c[0]} o={0.5} />
      </>
    );
    return (
      <>
        <path d="M8 40 H192 M8 80 H192" stroke={BD} strokeWidth="1" />
        <g className="tp-bob">
          {[22, 112].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="8"
                width="40"
                height="26"
                rx="3"
                fill={S}
                stroke={M}
                strokeWidth="1.1"
              />
              <path d={`M${x} 14 H${x + 40}`} stroke={M} strokeWidth="0.8" />
              <Bar x={x + 5} y={19} w={22} />
              <rect x={x + 26} y="24" width="10" height="6" rx="1.5" fill={A} opacity="0.8" />
            </g>
          ))}
        </g>
        <g className="tp-bob tp-bob-1">
          <Note x={40} y={48} c={BLUE} />
          <Note x={130} y={48} c={GREEN} />
        </g>
        <g className="tp-bob tp-bob-2">
          <Note x={78} y={88} c={ORANGE} />
          <Note x={164} y={88} c={ORANGE} />
        </g>
        <path
          d="M42 34 L50 46 M66 64 L80 86 M104 96 C120 96 128 86 138 74 M143 48 L136 36"
          {...line}
          markerEnd={arrow}
        />
      </>
    );
  },

  gantt: () => {
    const rows = [24, 42, 60, 78, 96];
    return (
      <>
        <path d="M60 14 V108 M95 14 V108 M130 14 V108 M165 14 V108" {...dashed} opacity={0.6} />
        {[60, 95, 130, 165].map((x) => (
          <Bar key={x} x={x - 7} y={7} w={14} h={3} />
        ))}
        {rows.map((y) => (
          <Bar key={y} x={14} y={y + 3} w={34} />
        ))}
        <g className="tp-bob">
          <rect x="60" y="22" width="42" height="10" rx="3" fill={A} opacity="0.85" />
          <rect x="88" y="40" width="54" height="10" rx="3" fill={A} opacity="0.6" />
        </g>
        <g className="tp-bob tp-bob-1">
          <rect x="112" y="58" width="34" height="10" rx="3" fill={RED[0]} opacity="0.75" />
          <rect x="128" y="76" width="44" height="10" rx="3" fill={A} opacity="0.85" />
        </g>
        <g className="tp-bob tp-bob-2">
          <path d="M178 94 L184 100 L178 106 L172 100 Z" fill={VIOLET[0]} />
        </g>
        <path d="M120 14 V110" stroke={RED[0]} strokeWidth="1.3" strokeDasharray="4 2" />
      </>
    );
  },

  git: () => {
    const commit = (x: number, y: number, c: string, filled = false) => (
      <circle cx={x} cy={y} r="6" fill={filled ? c : S} stroke={c} strokeWidth="2.5" />
    );
    return (
      <>
        <path d="M14 82 H186" stroke={A} strokeWidth="3" />
        <path
          d="M58 82 C 70 82, 70 42, 84 42 H118 C 132 42, 132 82, 146 82"
          stroke={VIOLET[0]}
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M104 42 C 112 42, 112 18, 124 18 H150"
          stroke={GREEN[0]}
          strokeWidth="3"
          fill="none"
          opacity="0.85"
        />
        <g className="tp-bob">
          {commit(28, 82, A)}
          {commit(58, 82, A)}
          {commit(146, 82, A, true)}
          {commit(176, 82, A)}
        </g>
        <g className="tp-bob tp-bob-1">
          {commit(90, 42, VIOLET[0])}
          {commit(116, 42, VIOLET[0])}
        </g>
        <g className="tp-bob tp-bob-2">
          {commit(150, 18, GREEN[0])}
          <path
            d="M164 96 h14 l5 5 -5 5 h-14 z"
            fill={AMBER[1]}
            stroke={AMBER[0]}
            strokeWidth="1.1"
          />
          <path d="M176 88 V96" stroke={M} strokeWidth="1" />
        </g>
      </>
    );
  },

  ishikawa: (arrow) => (
    <>
      <path d="M16 60 H148" stroke={M} strokeWidth="2" fill="none" markerEnd={arrow} />
      <g className="tp-bob tp-bob-2">
        <rect
          x="150"
          y="44"
          width="38"
          height="32"
          rx="5"
          fill={RED[1]}
          stroke={RED[0]}
          strokeWidth="1.4"
        />
        <Bar x={158} y={58} w={22} fill={RED[0]} o={0.7} />
      </g>
      <g className="tp-bob">
        {[26, 70, 114].map((x) => (
          <g key={x}>
            <path d={`M${x} 18 L${x + 24} 58`} {...line} strokeWidth={1.5} />
            <rect x={x - 14} y="8" width="28" height="10" rx="5" fill={A} opacity="0.8" />
            <path d={`M${x + 8} 32 H${x - 6} M${x + 15} 44 H${x + 1}`} {...line} />
          </g>
        ))}
      </g>
      <g className="tp-bob tp-bob-1">
        {[26, 70, 114].map((x) => (
          <g key={x}>
            <path d={`M${x} 102 L${x + 24} 62`} {...line} strokeWidth={1.5} />
            <rect
              x={x - 14}
              y="102"
              width="28"
              height="10"
              rx="5"
              fill={VIOLET[0]}
              opacity="0.75"
            />
            <path d={`M${x + 8} 88 H${x - 6} M${x + 15} 76 H${x + 1}`} {...line} />
          </g>
        ))}
      </g>
    </>
  ),

  kanban: () => {
    const cols = [
      { x: 12, c: VIOLET, cards: 3 },
      { x: 74, c: AMBER, cards: 2 },
      { x: 136, c: GREEN, cards: 1 },
    ];
    return (
      <>
        {cols.map((col) => (
          <g key={col.x}>
            <rect x={col.x} y="8" width="52" height="104" rx="6" fill={S2} stroke={BD} />
            <rect
              x={col.x + 6}
              y="14"
              width="40"
              height="6"
              rx="3"
              fill={col.c[0]}
              opacity="0.75"
            />
          </g>
        ))}
        {cols.map((col, ci) =>
          Array.from({ length: col.cards }, (_, i) => (
            <g
              key={`${col.x}-${i}`}
              className={`tp-bob ${['', 'tp-bob-1', 'tp-bob-2'][(ci + i) % 3]}`}
            >
              <rect
                x={col.x + 5}
                y={28 + i * 26}
                width="42"
                height="20"
                rx="3"
                fill={S}
                stroke={BD}
              />
              <rect x={col.x + 5} y={28 + i * 26} width="3" height="20" rx="1.5" fill={col.c[0]} />
              <Bar x={col.x + 12} y={33 + i * 26} w={28} />
              <Bar x={col.x + 12} y={40 + i * 26} w={16} o={0.35} />
            </g>
          )),
        )}
      </>
    );
  },

  packet: () => {
    const rows = [
      [80, 80],
      [40, 40, 80],
      [20, 60, 40, 40],
    ];
    const tints = [A, VIOLET[0], TEAL[0], AMBER[0]];
    return (
      <>
        <path d="M20 16 H180" stroke={M} strokeWidth="1" />
        {Array.from({ length: 17 }, (_, i) => (
          <path key={i} d={`M${20 + i * 10} ${i % 4 ? 13 : 10} V16`} stroke={M} strokeWidth="1" />
        ))}
        {rows.map((widths, r) => {
          let x = 20;
          return (
            <g key={r} className={`tp-bob ${['', 'tp-bob-1', 'tp-bob-2'][r]}`}>
              {widths.map((w, i) => {
                const el = (
                  <g key={i}>
                    <rect
                      x={x}
                      y={22 + r * 31}
                      width={w}
                      height="27"
                      fill={(r + i) % 3 === 0 ? tints[(r + i) % 4] : S}
                      fillOpacity={(r + i) % 3 === 0 ? 0.18 : 1}
                      stroke={tints[(r + i) % 4]}
                      strokeWidth="1.2"
                    />
                    <Bar
                      x={x + w / 2 - Math.min(14, w / 3)}
                      y={33.5 + r * 31}
                      w={Math.min(28, (w * 2) / 3)}
                    />
                  </g>
                );
                x += w;
                return el;
              })}
            </g>
          );
        })}
      </>
    );
  },

  pie: () => (
    <>
      <g className="tp-bob">
        <path d={pieSlice(78, 60, 44, -90, 60)} fill={A} opacity="0.9" />
        <path d={pieSlice(78, 60, 44, 60, 170)} fill={VIOLET[0]} opacity="0.85" />
        <path d={pieSlice(78, 60, 44, 170, 230)} fill={AMBER[0]} opacity="0.85" />
      </g>
      <g className="tp-bob tp-bob-1">
        <path
          d={pieSlice(72, 56, 44, 230, 270)}
          fill={GREEN[0]}
          opacity="0.85"
          transform="translate(-4 -4)"
        />
      </g>
      <g className="tp-bob tp-bob-2">
        {[A, VIOLET[0], AMBER[0], GREEN[0]].map((c, i) => (
          <g key={c}>
            <rect x="140" y={32 + i * 16} width="8" height="8" rx="2" fill={c} />
            <Bar x={152} y={34.2 + i * 16} w={[30, 24, 18, 14][i]!} />
          </g>
        ))}
      </g>
    </>
  ),

  quadrant: () => (
    <>
      <rect x="50" y="10" width="50" height="48" fill={VIOLET[0]} opacity="0.12" />
      <rect x="100" y="10" width="50" height="48" fill={GREEN[0]} opacity="0.14" />
      <rect x="50" y="58" width="50" height="48" fill={RED[0]} opacity="0.1" />
      <rect x="100" y="58" width="50" height="48" fill={AMBER[0]} opacity="0.13" />
      <path d="M100 10 V106 M50 58 H150" stroke={BD} strokeWidth="1.2" />
      <path d="M50 108 V8 M48 106 H152" stroke={M} strokeWidth="1.4" fill="none" />
      <Bar x={160} y={104} w={20} />
      <Bar x={24} y={10} w={20} />
      <g className="tp-bob">
        <circle cx="122" cy="28" r="4" fill={A} />
        <circle cx="136" cy="44" r="4" fill={A} />
      </g>
      <g className="tp-bob tp-bob-1">
        <circle cx="70" cy="34" r="4" fill={A} />
        <circle cx="116" cy="80" r="4" fill={A} />
      </g>
      <g className="tp-bob tp-bob-2">
        <circle cx="66" cy="88" r="4" fill={A} />
        <circle cx="84" cy="72" r="4" fill={A} />
      </g>
    </>
  ),

  radar: () => {
    const pt = (r: number, i: number) => {
      const a = ((-90 + i * 60) * Math.PI) / 180;
      return `${100 + r * Math.cos(a)},${60 + r * Math.sin(a)}`;
    };
    const poly = (rs: number[]) => rs.map((r, i) => pt(r, i)).join(' ');
    return (
      <>
        {[16, 32, 48].map((r) => (
          <polygon
            key={r}
            points={poly([r, r, r, r, r, r])}
            fill="none"
            stroke={BD}
            strokeWidth="1"
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M100 60 L${pt(48, i)}`} stroke={BD} strokeWidth="1" />
        ))}
        <g className="tp-bob">
          <polygon
            points={poly([44, 30, 38, 20, 34, 40])}
            fill={A}
            fillOpacity="0.25"
            stroke={A}
            strokeWidth="1.6"
          />
        </g>
        <g className="tp-bob tp-bob-1">
          <polygon
            points={poly([26, 42, 22, 38, 18, 26])}
            fill={PINK[0]}
            fillOpacity="0.2"
            stroke={PINK[0]}
            strokeWidth="1.6"
          />
        </g>
      </>
    );
  },

  railroad: () => {
    const track = { stroke: M, strokeWidth: 1.6, fill: 'none' } as const;
    return (
      <>
        <path d="M12 52 V68 M16 52 V68 M184 52 V68 M188 52 V68" stroke={M} strokeWidth="1.6" />
        <path d="M16 60 H44 M80 60 H96 M140 60 H184" {...track} />
        <path d="M96 60 C 106 60, 106 32, 116 32 M140 60 C 130 60, 130 32, 120 32" {...track} />
        <path
          d="M150 60 C 160 60, 160 94, 150 94 H76 C 66 94, 66 60, 76 60"
          {...track}
          strokeDasharray="0"
          opacity="0.7"
        />
        <g className="tp-bob">
          <rect
            x="44"
            y="51"
            width="36"
            height="18"
            rx="9"
            fill={GREEN[1]}
            stroke={GREEN[0]}
            strokeWidth="1.3"
          />
          <Bar x={52} y={58.2} w={20} fill={GREEN[0]} o={0.7} />
        </g>
        <g className="tp-bob tp-bob-1">
          <rect
            x="100"
            y="51"
            width="40"
            height="18"
            rx="2"
            fill={BLUE[1]}
            stroke={BLUE[0]}
            strokeWidth="1.3"
          />
          <Bar x={108} y={58.2} w={24} fill={BLUE[0]} o={0.7} />
        </g>
        <g className="tp-bob tp-bob-2">
          <rect
            x="102"
            y="23"
            width="36"
            height="18"
            rx="9"
            fill={GREEN[1]}
            stroke={GREEN[0]}
            strokeWidth="1.3"
          />
          <Bar x={110} y={30.2} w={20} fill={GREEN[0]} o={0.7} />
        </g>
      </>
    );
  },

  requirement: (arrow) => (
    <>
      <g className="tp-bob">
        <Table x={14} y={20} w={72} h={80} color={VIOLET} rows={4} />
      </g>
      <path d="M126 60 H90" {...dashed} strokeWidth={1.4} markerEnd={arrow} />
      <rect x="94" y="46" width="28" height="9" rx="4.5" fill={S2} stroke={BD} />
      <Bar x={99} y={48.8} w={18} />
      <g className="tp-bob tp-bob-1">
        <rect
          x="126"
          y="36"
          width="60"
          height="48"
          rx="8"
          fill={TEAL[1]}
          stroke={TEAL[0]}
          strokeWidth="1.3"
        />
        <Bar x={138} y={50} w={36} fill={TEAL[0]} o={0.7} />
        <Bar x={138} y={60} w={26} />
        <Bar x={138} y={68} w={30} />
      </g>
    </>
  ),

  sankey: () => (
    <>
      <path d={band(28, 14, 54, 96, 20, 60)} fill={BLUE[0]} opacity="0.3" />
      <path d={band(28, 54, 64, 96, 68, 78)} fill={BLUE[0]} opacity="0.3" />
      <path d={band(28, 72, 106, 96, 78, 112)} fill={GREEN[0]} opacity="0.3" />
      <path d={band(104, 20, 48, 172, 10, 38)} fill={VIOLET[0]} opacity="0.3" />
      <path d={band(104, 48, 60, 172, 44, 56)} fill={VIOLET[0]} opacity="0.3" />
      <path d={band(104, 68, 86, 172, 56, 74)} fill={AMBER[0]} opacity="0.3" />
      <path d={band(104, 86, 112, 172, 82, 108)} fill={AMBER[0]} opacity="0.3" />
      <g className="tp-bob">
        <rect x="20" y="14" width="8" height="50" rx="1.5" fill={BLUE[0]} />
        <rect x="20" y="72" width="8" height="34" rx="1.5" fill={GREEN[0]} />
      </g>
      <g className="tp-bob tp-bob-1">
        <rect x="96" y="20" width="8" height="40" rx="1.5" fill={VIOLET[0]} />
        <rect x="96" y="68" width="8" height="44" rx="1.5" fill={AMBER[0]} />
      </g>
      <g className="tp-bob tp-bob-2">
        <rect x="172" y="10" width="8" height="28" rx="1.5" fill={A} />
        <rect x="172" y="44" width="8" height="30" rx="1.5" fill={PINK[0]} />
        <rect x="172" y="82" width="8" height="26" rx="1.5" fill={TEAL[0]} />
      </g>
    </>
  ),

  timeline: (arrow) => {
    const items = [
      { x: 38, up: true, c: A },
      { x: 80, up: false, c: VIOLET[0] },
      { x: 122, up: true, c: GREEN[0] },
      { x: 164, up: false, c: AMBER[0] },
    ];
    return (
      <>
        <path d="M10 60 H188" stroke={M} strokeWidth="2" fill="none" markerEnd={arrow} />
        {items.map((it, i) => (
          <g key={it.x} className={`tp-bob ${['', 'tp-bob-1', 'tp-bob-2', 'tp-bob-1'][i]}`}>
            <path
              d={it.up ? `M${it.x} 44 V54` : `M${it.x} 66 V76`}
              stroke={it.c}
              strokeWidth="1.4"
            />
            <rect
              x={it.x - 20}
              y={it.up ? 14 : 76}
              width="40"
              height="30"
              rx="4"
              fill={S}
              stroke={it.c}
              strokeWidth="1.3"
            />
            <Bar x={it.x - 13} y={it.up ? 21 : 83} w={26} fill={it.c} o={0.75} />
            <Bar x={it.x - 13} y={it.up ? 29 : 91} w={18} />
            <circle cx={it.x} cy="60" r="5" fill={it.c} stroke={S} strokeWidth="1.5" />
          </g>
        ))}
      </>
    );
  },

  treemap: () => (
    <g stroke={S2} strokeWidth="2.5">
      <g className="tp-bob">
        <rect x="14" y="10" width="96" height="58" rx="3" fill={A} opacity="0.85" />
      </g>
      <g className="tp-bob tp-bob-1">
        <rect x="14" y="68" width="56" height="42" rx="3" fill={VIOLET[0]} opacity="0.75" />
        <rect x="70" y="68" width="40" height="42" rx="3" fill={GREEN[0]} opacity="0.7" />
        <rect x="110" y="10" width="76" height="36" rx="3" fill={AMBER[0]} opacity="0.7" />
      </g>
      <g className="tp-bob tp-bob-2">
        <rect x="110" y="46" width="44" height="34" rx="3" fill={TEAL[0]} opacity="0.7" />
        <rect x="154" y="46" width="32" height="34" rx="3" fill={PINK[0]} opacity="0.65" />
        <rect x="110" y="80" width="76" height="30" rx="3" fill={BLUE[0]} opacity="0.6" />
      </g>
    </g>
  ),

  treeview: () => {
    const rows = [
      { d: 0, folder: true, w: 40 },
      { d: 1, folder: true, w: 30 },
      { d: 2, folder: false, w: 44 },
      { d: 2, folder: false, w: 34 },
      { d: 1, folder: true, w: 26 },
      { d: 2, folder: false, w: 38 },
    ];
    const folder = (x: number, y: number) => (
      <path
        d={`M${x} ${y - 5} h5 l2 2 h7 a1.5 1.5 0 0 1 1.5 1.5 v8 a1.5 1.5 0 0 1 -1.5 1.5 h-12.5 a1.5 1.5 0 0 1 -1.5 -1.5 v-10 a1.5 1.5 0 0 1 1 -1.5 z`}
        fill="#fbbf24"
        stroke={AMBER[0]}
        strokeWidth="0.8"
      />
    );
    const file = (x: number, y: number) => (
      <path d={`M${x} ${y - 6} h7 l4 4 v10 h-11 z`} fill={S} stroke={M} strokeWidth="1" />
    );
    return (
      <>
        <path
          d="M44 22 V88 M44 40 H54 M44 94 H54 M44 88 V94 M60 46 V76 M60 58 H70 M60 76 H70 M60 112 H70 M60 100 V112"
          stroke={BD}
          strokeWidth="1.2"
          fill="none"
        />
        {rows.map((r, i) => {
          const x = 36 + r.d * 16;
          const y = 18 + i * 18;
          return (
            <g key={i} className={`tp-bob ${['', 'tp-bob-1', 'tp-bob-2'][i % 3]}`}>
              {r.folder ? folder(x, y) : file(x + 2, y)}
              <Bar
                x={x + 20}
                y={y - 1}
                w={r.w}
                fill={r.folder ? FG : M}
                o={r.folder ? 0.55 : 0.45}
              />
            </g>
          );
        })}
      </>
    );
  },

  'use-case': () => (
    <>
      <g className="tp-bob">
        <circle cx="26" cy="40" r="7" fill="none" stroke={FG} strokeWidth="1.5" />
        <path
          d="M26 47 V72 M14 56 H38 M26 72 L16 88 M26 72 L36 88"
          stroke={FG}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <rect x="62" y="8" width="128" height="104" rx="8" fill={S} stroke={M} strokeWidth="1.2" />
      <Bar x={70} y={14} w={30} />
      <path d="M38 56 L84 36 M38 58 L84 64 M38 60 L84 92" {...line} />
      {[36, 64, 92].map((y, i) => (
        <g key={y} className={`tp-bob ${['tp-bob-1', 'tp-bob-2', 'tp-bob-1'][i]}`}>
          <ellipse
            cx="126"
            cy={y}
            rx="42"
            ry="11"
            fill={BLUE[1]}
            stroke={BLUE[0]}
            strokeWidth="1.3"
          />
          <Bar x={108} y={y - 1.75} w={36} fill={BLUE[0]} o={0.7} />
        </g>
      ))}
    </>
  ),

  'user-journey': () => {
    const faces: { x: number; y: number; m: 1 | 0 | -1 }[] = [
      { x: 30, y: 34, m: 1 },
      { x: 58, y: 48, m: 0 },
      { x: 86, y: 78, m: -1 },
      { x: 114, y: 58, m: 0 },
      { x: 142, y: 40, m: 1 },
      { x: 170, y: 30, m: 1 },
    ];
    return (
      <>
        <rect x="16" y="8" width="56" height="8" rx="4" fill={VIOLET[0]} opacity="0.7" />
        <rect x="72" y="8" width="56" height="8" rx="4" fill={AMBER[0]} opacity="0.7" />
        <rect x="128" y="8" width="56" height="8" rx="4" fill={GREEN[0]} opacity="0.7" />
        <polyline
          points={faces.map((f) => `${f.x},${f.y}`).join(' ')}
          fill="none"
          stroke={M}
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
        {faces.map((f, i) => (
          <g key={f.x}>
            <path d={`M${f.x} ${f.y + 9} V100`} stroke={BD} strokeWidth="1" />
            <Bar x={f.x - 10} y={104} w={20} />
            <g className={`tp-bob ${['', 'tp-bob-1', 'tp-bob-2'][i % 3]}`}>
              <Face x={f.x} y={f.y} mood={f.m} />
            </g>
          </g>
        ))}
      </>
    );
  },

  venn: () => (
    <>
      <g className="tp-bob">
        <circle cx="80" cy="48" r="32" fill={A} fillOpacity="0.25" stroke={A} strokeWidth="1.5" />
      </g>
      <g className="tp-bob tp-bob-1">
        <circle
          cx="120"
          cy="48"
          r="32"
          fill={VIOLET[0]}
          fillOpacity="0.25"
          stroke={VIOLET[0]}
          strokeWidth="1.5"
        />
      </g>
      <g className="tp-bob tp-bob-2">
        <circle
          cx="100"
          cy="80"
          r="32"
          fill={PINK[0]}
          fillOpacity="0.22"
          stroke={PINK[0]}
          strokeWidth="1.5"
        />
      </g>
    </>
  ),

  'wardley-maps': (arrow) => {
    const nodes = [
      [44, 20],
      [72, 42],
      [122, 52],
      [96, 76],
      [160, 92],
      [174, 66],
    ];
    return (
      <>
        <path d="M20 110 V8 M20 110 H190" stroke={M} strokeWidth="1.4" fill="none" />
        <path d="M62 12 V108 M104 12 V108 M146 12 V108" {...dashed} opacity={0.6} />
        <path d="M44 20 L72 42 L122 52 M72 42 L96 76 L160 92 M122 52 L174 66" {...line} />
        <path
          d="M100 76 H138"
          stroke={RED[0]}
          strokeWidth="1.3"
          strokeDasharray="4 2"
          fill="none"
          markerEnd={arrow}
        />
        {nodes.map(([x, y], i) => (
          <g key={i} className={`tp-bob ${['', 'tp-bob-1', 'tp-bob-2'][i % 3]}`}>
            <circle cx={x} cy={y} r="5" fill={i === 0 ? FG : S} stroke={FG} strokeWidth="1.5" />
            <Bar x={x! + 8} y={y! - 1.75} w={18} />
          </g>
        ))}
      </>
    );
  },

  xy: () => {
    const bars = [36, 58, 44, 72, 64];
    return (
      <>
        <path d="M26 20 H186 M26 44 H186 M26 68 H186" {...dashed} opacity={0.5} />
        <path d="M26 8 V104 H188" stroke={M} strokeWidth="1.4" fill="none" />
        <g className="tp-bob">
          {bars.map((h, i) => (
            <rect
              key={i}
              x={38 + i * 30}
              y={104 - h}
              width="18"
              height={h}
              rx="2"
              fill={A}
              opacity="0.8"
            />
          ))}
        </g>
        <g className="tp-bob tp-bob-1">
          <polyline
            points={bars.map((h, i) => `${47 + i * 30},${96 - h - 4 + (i % 2 ? -6 : 4)}`).join(' ')}
            fill="none"
            stroke={VIOLET[0]}
            strokeWidth="2"
          />
          {bars.map((h, i) => (
            <circle
              key={i}
              cx={47 + i * 30}
              cy={96 - h - 4 + (i % 2 ? -6 : 4)}
              r="3"
              fill={VIOLET[0]}
            />
          ))}
        </g>
      </>
    );
  },

  zenuml: (arrow) => (
    <>
      <path d="M36 30 V114 M100 30 V114 M164 30 V114" {...dashed} />
      <g className="tp-bob">
        <circle cx="36" cy="12" r="5" fill="none" stroke={FG} strokeWidth="1.4" />
        <path
          d="M36 17 V24 M30 20 H42 M36 24 L31 30 M36 24 L41 30"
          stroke={FG}
          strokeWidth="1.4"
          fill="none"
        />
        <rect x="86" y="8" width="28" height="20" rx="4" fill="#0747a6" />
        <Bar x={93} y={16} w={14} fill="#fff" o={0.85} />
        <rect
          x="150"
          y="8"
          width="28"
          height="20"
          rx="4"
          fill={GREEN[1]}
          stroke={GREEN[0]}
          strokeWidth="1.2"
        />
        <path d="M159 23 L164 13 L169 23" stroke={GREEN[0]} strokeWidth="1.5" fill="none" />
      </g>
      <g className="tp-bob tp-bob-1">
        <rect
          x="70"
          y="52"
          width="122"
          height="54"
          rx="4"
          fill="none"
          stroke={M}
          strokeWidth="1.1"
        />
        <path d="M70 62 H92 L96 58 V52" fill={S2} stroke={M} strokeWidth="1.1" />
        <Bar x={74} y={55} w={14} h={3} />
        <path d="M70 80 H192" {...dashed} opacity={0.7} />
      </g>
      <rect x="97" y="38" width="6" height="64" rx="1.5" fill={S} stroke={A} strokeWidth="1.1" />
      <g className="tp-bob tp-bob-2">
        <path d="M36 40 H95" {...line} strokeWidth={1.4} markerEnd={arrow} />
        <path d="M103 70 H162" {...line} strokeWidth={1.4} markerEnd={arrow} />
        <path d="M103 92 H162" {...line} strokeWidth={1.4} markerEnd={arrow} />
        <rect x="161" y="66" width="6" height="12" rx="1.5" fill={S} stroke={GREEN[0]} />
        <rect x="161" y="88" width="6" height="12" rx="1.5" fill={S} stroke={GREEN[0]} />
      </g>
    </>
  ),
};

/** Ids that have their own illustration (others fall back to the flowchart one). */
export const DIAGRAM_ART_IDS = Object.keys(ART);
