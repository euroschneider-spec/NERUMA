'use client';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';

/**
 * A button that asks first (DECISIONS.md, "When the app asks 'are you sure?'"), then submits a server action with fixed hidden
 * values. Used for what can't be undone with one click: restoring or erasing an account, erasing an organisation, deleting a report.
 */
export function ConfirmForm({ action, fields, label, title, body, confirm, cancel }: {
  action: (form: FormData) => void | Promise<void>; fields: Record<string, string>; label: string; title: string; body: string;
  confirm: string; cancel: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <form ref={form} action={action} className="inline-form">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <button type="button" className="button button-outline" onClick={() => setOpen(true)}>{label}</button>
      <ConfirmDialog open={open} title={title} body={body} confirm={confirm} cancel={cancel}
        onCancel={() => setOpen(false)} onConfirm={() => { setOpen(false); form.current?.requestSubmit(); }} />
    </form>
  );
}
