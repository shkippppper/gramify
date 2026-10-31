import { expect, it } from 'vitest';
import { colorForId, PRESENCE_COLORS } from './colors';

it('is deterministic and in palette', () => {
  expect(colorForId('abc')).toBe(colorForId('abc'));
  expect(PRESENCE_COLORS).toContain(colorForId('user-123'));
});
