'use client';
import { useActionState, useEffect, useRef } from 'react';
import { deleteMyAccount } from '@/app/auth/account-actions';
import { signOut } from '@/app/auth/actions';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { fill, getDeletionCopy, longDate } from '@/lib/account-deletion';
import type { Locale } from '@/lib/i18n';
import { PasswordInput } from './form-field';

/**
 * Password (and code), one tick that names the date, then the result: the account is locked and the data is ready. The page
 * re-renders after the action, so this stays in the same place whether or not the account is locked (`lockedUntil`), and keeps
 * the download link it was given.
 */
export function DeleteAccountForm({ locale, enrolled, date, lockedUntil }: { locale: Locale; enrolled: boolean; date: string; lockedUntil?: string }) {
  const t = getDeletionCopy(locale);
  const [state, submit, pending] = useActionState(deleteMyAccount.bind(null, locale), { message: '' });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.done) heading.current?.focus();
  }, [state.done]);
  const signOutButton = <form action={signOut.bind(null, locale)}><button className="text-button" type="submit">{getOrganisationCopy(locale).signOut}</button></form>;
  if ((state.done && state.deleteAfter) || lockedUntil) {
    const day = longDate(state.deleteAfter || lockedUntil || '', locale);
    return (
      <section className="notice deletion-done" aria-labelledby="deletion-done">
        <h2 id="deletion-done" ref={heading} tabIndex={-1}>{t.doneTitle}</h2>
        <p>{fill(t.doneDate, { date: day })}</p>
        {state.link ? (
          <>
            <p><a className="button" href={state.link} download="neruma-data.zip">{t.download}</a></p>
            <p>{t.downloadNote}</p>
          </>
        ) : (
          <p>{fill(t.lostLink, { date: day })}</p>
        )}
        <p>{fill(t.doneRestore, { date: day })}</p>
        {signOutButton}
      </section>
    );
  }
  return (
    <form action={submit} className="organisation-form">
      <fieldset disabled={pending}>
        <legend>{t.title}</legend>
        <div className="form-field">
          <label htmlFor="delete-password">{t.password}</label>
          <PasswordInput locale={locale} id="delete-password" name="password" autoComplete="current-password" required maxLength={128} />
        </div>
        {enrolled && (
          <div className="form-field">
            <label htmlFor="delete-code">{t.code}</label>
            <input id="delete-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          </div>
        )}
        <label className="checkbox-label commitment"><input type="checkbox" name="understand" required />{fill(t.understand, { date })}</label>
        <button className="button button-outline" type="submit">{t.submit}</button>
      </fieldset>
      {pending && <p role="status">{t.working}</p>}
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}
