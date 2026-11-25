import { describe, expect, it } from 'vitest';
import { findLinkShapes, linkKeyFor, shapeAt } from './linkShapes';

const svgOf = (inner: string) => {
  const host = document.createElement('div');
  host.innerHTML = `<svg id="r" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  return host.querySelector('svg')!;
};

// Trimmed from what mermaid renders.
const SEQUENCE = svgOf(`
  <g id="root-0"><rect class="actor actor-top" name="API"></rect><text class="actor actor-box">API</text></g>
  <g id="root-1"><rect class="actor actor-top" name="W"></rect><text class="actor actor-box">Payment worker</text></g>
  <g><rect class="actor actor-bottom" name="W"></rect><text class="actor actor-box">Payment worker</text></g>
  <g class="actor-man actor-top" name="U"><text class="actor actor-man">User</text></g>
`);
const FLOWCHART = svgOf(`
  <g id="r-flowchart-A-0" class="node default"><g class="label"><text>Order  service</text></g></g>
  <g id="r-flowchart-B-1" class="node default"><text>Worker</text></g>
  <path id="r-L_A_B_0" data-id="L_A_B_0"></path>
`);

describe('link shapes', () => {
  it('finds sequence participants by id (top and bottom boxes) or by label', () => {
    expect(findLinkShapes(SEQUENCE, 'W')).toHaveLength(2);
    expect(findLinkShapes(SEQUENCE, 'payment   WORKER')).toHaveLength(2);
    expect(findLinkShapes(SEQUENCE, 'U')).toHaveLength(1);
    expect(findLinkShapes(SEQUENCE, 'Nobody')).toHaveLength(0);
  });

  it('finds flowchart nodes by id or label, not edges', () => {
    expect(findLinkShapes(FLOWCHART, 'A')[0]!.id).toBe('r-flowchart-A-0');
    expect(findLinkShapes(FLOWCHART, 'order service')[0]!.id).toBe('r-flowchart-A-0');
    expect(findLinkShapes(FLOWCHART, 'L_A_B_0')).toHaveLength(0);
  });

  it('names a clicked shape by its id', () => {
    const text = FLOWCHART.querySelector('#r-flowchart-B-1 text')!;
    const shape = shapeAt(text, FLOWCHART)!;
    expect(shape.id).toBe('r-flowchart-B-1');
    expect(linkKeyFor(shape, FLOWCHART)).toBe('B');
    const actor = SEQUENCE.querySelector('#root-1 text')!;
    expect(linkKeyFor(shapeAt(actor, SEQUENCE)!, SEQUENCE)).toBe('W');
  });
});

describe('exported links', () => {
  it('wraps linked shapes in <a> elements', async () => {
    const { linkifySvgMarkup } = await import('./linkShapes');
    const markup = FLOWCHART.outerHTML;
    const out = linkifySvgMarkup(markup, [
      { shape: 'B', href: 'https://gramify.example/d/1' },
      { shape: 'Missing', href: 'https://example.com' },
      { shape: 'A', href: null },
    ]);
    const doc = new DOMParser().parseFromString(out, 'image/svg+xml');
    const links = [...doc.querySelectorAll('a')];
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('https://gramify.example/d/1');
    expect(links[0]!.querySelector('g')!.id).toBe('r-flowchart-B-1');
  });
});
