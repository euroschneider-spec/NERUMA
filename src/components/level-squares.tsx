import type { SensoryLevel } from '@/lib/demo';

type Square = 'on' | 'hot' | 'off';
/**
 * Three squares per level, shared by the guide and the home preview. Low, moderate and high fill one, two and
 * three. Variable alternates (filled, empty, filled) because no single level describes it, and a partly filled bar
 * would read as a measurement the venue never made. Not recorded stays empty with a dashed outline, so it never
 * reads as low. The words next to the squares carry the meaning; the squares are decoration for sighted readers.
 */
export const levelPattern: Record<SensoryLevel, Square[]> = {
  low: ['on', 'off', 'off'],
  moderate: ['on', 'on', 'off'],
  high: ['hot', 'hot', 'hot'],
  variable: ['on', 'off', 'on'],
  unknown: ['off', 'off', 'off'],
};

export function LevelSquares({ level }: { level: SensoryLevel }) {
  return (
    <span className={level === 'unknown' ? 'gg-sq is-unknown' : 'gg-sq'} aria-hidden="true">
      {levelPattern[level].map((square, step) => <span key={step} className={square === 'off' ? undefined : square} />)}
    </span>
  );
}
