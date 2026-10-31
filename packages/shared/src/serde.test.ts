import { describe, expect, it } from 'vitest';
import { deserializeState, serializeState } from './serde';

describe('serde', () => {
  it('round-trips state', () => {
    const state = { code: 'graph TD; A-->B; ünïcode ✓', mermaid: '{"theme":"dark"}' };
    const s = serializeState(state);
    expect(s.startsWith('pako:')).toBe(true);
    expect(s).not.toMatch(/[+/=]/);
    expect(deserializeState(s)).toEqual(state);
  });

  it('accepts full mermaid.live URLs', () => {
    const s = serializeState({ code: 'pie\n "a": 1', mermaid: '{}' });
    expect(deserializeState(`https://mermaid.live/edit#${s}`).code).toBe('pie\n "a": 1');
  });

  it('accepts base64: prefix', () => {
    const b = btoa(JSON.stringify({ code: 'graph LR; X-->Y', mermaid: '{}' }));
    expect(deserializeState(`base64:${b}`).code).toBe('graph LR; X-->Y');
  });
});
