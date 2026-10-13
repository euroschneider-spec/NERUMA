'use client';
import { useActionState } from 'react';
import { verifyBackupCode, verifySecondFactor } from '@/app/auth/two-factor-actions';
import type { Locale } from '@/lib/i18n';
import { getTwoFactorCopy } from '@/lib/two-factor';

/** The code step after the password. */
export function TwoFactorVerify({ locale, canRemember }: { locale: Locale; canRemember: boolean }) {
  const t = getTwoFactorCopy(locale);
  const [state, submit, pending] = useActionState(verifySecondFactor.bind(null, locale), { message: '' });
  return (
    <form action={submit} className="organisation-form">
      <label className="form-field">
        {t.code}
        {/* The only field on a page the person just arrived at to fill it in. */}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus />
      </label>
      {canRemember && (
        <div className="remember-device">
          <input id="remember-device" type="checkbox" name="remember" aria-describedby="remember-device-hint" />
          <div>
            <label htmlFor="remember-device">{t.remember}</label>
            <p id="remember-device-hint" className="form-hint">{t.rememberHint}</p>
          </div>
        </div>
      )}
      <button className="button" type="submit" disabled={pending}>{t.verify}</button>
      {pending && <p role="status">{t.working}</p>}
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}

/** Instead of the app's code, behind a disclosure so the usual path stays one field. */
export function BackupCodeVerify({ locale }: { locale: Locale }) {
  const t = getTwoFactorCopy(locale);
  const [state, submit, pending] = useActionState(verifyBackupCode.bind(null, locale), { message: '' });
  return (
    <details className="backup-code-verify">
      <summary>{t.useBackup}</summary>
      <form action={submit} className="organisation-form">
        <label className="form-field">
          {t.backupCode}
          <input name="code" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={40} required />
        </label>
        <button className="button" type="submit" disabled={pending}>{t.backupSubmit}</button>
        {pending && <p role="status">{t.working}</p>}
        {state.message && <p role="alert">{state.message}</p>}
      </form>
    </details>
  );
}
