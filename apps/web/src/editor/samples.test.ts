import { describe, expect, it } from 'vitest';
import { SAMPLE_FAMILIES } from './samples';

describe('sample families', () => {
  it('have unique ids and at least one example each', () => {
    const ids = SAMPLE_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of SAMPLE_FAMILIES) expect(f.examples.length).toBeGreaterThan(0);
  });

  it('show the railroad notations as one Railroad type', () => {
    const railroad = SAMPLE_FAMILIES.filter((f) => f.name.startsWith('Railroad'));
    expect(railroad).toHaveLength(1);
    expect(railroad[0]!.id).toBe('railroad');
    expect(railroad[0]!.variants?.map((v) => v.label)).toEqual(['IR', 'EBNF', 'ABNF', 'PEG']);
    expect(railroad[0]!.examples[0]!.title).toMatch(/^IR · /);
  });
});
