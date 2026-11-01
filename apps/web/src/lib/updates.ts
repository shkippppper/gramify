import { toast } from 'sonner';

/**
 * After a deploy, a page that's still open references hashed files that no longer exist,
 * so lazily loaded code (e.g. mermaid's per-diagram modules) fails to load. Detect that
 * and offer a reload instead of showing confusing errors.
 */
export function isStaleBuildError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|ChunkLoadError|Loading chunk \S+ failed|Unable to preload CSS/i.test(
    msg,
  );
}

let shown = false;
let staleDetected = false;
/** True once any lazily loaded file failed to load (the page is from an older deploy). */
export const staleBuildDetected = () => staleDetected;

export function announceUpdate() {
  staleDetected = true;
  if (shown) return;
  shown = true;
  toast.message('Gramify was updated', {
    description: 'Reload to get the latest version. Your work is saved.',
    duration: Infinity,
    action: { label: 'Reload', onClick: () => window.location.reload() },
  });
}

export function installUpdateDetection() {
  // Vite fires this when a lazily loaded chunk (page or library) fails to load.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    announceUpdate();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isStaleBuildError(e.reason)) announceUpdate();
  });
}
