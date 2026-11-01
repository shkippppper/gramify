/**
 * Throttle with a trailing call: at most one call per `ms`, and the *last* value is
 * always delivered (leading-only throttles drop the final pan/zoom or pointer position).
 */
export function throttleTrailing<T>(fn: (v: T) => void, ms: number) {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { v: T } | null = null;
  const run = () => {
    timer = null;
    last = performance.now();
    if (pending) {
      const { v } = pending;
      pending = null;
      fn(v);
    }
  };
  const call = (v: T) => {
    pending = { v };
    const wait = ms - (performance.now() - last);
    if (wait <= 0 && !timer) run();
    else if (!timer) timer = setTimeout(run, Math.max(0, wait));
  };
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return call;
}
