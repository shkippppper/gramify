import clsx from 'clsx';
import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOUR_VERSION, TOURS, type TourName, type TourStep } from './steps';

// ---- Persistence -------------------------------------------------------------
//
// In localStorage, per person: whether they ticked "Don't show this again" (which stops every
// automatic tour, What's new included; "Take the tour" still replays them), and per tour the
// version they last finished. Skipping without ticking the box brings the tour back on the next
// visit, but never twice in one browser session.

interface Saved {
  dontShow: boolean;
  seenVersion: number;
}

const storeKey = (userId: string, tour: TourName) => `tp-tour:${userId}:${tour}`;
const offKey = (userId: string) => `tp-tour:${userId}:off`;
const sessionKey = (userId: string, tour: TourName) => `tp-tour-shown:${userId}:${tour}`;
const PENDING_KEY = 'tp-tour-pending';
/** Set by the end-to-end tests so tours don't cover the UI they click. */
const OFF_KEY = 'tp-tour-off';

function readSaved(userId: string, tour: TourName): Saved {
  try {
    const raw = localStorage.getItem(storeKey(userId, tour));
    const v = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
    return {
      dontShow: v.dontShow === true || localStorage.getItem(offKey(userId)) === '1',
      seenVersion: typeof v.seenVersion === 'number' ? v.seenVersion : 0,
    };
  } catch {
    return { dontShow: false, seenVersion: 0 };
  }
}

function writeSaved(userId: string, tour: TourName, patch: Partial<Saved>) {
  try {
    if (patch.dontShow) localStorage.setItem(offKey(userId), '1');
    const next = { ...readSaved(userId, tour), ...patch };
    localStorage.setItem(storeKey(userId, tour), JSON.stringify(next));
  } catch {
    /* storage unavailable: the tour just shows again next time */
  }
}

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

// ---- Replay -----------------------------------------------------------------

const START_EVENT = 'tp:start-tour';
let mountedHosts = 0;

/**
 * Replay the tour of the current page. On a page without a tour (e.g. the playground) this
 * returns false; the caller then navigates to the library, which starts its tour on arrival.
 */
export function startTour(): boolean {
  if (mountedHosts > 0) {
    window.dispatchEvent(new Event(START_EVENT));
    return true;
  }
  safe(() => sessionStorage.setItem(PENDING_KEY, '1'), undefined);
  return false;
}

// ---- Host -------------------------------------------------------------------

interface Running {
  steps: TourStep[];
  whatsNew: boolean;
}

/**
 * Shows `tour` automatically the first time someone lands on the page (and again on later visits
 * until they finish it or tick "Don't show this again"). After new steps are added, people who
 * finished an older version see a short "What's new" tour with just those steps.
 */
export function TourHost({
  tour,
  userId,
  ready = true,
}: {
  tour: TourName;
  userId: string | undefined;
  /** Wait until the page has rendered the parts the tour points at. */
  ready?: boolean;
}) {
  const [running, setRunning] = useState<Running | null>(null);

  useEffect(() => {
    mountedHosts++;
    const onStart = () => setRunning({ steps: TOURS[tour], whatsNew: false });
    window.addEventListener(START_EVENT, onStart);
    return () => {
      mountedHosts--;
      window.removeEventListener(START_EVENT, onStart);
    };
  }, [tour]);

  useEffect(() => {
    if (!ready || !userId) return;
    let steps: TourStep[] = [];
    let whatsNew = false;
    if (safe(() => sessionStorage.getItem(PENDING_KEY), null)) {
      safe(() => sessionStorage.removeItem(PENDING_KEY), undefined);
      steps = TOURS[tour];
    } else {
      if (safe(() => localStorage.getItem(OFF_KEY), null)) return;
      if (safe(() => sessionStorage.getItem(sessionKey(userId, tour)), null)) return;
      const saved = readSaved(userId, tour);
      if (saved.dontShow || saved.seenVersion >= TOUR_VERSION) return;
      whatsNew = saved.seenVersion > 0;
      steps = TOURS[tour].filter((s) => s.since > saved.seenVersion);
    }
    if (!steps.length) return;
    // Let the page settle (fonts, first render of the diagram) before measuring targets.
    const t = setTimeout(() => setRunning({ steps, whatsNew }), 700);
    return () => clearTimeout(t);
  }, [ready, userId, tour]);

  const close = useCallback(
    (finished: boolean, dontShow: boolean) => {
      setRunning(null);
      if (!userId) return;
      safe(() => sessionStorage.setItem(sessionKey(userId, tour), '1'), undefined);
      const patch: Partial<Saved> = {};
      if (finished) patch.seenVersion = TOUR_VERSION;
      if (dontShow) patch.dontShow = true;
      if (finished || dontShow) writeSaved(userId, tour, patch);
    },
    [tour, userId],
  );

  if (!running) return null;
  return <Tour key={running.steps[0]?.id} {...running} onClose={close} />;
}

