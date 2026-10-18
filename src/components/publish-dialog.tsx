'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { getPublicationCheck, getPublishingAllowed, publishPlace } from '@/app/workspace/actions';
import { getBillingCopy } from '@/lib/billing';
import { localeNames, type Locale } from '@/lib/i18n';
import type { LanguageCheck } from '@/lib/publishing';
import { getPublishingCopy, waitingReasons, type PublishResult } from '@/lib/publishing';
import { getWorkspaceCopy } from '@/lib/workspace';
import { ResponsibilityNotice } from './responsibility-notice';

/**
 * The confirm step before publishing: which languages go live, which wait and why, the responsibility text, and one
 * tick. `revision` is the saved revision the editor shows; the database refuses if someone saved since.
 */
export function PublishDialog({ open, locale, org, placeId, revision, onClose, onPublished, onFailed }: {
  open: boolean; locale: Locale; org: string; placeId: string; revision: number;
  onClose: () => void; onPublished: (result: Extract<PublishResult, { ok: true }>) => void; onFailed: (error: Extract<PublishResult, { ok: false }>['error']) => void;
}) {
  const t = getPublishingCopy(locale);
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [checks, setChecks] = useState<LanguageCheck[] | null>(null);
  // Without an active plan (once payments are on), the dialog says so instead of offering to publish.
  const [plan, setPlan] = useState<{ allowed: boolean; owner: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    // Fresh each time it opens: the saved version may have changed since.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecks(null); setPlan(null); setFailed(false); setAgreed(false);
    Promise.all([getPublicationCheck(org, placeId), getPublishingAllowed(org)]).then(([result, allowed]) => {
      if (!active) return;
      if (result && allowed) { setChecks(result); setPlan(allowed); } else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open, org, placeId]);
  const billing = getBillingCopy(locale);
  const ready = plan?.allowed === false ? [] : checks?.filter((check) => check.ready) ?? [];
  const waiting = checks?.filter((check) => !check.ready && (check.started || check.published)) ?? [];
  async function confirm() {
    setBusy(true);
    try {
      const result = await publishPlace(org, placeId, revision, agreed);
      if (result.ok) onPublished(result); else onFailed(result.error);
    } catch {
      onFailed('error');
    } finally {
      setBusy(false);
      onClose();
    }
  }
  return (
    <dialog ref={ref} className="confirm-dialog publish-dialog" aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <h2 id={`${id}-title`}>{t.publishTitle}</h2>
      <p>{t.publishIntro}</p>
      {failed && <p role="alert">{t.publishError}</p>}
      {!checks && !failed && <p role="status">{t.publishing}</p>}
      {checks && plan?.allowed === false && <p role="alert">
        {billing.publishNeedsPlan}{' '}
        {plan.owner ? <Link href={`/${locale}/workspace/billing?org=${org}`}>{billing.publishNeedsPlanOwner}</Link> : billing.publishNeedsPlanAdmin}
      </p>}
      {checks && plan?.allowed !== false && <>
        {ready.length > 0 && <section aria-label={t.publishLive}>
          <h3>{t.publishLive}</h3>
          <ul>{ready.map((check) => <li key={check.locale}>{localeNames[check.locale]}</li>)}</ul>
        </section>}
        {waiting.length > 0 && <section aria-label={t.publishWaits}>
          <h3>{t.publishWaits}</h3>
          <ul>{waiting.map((check) => <li key={check.locale}><strong>{localeNames[check.locale]}</strong>: {waitingReasons(check, locale).join('; ')}</li>)}</ul>
        </section>}
        {ready.length === 0 && <p role="alert">{t.publishNothing}</p>}
        {ready.length > 0 && <>
          <ResponsibilityNotice locale={locale} compact />
          <label className="checkbox-label"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />{t.publishAgree}</label>
        </>}
      </>}
      <div className="confirm-actions">
        <button type="button" className="button button-outline" autoFocus onClick={onClose}>{getWorkspaceCopy(locale).cancel}</button>
        <button type="button" className="button" disabled={busy || !agreed || ready.length === 0} onClick={confirm}>{busy ? t.publishing : t.publishConfirm}</button>
      </div>
    </dialog>
  );
}
