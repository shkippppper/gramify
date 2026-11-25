import { describe, expect, it } from 'vitest';
import { formatBoardLink, linkedBoardIds, parseLinks } from './links';

const ID = '3f1c2b4a-1d2e-4f00-9a8b-0123456789ab';

describe('parseLinks', () => {
  it('reads board links by id, by title, by URL and web links', () => {
    const code = [
      'sequenceDiagram',
      '  participant Worker',
      `%% link Worker -> Payment worker #${ID}`,
      '%%link "Order service" -> Orders',
      `%% LINK API -> https://gramify.example/d/${ID.toUpperCase()}/view`,
      '%% link Docs -> https://example.com/runbook',
      '%% not a link',
      '%% link broken',
    ].join('\n');
    expect(parseLinks(code)).toEqual([
      { shape: 'Worker', target: { kind: 'board', id: ID, title: 'Payment worker' }, line: 3 },
      { shape: 'Order service', target: { kind: 'board', id: null, title: 'Orders' }, line: 4 },
      { shape: 'API', target: { kind: 'board', id: ID, title: '' }, line: 5 },
      { shape: 'Docs', target: { kind: 'url', url: 'https://example.com/runbook' }, line: 6 },
    ]);
  });

  it('accepts /d/<id> with or without a title', () => {
    expect(parseLinks(`%% link A -> Billing /d/${ID}`)[0]!.target).toEqual({
      kind: 'board',
      id: ID,
      title: 'Billing',
    });
    expect(parseLinks(`%% link A -> /d/${ID}`)[0]!.target).toEqual({
      kind: 'board',
      id: ID,
      title: '',
    });
  });

  it('accepts an id on its own and titles with arrows or hashes', () => {
    expect(parseLinks(`%% link A -> #${ID}`)[0]!.target).toEqual({
      kind: 'board',
      id: ID,
      title: '',
    });
    expect(parseLinks('%% link A -> Q3 #roadmap')[0]!.target).toEqual({
      kind: 'board',
      id: null,
      title: 'Q3 #roadmap',
    });
  });

  it('formats the line it parses back', () => {
    const line = formatBoardLink('Worker', { id: ID, title: '  Payment\n worker ' });
    expect(line).toBe(`%% link Worker -> Payment worker /d/${ID}`);
    expect(parseLinks(line)[0]!.target).toEqual({ kind: 'board', id: ID, title: 'Payment worker' });
  });

  it('lists linked board ids once', () => {
    const code = `%% link A -> x #${ID}\n%% link B -> y #${ID}\n%% link C -> https://example.com`;
    expect(linkedBoardIds(code)).toEqual([ID]);
  });
});
