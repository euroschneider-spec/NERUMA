'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { submitProblemReport } from '@/app/workspace/actions';
import type { Locale } from '@/lib/i18n';
import { getWorkspaceCopy, REPORT_MAX } from '@/lib/workspace';
import { ChoiceGroup } from './choice-group';

export function ProblemReportForm({ org, locale, places, backHref }: { org: string; locale: Locale; places: { id: string; name: string }[]; backHref: string }) {
  const t = getWorkspaceCopy(locale);
  const [state, submit, pending] = useActionState(submitProblemReport.bind(null, org, locale), { message: '', done: false });
  if (state.done) {
    return (
      <div className="report-done">
        <p role="status">{state.message}</p>
        <Link className="button" href={backHref}>{t.reportBack}</Link>
      </div>
    );
  }
  return (
    <form action={submit} className="organisation-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">{t.reportHeading}</legend>
        <div className="form-grid">
          {places.length > 0 && (
            <ChoiceGroup className="wide" label={t.reportPlace} name="place" defaultValue="" options={[{ value: '', label: t.reportNoPlace }, ...places.map((place) => ({ value: place.id, label: place.name }))]} />
          )}
          <label className="form-field wide">
            {t.reportMessage}
            <textarea name="message" required minLength={10} maxLength={REPORT_MAX} rows={6} />
          </label>
        </div>
        <button className="button" type="submit">{t.reportSend}</button>
      </fieldset>
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}
