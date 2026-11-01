import { expect, it, vi } from 'vitest';
import { throttleTrailing } from './throttle';

it('delivers the first and the last value', () => {
  vi.useFakeTimers();
  const got: number[] = [];
  const t = throttleTrailing((v: number) => got.push(v), 100);
  t(1);
  t(2);
  t(3);
  expect(got).toEqual([1]);
  vi.advanceTimersByTime(150);
  expect(got).toEqual([1, 3]);
  vi.useRealTimers();
});
