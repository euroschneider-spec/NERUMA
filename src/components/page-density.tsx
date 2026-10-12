'use client';
import { getAccessCopy } from '@/lib/accessibility-copy';
import type { Locale } from '@/lib/i18n';
import { useDensity } from '@/lib/reading-prefs';

/**
 * Summary and full page are the same text, not two versions of it: summary keeps each section's opening
 * line and hides the rest, so there is nothing to drift out of date. The choice lives in the reading panel,
 * on the pages it affects; this note explains the hidden text where the effect is.
 */
export function DensityNote({locale}:{locale:Locale}) {
  const a=getAccessCopy(locale);
  return useDensity()==='summary' ? <p className="notice density-note">{a.summaryNote}</p> : null;
}
