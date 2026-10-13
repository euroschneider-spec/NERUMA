'use client';
import { useActionState, useEffect, useRef } from 'react';
import { setUpTwoFactor } from '@/app/auth/two-factor-actions';
import type { Locale } from '@/lib/i18n';
import { getTwoFactorCopy, groupedKey } from '@/lib/two-factor';

/** Two-factor setup on the account page: one button, then the QR code, its key in text, and the code that confirms it. */
export function TwoFactorSetup({ locale, enrolled, required }: { locale: Locale; enrolled: boolean; required: boolean }) {
  const t = getTwoFactorCopy(locale);
  const [state, submit, pending] = useActionState(setUpTwoFactor.bind(null, locale), { message: '' });
  const code = useRef<HTMLInputElement>(null);
  const on = enrolled || state.done;
  // When the QR code appears, the next thing to do is type the code, so focus moves there.
  useEffect(() => {
    if (state.factor) code.current?.focus();
  }, [state.factor]);
  return (
    <section className="notice two-factor" aria-labelledby="two-factor-title">
      <h2 id="two-factor-title">{t.title}</h2>
      {required && !on && <p><strong>{t.required}</strong></p>}
      <p>{t.intro}</p>
      {on ? (
        <p role="status">{t.on}</p>
      ) : state.factor ? (
        <form action={submit} className="organisation-form">
          <p>{t.scan}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data address from Supabase; nothing to optimise */}
          <img className="qr-image two-factor-qr" src={state.qr} alt={t.qrAlt} width={200} height={200} />
          <p>{t.manual} <code className="two-factor-key">{groupedKey(state.secret || '')}</code></p>
          <input type="hidden" name="factor" value={state.factor} />
          <label className="form-field">
            {t.code}
            <input ref={code} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          </label>
          <button className="button" type="submit" disabled={pending}>{t.turnOn}</button>
        </form>
      ) : (
        <form action={submit}>
          <button className="button" type="submit" disabled={pending}>{t.setup}</button>
        </form>
      )}
      <p>{t.lost}</p>
      {pending && <p role="status">{t.working}</p>}
      {state.message && !state.done && <p role="alert">{state.message}</p>}
    </section>
  );
}
