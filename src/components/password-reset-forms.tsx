'use client';
import { useActionState } from 'react';
import { changePassword, requestPasswordReset, setNewPassword } from '@/app/auth/password-actions';
import type { Locale } from '@/lib/i18n';
import { getResetCopy, MAX_PASSWORD, MIN_PASSWORD } from '@/lib/password-reset';
import { getTwoFactorCopy } from '@/lib/two-factor';
import { Field, PasswordInput, useFormWarnings } from './form-field';

/** Step 1: the email address. The answer is the same whether or not an account exists. */
export function ResetRequestForm({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const t = getResetCopy(locale);
  const [state, submit, pending] = useActionState(requestPasswordReset.bind(null, locale), { message: '' });
  const w = useFormWarnings(locale, submit);
  if (state.sent) return <p className="auth-feedback" role="status">{state.message}</p>;
  return (
    <form {...w.form} className="organisation-form" aria-label={t.requestTitle}>
      {state.message && <div className="auth-feedback" role="alert">{state.message}</div>}
      <fieldset disabled={!enabled || pending}>
        <legend>{t.requestTitle}</legend>
        <Field w={w} name="email" label={t.email}>
          <input type="email" name="email" autoComplete="email" required maxLength={254} />
        </Field>
        <button className="button" type="submit">{pending ? t.sending : t.send}</button>
      </fieldset>
    </form>
  );
}

/** Step 3: the new password twice, and the two-factor code first when the account has one. */
export function SetPasswordForm({ locale, needsCode }: { locale: Locale; needsCode: boolean }) {
  const t = getResetCopy(locale);
  const [state, submit, pending] = useActionState(setNewPassword.bind(null, locale), { message: '' });
  const w = useFormWarnings(locale, submit);
  return (
    <form {...w.form} className="organisation-form" aria-label={t.setTitle}>
      {state.message && <div className="auth-feedback" role="alert">{state.message}</div>}
      <fieldset disabled={pending}>
        <legend>{t.setTitle}</legend>
        {needsCode && (
          <>
            <p>{t.codeIntro}</p>
            <Field w={w} name="code" label={getTwoFactorCopy(locale).code}>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
            </Field>
          </>
        )}
        <Field w={w} name="password" label={t.newPassword} hint={t.hint}>
          <PasswordInput locale={locale} name="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
        </Field>
        <Field w={w} name="repeat" label={t.repeatPassword}>
          <PasswordInput locale={locale} name="repeat" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
        </Field>
        <button className="button" type="submit">{pending ? t.saving : t.save}</button>
      </fieldset>
    </form>
  );
}

/** On the account page, for a signed-in person: the current password (and the two-factor code), then the new one twice. */
export function ChangePasswordForm({ locale, needsCode }: { locale: Locale; needsCode: boolean }) {
  const t = getResetCopy(locale);
  const [state, submit, pending] = useActionState(changePassword.bind(null, locale), { message: '' });
  const w = useFormWarnings(locale, submit);
  return (
    <section className="notice" aria-labelledby="change-password">
      <h2 id="change-password">{t.changeTitle}</h2>
      <p>{t.changeIntro}</p>
      {state.message && <div className="auth-feedback" role={state.sent ? 'status' : 'alert'}>{state.message}</div>}
      <form {...w.form} className="organisation-form" aria-labelledby="change-password" key={state.sent ? 'done' : 'open'}>
        <fieldset disabled={pending}>
          <Field w={w} name="current" label={t.currentPassword}>
            <PasswordInput locale={locale} name="current" autoComplete="current-password" required maxLength={MAX_PASSWORD} />
          </Field>
          {needsCode && (
            <Field w={w} name="code" label={getTwoFactorCopy(locale).code}>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
            </Field>
          )}
          <Field w={w} name="password" label={t.newPassword} hint={t.hint}>
            <PasswordInput locale={locale} name="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
          </Field>
          <Field w={w} name="repeat" label={t.repeatPassword}>
            <PasswordInput locale={locale} name="repeat" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} />
          </Field>
          <button className="button" type="submit">{pending ? t.saving : t.save}</button>
        </fieldset>
      </form>
    </section>
  );
}
