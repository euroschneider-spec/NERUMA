'use client';
import { useId, useState, useTransition } from 'react';
import { setPlaceExplore } from '@/app/workspace/actions';
import { getExploreListingCopy } from '@/lib/explore-listing';
import type { Locale } from '@/lib/i18n';

/** "Show in Explore" on a location card: on by default, saved as soon as it is changed. Shown only while a platform administrator has switched Explore on. */
export function ExploreSwitch({ locale, org, place, shown }: { locale: Locale; org: string; place: string; shown: boolean }) {
  const t = getExploreListingCopy(locale);
  const hintId = useId();
  const [checked, setChecked] = useState(shown);
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
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
  return (
    <div className="explore-switch">
      <label className="checkbox-label">
        <input type="checkbox" checked={checked} disabled={pending} aria-describedby={hintId} onChange={(event) => change(event.target.checked)} />
        <span>{t.show}</span>
      </label>
      <p id={hintId} className="small-note">{t.showHint}</p>
      <p role="status" className="small-note">{state === 'saved' ? t.saved : state === 'error' ? t.error : ''}</p>
    </div>
  );
}
