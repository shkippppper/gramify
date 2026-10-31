import { Svg2Roughjs } from 'svg2roughjs';

/** Turn a rendered mermaid SVG element into a hand-drawn sketch SVG. */
export async function sketchSvg(source: SVGSVGElement): Promise<SVGSVGElement> {
  // Both the source (for text measurement) and the output need to live in the DOM.
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none';
  const target = document.createElement('div');
  stage.append(source, target);
  document.body.append(stage);
  try {
    const s2r = new Svg2Roughjs(target);
    s2r.svg = source;
    const out = (await s2r.sketch()) as SVGSVGElement | null;
    if (!out) throw new Error('Hand-drawn conversion failed');
    const w = out.getAttribute('width');
    const h = out.getAttribute('height');
    if (w && h && !out.getAttribute('viewBox'))
      out.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
    out.remove();
    return out;
  } finally {
    stage.remove();
  }
}
