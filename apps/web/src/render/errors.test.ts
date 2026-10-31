import { describe, expect, it } from 'vitest';
import { extractErrorLineText, findErrorLine, mostRelevantLine, normalizeErrorMessage } from './errors';

const code = `flowchart TD
  A --> B
  B --> C{oops
  C --> D`;

describe('error helpers', () => {
  it('extracts the snippet from a parse error', () => {
    const msg = 'Parse error on line 3:\n...B --> C{oops  C --> D\n--------------------^\nExpecting X';
    expect(extractErrorLineText(msg)).toBe('B --> C{oops  C --> D');
  });

  it('finds the most relevant line', () => {
    expect(mostRelevantLine('B --> C{oops', code)).toBe(3);
    expect(mostRelevantLine('', code)).toBeNull();
  });

  it('falls back to the line number in the message', () => {
    expect(findErrorLine('Something on line 2 failed', code)).toBe(2);
    expect(findErrorLine('Something on line 99 failed', code)).toBeNull();
  });

  it('rewrites the line number', () => {
    expect(normalizeErrorMessage('Parse error on line 9:\nx', 3)).toBe('Parse error on line 3:\nx');
  });
});
