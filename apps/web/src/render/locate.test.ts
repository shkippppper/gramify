import { describe, expect, it } from 'vitest';
import { locateInCode, parseMermaidId, type Candidates } from './locate';

const cand = (ids: string[] = [], texts: string[] = []): Candidates => ({ ids, edges: [], texts });
const fromId = (raw: string) => {
  const c = cand();
  parseMermaidId(raw, c);
  return c;
};

const flow = `flowchart TD
    %% A comment mentioning B
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    my_node --> other_node`;

describe('parseMermaidId', () => {
  it('extracts node identifiers', () => {
    expect(fromId('flowchart-A-0').ids).toEqual(['A']);
    expect(fromId('classId-Animal-4').ids).toEqual(['Animal']);
    expect(fromId('state-Still-3').ids).toEqual(['Still']);
    expect(fromId('service-db').ids).toEqual(['db']);
    expect(fromId('customerA').ids).toEqual(['customerA']);
    expect(fromId('rider_safety').ids).toEqual(['rider_safety']);
  });
  it('extracts edges, including identifiers with underscores', () => {
    expect(fromId('L_A_B_0').edges).toEqual([['A', 'B']]);
    expect(fromId('L_my_node_other_node_0').edges).toContainEqual(['my_node', 'other_node']);
    expect(fromId('id_entity-CUSTOMER-0_entity-ORDER-1_0').edges).toEqual([['CUSTOMER', 'ORDER']]);
    expect(fromId('1-user-ui').edges).toEqual([['user', 'ui']]);
  });
  it('ignores ids without names', () => {
    expect(fromId('edge_0_1')).toEqual(cand());
    expect(fromId('node-3')).toEqual(cand());
  });
});

describe('locateInCode', () => {
  it('prefers the defining line of a node', () => {
    expect(locateInCode(flow, cand(['B']))).toEqual({ line: 3, startColumn: 33, endColumn: 34 });
    expect(locateInCode(flow, cand(['C']))).toEqual({ line: 4, startColumn: 11, endColumn: 12 });
  });
  it('skips comments and respects word boundaries', () => {
    expect(locateInCode('graph TD\n  %% A here\n  AB --> A', cand(['A']))?.line).toBe(3);
    expect(locateInCode('graph TD\n  AB --> A', cand(['A']))?.startColumn).toBe(10);
  });
  it('finds edges by their endpoints', () => {
    const c: Candidates = { ids: [], edges: [['C', 'D']], texts: [] };
    expect(locateInCode(flow, c)?.line).toBe(5);
    const u: Candidates = {
      ids: [],
      edges: [
        ['my', 'node_other_node'],
        ['my_node', 'other_node'],
      ],
      texts: [],
    };
    expect(locateInCode(flow, u)?.line).toBe(6);
  });
  it('falls back to the visible text', () => {
    expect(locateInCode(flow, cand([], ['Get money']))).toEqual({
      line: 3,
      startColumn: 22,
      endColumn: 31,
    });
    expect(locateInCode('pie\n  "Dogs" : 386\n  "Cats" : 85', cand([], ['cats']))?.line).toBe(3);
    expect(
      locateInCode(
        'sequenceDiagram\n  Alice->>John: Hello John, how are you?',
        cand([], ['Hello John, how are you?']),
      )?.line,
    ).toBe(2);
  });
  it('recognises keyword definitions', () => {
    const seq = 'sequenceDiagram\n  Alice->>John: hi\n  participant John as Johnny';
    expect(locateInCode(seq, cand(['John']))?.line).toBe(3);
    const c4 =
      'C4Context\n  Rel(customerA, SystemAA, "Uses")\n  Person(customerA, "Banking Customer A")';
    expect(locateInCode(c4, cand(['customerA']))?.line).toBe(3);
  });
  it('selects the clicked label when it is on the matched line', () => {
    const c: Candidates = { ids: ['D'], edges: [], texts: ['Laptop'] };
    expect(locateInCode(flow, c)).toEqual({ line: 5, startColumn: 18, endColumn: 24 });
    const notOnLine: Candidates = { ids: ['D'], edges: [], texts: ['Renamed elsewhere'] };
    expect(locateInCode(flow, notOnLine)).toEqual({ line: 5, startColumn: 16, endColumn: 17 });
  });
  it('returns null when nothing matches', () => {
    expect(locateInCode(flow, cand(['Zzz'], ['nothing like this']))).toBeNull();
  });
});

describe('elementsForLine', () => {
  const svgFrom = (markup: string) => {
    document.body.innerHTML = markup;
    return document.querySelector('svg') as SVGSVGElement;
  };
  const svg = () =>
    svgFrom(`<svg id="r1">
      <g class="node" id="r1-flowchart-A-0"><text>Christmas</text></g>
      <g class="node" id="r1-flowchart-B-1"><text>Go shopping</text></g>
      <g class="node" id="r1-flowchart-C-2"><text>Let me think</text></g>
      <path id="r1-L_A_B_0" data-id="L_A_B_0"></path>
      <g class="edgeLabel"><g class="label" data-id="L_A_B_0"><text>Get money</text></g></g>
      <g class="legend"><text>Dogs</text></g>
    </svg>`);
  const ids = (els: Element[]) => els.map((e) => e.id || e.getAttribute('class')).sort();

  it('finds nodes and the edge defined on a line', async () => {
    const { elementsForLine } = await import('./locate');
    const code = 'flowchart TD\n  A[Christmas] -->|Get money| B(Go shopping)\n  B --> C';
    expect(ids(elementsForLine(svg(), code, 2))).toEqual([
      'edgeLabel',
      'r1-L_A_B_0',
      'r1-flowchart-A-0',
      'r1-flowchart-B-1',
    ]);
    expect(ids(elementsForLine(svg(), code, 3))).toEqual(['r1-flowchart-B-1', 'r1-flowchart-C-2']);
  });
  it('ignores headers and comments, falls back to label text', async () => {
    const { elementsForLine } = await import('./locate');
    expect(elementsForLine(svg(), 'flowchart TD\n%% A B', 1)).toEqual([]);
    expect(elementsForLine(svg(), 'flowchart TD\n%% A B', 2)).toEqual([]);
    expect(ids(elementsForLine(svg(), 'pie\n  "Dogs" : 386', 2))).toEqual(['legend']);
  });
});
