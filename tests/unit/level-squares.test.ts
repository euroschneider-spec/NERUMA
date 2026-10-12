import { describe, expect, it } from 'vitest';
import { levelPattern } from '@/components/level-squares';

const filled = (level: keyof typeof levelPattern) => levelPattern[level].filter((square) => square !== 'off').length;

describe('level squares', () => {
  it('fill one, two and three squares for low, moderate and high', () => {
    expect([filled('low'), filled('moderate'), filled('high')]).toEqual([1, 2, 3]);
  });
  it('mark high with the accent colour on every square', () => {
    expect(levelPattern.high).toEqual(['hot', 'hot', 'hot']);
  });
  it('show variable as filled, empty, filled, which no single level looks like', () => {
    expect(levelPattern.variable).toEqual(['on', 'off', 'on']);
    for (const level of ['low', 'moderate', 'high', 'unknown'] as const) {
      expect(levelPattern[level]).not.toEqual(levelPattern.variable);
    }
  });
  it('keep not recorded empty, so it never looks like low', () => {
    expect(levelPattern.unknown).toEqual(['off', 'off', 'off']);
    expect(levelPattern.unknown).not.toEqual(levelPattern.low);
  });
});