// ---- Spotlight --------------------------------------------------------------

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const GAP = 12;
const MARGIN = 12;

/** First visible element for a target (cards and nav items can exist more than once). */
function findTarget(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  // Clip to the viewport so a huge target (the editor pane) still leaves room for the card.
  const top = Math.max(r.top, MARGIN / 2);
  const left = Math.max(r.left, MARGIN / 2);
  const bottom = Math.min(r.bottom, window.innerHeight - MARGIN / 2);
  const right = Math.min(r.right, window.innerWidth - MARGIN / 2);
  return {
    top: top - PAD,
    left: left - PAD,
    width: Math.max(0, right - left) + PAD * 2,
    height: Math.max(0, bottom - top) + PAD * 2,
  };
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/** Where the card goes: below, above, right or left of the target, else over it; clamped. */
function placeCard(box: Box | null, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - w - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), vh - h - MARGIN);
  if (!box) return { top: (vh - h) / 2, left: (vw - w) / 2 };
  const cx = box.left + box.width / 2 - w / 2;
  const cy = box.top + box.height / 2 - h / 2;
  if (box.top + box.height + GAP + h <= vh - MARGIN)
    return { top: box.top + box.height + GAP, left: clampX(cx) };
  if (box.top - GAP - h >= MARGIN) return { top: box.top - GAP - h, left: clampX(cx) };
  if (box.left + box.width + GAP + w <= vw - MARGIN)
    return { top: clampY(cy), left: box.left + box.width + GAP };
  if (box.left - GAP - w >= MARGIN) return { top: clampY(cy), left: box.left - GAP - w };
  // Target fills the screen (e.g. the editor on a phone): sit inside it, near the bottom.
  return { top: clampY(box.top + box.height - h - GAP), left: clampX(cx) };
}

function Tour({
  steps,
  whatsNew,
  onClose,
}: Running & { onClose: (finished: boolean, dontShow: boolean) => void }) {
  const [i, setI] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[i]!;
  const last = i === steps.length - 1;

  // Bring the target into view, then follow it (it may scroll, resize or animate in).
  useEffect(() => {
    const el = findTarget(step.target);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    let frame = 0;
    let prev: Box | null = null;
    const tick = () => {
      const cur = findTarget(step.target);
      const next = cur ? boxOf(cur) : null;
      if (!sameBox(prev, next)) {
        prev = next;
        setBox(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step.target]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const place = () => setPos(placeCard(box, card.offsetWidth, card.offsetHeight));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [box, i]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [i]);

  const next = useCallback(() => {
    if (last) onClose(true, dontShow);
    else setI((n) => n + 1);
  }, [last, onClose, dontShow]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose(false, dontShow);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        back();
      } else if (e.key === 'Tab' && cardRef.current) {
        // Keep focus inside the card.
        const items = [...cardRef.current.querySelectorAll<HTMLElement>('button, input')].filter(
          (n) => !n.hasAttribute('disabled'),
        );
        const first = items[0];
        const end = items[items.length - 1];
        if (!cardRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          end?.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [next, back, onClose, dontShow]);

  return createPortal(
    <div className="fixed inset-0 z-[70]" data-testid="tour">
      {/* Click shield: the page underneath stays still while the tour is open. */}
      <div className="absolute inset-0" aria-hidden />
      {box ? (
        <div
          aria-hidden
          className="tp-fade pointer-events-none fixed rounded-xl ring-2 ring-accent/70 transition-all duration-300 ease-out"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.5)',
          }}
        />
      ) : (
        <div aria-hidden className="tp-fade pointer-events-none fixed inset-0 bg-black/50" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-tour-title"
        aria-describedby="tp-tour-body"
        className={clsx(
          'fixed w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-surface p-4 text-fg shadow-2xl',
          'transition-[top,left,opacity] duration-300 ease-out',
          pos ? 'opacity-100' : 'opacity-0',
        )}
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {whatsNew && (
              <span className="mb-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                What’s new
              </span>
            )}
            <h2 id="tp-tour-title" className="text-sm font-semibold">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close tour"
            onClick={() => onClose(false, dontShow)}
            className="-mt-1 -mr-1 rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>
        <p
          key={step.id}
          id="tp-tour-body"
          className="tp-fade mt-1.5 text-sm leading-relaxed text-muted"
          aria-live="polite"
        >
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1" aria-hidden>
            {steps.map((s, n) => (
              <span
                key={s.id}
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  n === i ? 'w-4 bg-accent' : 'w-1.5 bg-border',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted tabular-nums">
            {i + 1} / {steps.length}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="flex flex-1 items-center gap-1.5 text-xs text-muted select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="accent-[var(--tp-accent)]"
            />
            Don’t show this again
          </label>
          {i > 0 && (
            <button
              type="button"
              onClick={back}
              className="h-8 rounded-md px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Back
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            className="h-8 rounded-md bg-accent px-3 text-sm font-medium text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
