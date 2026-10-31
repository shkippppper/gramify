import { downloadBlob, slugify, timestamp } from '../lib/download';

export type SizeMode = 'auto' | 'width' | 'height';

/** Intrinsic size of an exported SVG (from its viewBox, falling back to width/height). */
export function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width && vb.height) return { width: vb.width, height: vb.height };
  const w = parseFloat(svg.getAttribute('width') ?? '');
  const h = parseFloat(svg.getAttribute('height') ?? '');
  if (w && h) return { width: w, height: h };
  const box = svg.getBBox();
  return { width: box.width || 800, height: box.height || 600 };
}

/** Standalone SVG markup suitable for download (explicit size, xmlns, background). */
export function standaloneSvg(svgMarkup: string, background: string | null) {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.removeAttribute('style');
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] && vb[3]) {
    svg.setAttribute('width', String(vb[2]));
    svg.setAttribute('height', String(vb[3]));
  }
  if (background) svg.style.backgroundColor = background;
  return new XMLSerializer().serializeToString(svg);
}

function svgDims(markup: string) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] && vb[3]) return { width: vb[2], height: vb[3] };
  return { width: parseFloat(svg.getAttribute('width') ?? '800') || 800, height: parseFloat(svg.getAttribute('height') ?? '600') || 600 };
}

export async function svgToPng(
  svgMarkup: string,
  opts: { mode: SizeMode; size: number; background: string | null },
): Promise<Blob> {
  const markup = standaloneSvg(svgMarkup, null);
  const { width, height } = svgDims(markup);
  let w: number;
  let h: number;
  if (opts.mode === 'width') {
    w = opts.size;
    h = (opts.size * height) / width;
  } else if (opts.mode === 'height') {
    h = opts.size;
    w = (opts.size * width) / height;
  } else {
    w = width * 2;
    h = height * 2;
  }
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const img = new Image();
  img.decoding = 'async';
  // A data: URL (not blob:) keeps the canvas untainted when labels use <foreignObject>.
  const bytes = new TextEncoder().encode(markup);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  {
    img.src = `data:image/svg+xml;base64,${btoa(bin)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    );
  }
}

export const canCopyImage = () => typeof window !== 'undefined' && 'ClipboardItem' in window;

export async function copyPng(blob: Promise<Blob>) {
  // Pass a promise so Safari keeps the user-gesture context.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export function fileName(title: string, ext: string) {
  return `${slugify(title)}-${timestamp()}.${ext}`;
}

export function downloadSvg(svgMarkup: string, title: string, background: string | null) {
  downloadBlob(fileName(title, 'svg'), new Blob([standaloneSvg(svgMarkup, background)], { type: 'image/svg+xml' }));
}

export function downloadText(text: string, name: string, type = 'text/plain') {
  downloadBlob(name, new Blob([text], { type }));
}
