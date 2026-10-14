'use client';
import { useActionState, useRef, useState } from 'react';
import { startDeletionFor } from '@/app/admin/deletion-actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { getDeletionCopy } from '@/lib/account-deletion';
import type { Locale } from '@/lib/i18n';

/** For someone who wrote in: their account email, and an "are you sure?" before the lock. */
export function StartDeletionForm({ locale }: { locale: Locale }) {
  const t = getDeletionCopy(locale);
  const [state, submit, pending] = useActionState(startDeletionFor.bind(null, locale), { message: '' });
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <form ref={form} action={submit} className="organisation-form" onSubmit={(event) => { if (!open && !form.current?.dataset.confirmed) { event.preventDefault(); setOpen(true); } }}>
      <p>{t.startHint}</p>
      <div className="form-field">
        <label htmlFor="deletion-email">{t.email}</label>
        <input id="deletion-email" type="email" name="email" autoComplete="off" required maxLength={254} />
      </div>
      <button className="button button-outline" type="submit" disabled={pending}>{t.startButton}</button>
      <ConfirmDialog open={open} title={t.startTitle} body={t.startBody} confirm={t.startButton} cancel={t.cancel}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          if (form.current) { form.current.dataset.confirmed = '1'; form.current.requestSubmit(); delete form.current.dataset.confirmed; }
        }} />
      {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
    </form>
  );
}
