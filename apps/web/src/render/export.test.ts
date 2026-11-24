import { describe, expect, it } from 'vitest';
import { standaloneSvg, wellFormedSvg } from './export';

// What mermaid emits for a mindmap label: HTML in a foreignObject that isn't valid XML.
const MINDMAP_LIKE = `<svg id="d" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><g><foreignObject width="80" height="20"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel"><p>Long<br>label<p>two</span></div></foreignObject></g></svg>`;

const xmlError = (markup: string) =>
  new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('parsererror');

describe('wellFormedSvg', () => {
  it('turns label HTML that is not valid XML into an SVG browsers can load', () => {
    expect(xmlError(MINDMAP_LIKE)).not.toBeNull();
    const out = wellFormedSvg(MINDMAP_LIKE);
    expect(xmlError(out)).toBeNull();
    expect(out).toContain('Long');
    expect(out).toContain('two');
    expect(out).toMatch(/<br\s*\/>/);
  });

  it('keeps already valid SVG intact', () => {
    const ok =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5"/></svg>';
    const out = wellFormedSvg(ok);
    expect(xmlError(out)).toBeNull();
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('<rect');
  });

  it('makes downloads of such diagrams valid too', () => {
    const out = standaloneSvg(MINDMAP_LIKE, '#fff');
    expect(xmlError(out)).toBeNull();
    expect(out).toContain('width="100"');
  });
});
