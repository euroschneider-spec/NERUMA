'use client';
import { useActionState } from 'react';
import { addAdministrator } from '@/app/admin/superadmin-actions';
import { getSuperadminCopy } from '@/lib/superadmin';
import type { Locale } from '@/lib/i18n';

/** The email of someone who already has a confirmed account. */
export function AddAdministratorForm({ locale }: { locale: Locale }) {
  const t = getSuperadminCopy(locale);
  const [state, submit, pending] = useActionState(addAdministrator.bind(null, locale), { message: '' });
  return (
    <form action={submit} className="organisation-form">
      <p>{t.addHint}</p>
      <div className="form-field">
        <label htmlFor="administrator-email">{t.email}</label>
        <input id="administrator-email" type="email" name="email" autoComplete="off" required maxLength={254} />
      </div>
      <button className="button" type="submit" disabled={pending}>{t.add}</button>
      {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
    </form>
  );
}
