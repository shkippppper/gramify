import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { writeLinkLine } from './edit';

const text = (s: string) => {
  const doc = new Y.Doc();
  const t = doc.getText('code');
  t.insert(0, s);
  return t;
};

describe('writeLinkLine', () => {
  it('appends, replaces and removes link lines', () => {
    const t = text('graph TD\n  A --> B');
    writeLinkLine(t, '%% link A -> Orders');
    expect(t.toString()).toBe('graph TD\n  A --> B\n%% link A -> Orders\n');
    writeLinkLine(t, '%% link A -> Billing', 3);
    expect(t.toString()).toBe('graph TD\n  A --> B\n%% link A -> Billing\n');
    writeLinkLine(t, null, 3);
    expect(t.toString()).toBe('graph TD\n  A --> B\n');
  });

  it('removes a last line without a trailing newline', () => {
    const t = text('graph TD\n%% link A -> X');
    writeLinkLine(t, null, 2);
    expect(t.toString()).toBe('graph TD');
  });
});
