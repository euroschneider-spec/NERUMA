import { describe, it, expect } from 'vitest';
import { clamp } from '@/components/reading-settings';

describe('clamp', () => {
  it('passes through values inside the range', () => { expect(clamp(5, 0, 10)).toBe(5); });
  it('floors values below the minimum', () => { expect(clamp(-5, 0, 10)).toBe(0); });
  it('ceils values above the maximum', () => { expect(clamp(15, 0, 10)).toBe(10); });
});
