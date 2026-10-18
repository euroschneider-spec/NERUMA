'use client';
import { useActionState } from 'react';
import { changePassword, requestPasswordReset, setNewPassword } from '@/app/auth/password-actions';
import type { Locale } from '@/lib/i18n';
import { getResetCopy, MAX_PASSWORD, MIN_PASSWORD } from '@/lib/password-reset';
import { getTwoFactorCopy } from '@/lib/two-factor';

/** Step 1: the email address. The answer is the same whether or not an account exists. */
export function ResetRequestForm({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const t = getResetCopy(locale);
  const [state, submit, pending] = useActionState(requestPasswordReset.bind(null, locale), { message: '' });
  if (state.sent) return <p className="auth-feedback" role="status">{state.message}</p>;
  return (
    <form action={submit} className="organisation-form" aria-label={t.requestTitle}>
      {state.message && <div className="auth-feedback" role="alert">{state.message}</div>}
      <fieldset disabled={!enabled || pending}>
        <legend>{t.requestTitle}</legend>
        <label className="form-field">
          {t.email}
          <input type="email" name="email" autoComplete="email" required maxLength={254} />
        </label>
        <button className="button" type="submit">{pending ? t.sending : t.send}</button>
      </fieldset>
    </form>
  );
}

/** Step 3: the new password twice, and the two-factor code first when the account has one. */
export function SetPasswordForm({ locale, needsCode }: { locale: Locale; needsCode: boolean }) {
  const t = getResetCopy(locale);
  const [state, submit, pending] = useActionState(setNewPassword.bind(null, locale), { message: '' });
  return (
    <form action={submit} className="organisation-form" aria-label={t.setTitle}>
      {state.message && <div className="auth-feedback" role="alert">{state.message}</div>}
      <fieldset disabled={pending}>
        <legend>{t.setTitle}</legend>
        {needsCode && (
          <>
            <p>{t.codeIntro}</p>
            <label className="form-field">
              {getTwoFactorCopy(locale).code}
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
            </label>
          </>
        )}
        <div className="form-field">
          <label htmlFor="new-password">{t.newPassword}</label>
          <input id="new-password" type="password" name="password" autoComplete="new-password" aria-describedby="new-password-hint" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
          <small id="new-password-hint">{t.hint}</small>
        </div>
        <label className="form-field">
          {t.repeatPassword}
          <input type="password" name="repeat" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
        </label>
        <button className="button" type="submit">{pending ? t.saving : t.save}</button>
      </fieldset>
    </form>
  );
}

/** On the account page, for a signed-in person: the current password (and the two-factor code), then the new one twice. */
export function ChangePasswordForm({ locale, needsCode }: { locale: Locale; needsCode: boolean }) {
  const t = getResetCopy(locale);
  const [state, submit, pending] = useActionState(changePassword.bind(null, locale), { message: '' });
  return (
    <section className="notice" aria-labelledby="change-password">
      <h2 id="change-password">{t.changeTitle}</h2>
      <p>{t.changeIntro}</p>
      {state.message && <div className="auth-feedback" role={state.sent ? 'status' : 'alert'}>{state.message}</div>}
      <form action={submit} className="organisation-form" aria-labelledby="change-password" key={state.sent ? 'done' : 'open'}>
        <fieldset disabled={pending}>
          <label className="form-field">
            {t.currentPassword}
            <input type="password" name="current" autoComplete="current-password" required maxLength={MAX_PASSWORD} />
          </label>
          {needsCode && (
            <label className="form-field">
              {getTwoFactorCopy(locale).code}
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
            </label>
          )}
          <div className="form-field">
            <label htmlFor="change-new-password">{t.newPassword}</label>
            <input id="change-new-password" type="password" name="password" autoComplete="new-password" aria-describedby="change-new-password-hint" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
            <small id="change-new-password-hint">{t.hint}</small>
          </div>
          <label className="form-field">
            {t.repeatPassword}
            <input type="password" name="repeat" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
          </label>
          <button className="button" type="submit">{pending ? t.saving : t.save}</button>
        </fieldset>
      </form>
    </section>
  );
}
