import { expect, it } from 'vitest';
import * as Y from 'yjs';
import { replaceText } from './session';

it('replaceText produces the target string with a minimal edit', () => {
  const doc = new Y.Doc();
  const t = doc.getText('t');
  t.insert(0, 'flowchart TD\n A-->B\n');
  let ops = 0;
  t.observe((e) => (ops += e.delta.length));
  replaceText(t, 'flowchart TD\n A-->C\n');
  expect(t.toString()).toBe('flowchart TD\n A-->C\n');
  expect(ops).toBeLessThanOrEqual(3);
  replaceText(t, '');
  expect(t.toString()).toBe('');
  replaceText(t, 'x');
  expect(t.toString()).toBe('x');
});

it('replaceText keeps emoji intact', () => {
  const doc = new Y.Doc();
  const t = doc.getText('t');
  t.insert(0, 'a😀b');
  replaceText(t, 'a😁b');
  expect(t.toString()).toBe('a😁b');
});
