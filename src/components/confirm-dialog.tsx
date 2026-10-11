'use client';
import { useEffect, useRef } from 'react';

/**
 * A short question before something that can't be undone with one click. It is the browser's own modal
 * dialog, so focus stays inside it, Escape cancels, and focus goes back to where it was. Cancel has focus
 * first: pressing Enter by accident must not remove anything.
 */
export function ConfirmDialog({ open, title, body, confirm, cancel, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirm: string; cancel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-body" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-body">{body}</p>
      <div className="confirm-actions">
        <button type="button" className="button button-outline" autoFocus onClick={onCancel}>{cancel}</button>
        <button type="button" className="button" onClick={onConfirm}>{confirm}</button>
      </div>
    </dialog>
  );
}
