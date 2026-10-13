'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { makeBackupCodes } from '@/app/auth/two-factor-actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Locale } from '@/lib/i18n';
import { getTwoFactorCopy, groupedKey, type BackupCodes } from '@/lib/two-factor';

/**
 * A new set of backup codes, shown once: the list, a text file to keep, and the way on. Focus moves to the heading so a
 * screen reader announces the codes rather than leaving the person on a button that no longer exists.
 */
export function BackupCodeList({ locale, codes, next }: { locale: Locale; codes: string[]; next: string }) {
  const t = getTwoFactorCopy(locale);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const file = `NERUMA · ${t.backupTitle}\n\n${codes.map(groupedKey).join('\n')}\n`;
  return (
    <div className="backup-codes">
      <h3 ref={heading} tabIndex={-1}>{t.backupTitle}</h3>
      <p>{t.backupIntro}</p>
      <ol className="backup-code-list">
        {codes.map((code) => <li key={code}><code>{groupedKey(code)}</code></li>)}
      </ol>
      <div className="button-row">
        <a className="button button-outline" download="neruma-backup-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(file)}`}>{t.backupDownload}</a>
        <Link className="button" href={next}>{t.continue}</Link>
      </div>
    </div>
  );
}

/** Backup codes on the account page once two-factor is on: how many are left, and making the first or a new set. */
export function BackupCodesPanel({ locale, backup }: { locale: Locale; backup: Exclude<BackupCodes, { state: 'off' }> }) {
  const t = getTwoFactorCopy(locale);
  const [state, submit, pending] = useActionState(makeBackupCodes.bind(null, locale), { message: '' });
  const [confirming, setConfirming] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  if (state.codes && state.next) return <BackupCodeList locale={locale} codes={state.codes} next={state.next} />;
  const replace = backup.state === 'some';
  return (
    <div className="backup-codes">
      <h3>{t.backupTitle}</h3>
      <p>{replace ? t.backupLeft.replace('{left}', String(backup.remaining)).replace('{total}', String(backup.total)) : t.backupNone}</p>
      <form ref={form} action={submit}>
        <input type="hidden" name="replace" value={replace ? '1' : '0'} />
        {replace ? (
          <button className="button button-outline" type="button" disabled={pending} onClick={() => setConfirming(true)}>{t.backupNew}</button>
        ) : (
          <button className="button button-outline" type="submit" disabled={pending}>{t.backupCreate}</button>
        )}
      </form>
      <ConfirmDialog
        open={confirming}
        title={t.backupNewTitle}
        body={t.backupNewBody}
        confirm={t.backupNewConfirm}
        cancel={t.cancel}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          form.current?.requestSubmit();
        }}
      />
      {pending && <p role="status">{t.working}</p>}
      {state.message && <p role="alert">{state.message}</p>}
    </div>
  );
}
