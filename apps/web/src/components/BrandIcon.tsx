/**
 * The Gramify logo mark, drawn inline so its gray follows the app theme
 * (the same artwork as /public/brand/icon.svg).
 */
export function BrandIcon({ className }: { className?: string }) {
  const g = 'var(--tp-wordmark)';
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <g stroke={g} strokeWidth="4.5" strokeLinecap="round" strokeDasharray="6 8">
        <path d="M29 38 V106" />
        <path d="M91 38 V106" />
      </g>
      <rect x="11" y="12" width="36" height="24" rx="9" fill="#00AEEF" />
      <rect x="73" y="12" width="36" height="24" rx="9" fill="#0089C7" />
      <path d="M32 56 H82" stroke="#00AEEF" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M78 47 L90 56 L78 65 Z"
        fill="#00AEEF"
        stroke="#00AEEF"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M88 84 H38" stroke={g} strokeWidth="7" strokeLinecap="round" />
      <path d="M42 75 L30 84 L42 93 Z" fill={g} stroke={g} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
