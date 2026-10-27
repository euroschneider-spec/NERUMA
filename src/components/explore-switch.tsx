'use client';
import { useId, useState, useTransition } from 'react';
import { setPlaceExplore } from '@/app/workspace/actions';
import { getExploreListingCopy } from '@/lib/explore-listing';
import type { Locale } from '@/lib/i18n';

/**
 * "Show in Explore" on a location card: on by default, saved as soon as it is changed. While a platform administrator has not switched
 * Explore on for the organisation it stays in view but greyed out, and says to contact NERUMA (aria-disabled rather than disabled, so it
 * can still be reached with the keyboard; hovering or focusing it shows why, and Escape closes the hint).
 */
export function ExploreSwitch({ locale, org, place, shown, enabled }: { locale: Locale; org: string; place: string; shown: boolean; enabled: boolean }) {
  const t = getExploreListingCopy(locale);
  const hintId = useId();
  const [checked, setChecked] = useState(shown);
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const change = (next: boolean) => {
    setChecked(next);
    setState('idle');
    start(async () => {
      const result = await setPlaceExplore(org, place, next);
      if (!result.ok) setChecked(!next);
      setState(result.ok ? 'saved' : 'error');
    });
  };
  if (!enabled) {
    return (
      <div
        className="explore-switch is-off"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
      >
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={false}
            readOnly
            aria-disabled="true"
            aria-describedby={hintId}
            onClick={(event) => event.preventDefault()}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
          />
          <span>{t.show}</span>
        </label>
        <span id={hintId} role="tooltip" className="infotip-text" data-open={open}>{t.showOff}</span>
      </div>
    );
  }
  return (
    <div className="explore-switch">
      <label className="checkbox-label">
        <input type="checkbox" checked={checked} disabled={pending} aria-describedby={`${hintId}-note`} onChange={(event) => change(event.target.checked)} />
        <span>{t.show}</span>
      </label>
      <p id={`${hintId}-note`} className="small-note">{t.showHint}</p>
      <p role="status" className="small-note">{state === 'saved' ? t.saved : state === 'error' ? t.error : ''}</p>
    </div>
  );
}
