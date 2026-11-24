import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { APP_VERSION, CHANGELOG } from './changelog';

const parse = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
  return false;
};

describe('changelog', () => {
  it('lists releases newest first with valid versions and dates', () => {
    for (const r of CHANGELOG) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.changes.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(newer(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version)).toBe(true);
      expect(CHANGELOG[i - 1]!.date >= CHANGELOG[i]!.date).toBe(true);
    }
  });

  it('matches the web package version', () => {
    expect(pkg.version).toBe(APP_VERSION);
  });
});
