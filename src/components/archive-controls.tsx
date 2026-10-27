'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archivePlace, restorePlace } from '@/app/workspace/actions';
import { getArchiveCopy } from '@/lib/archive-places';
import type { Locale } from '@/lib/i18n';
import { fill } from '@/lib/publishing';
import { ConfirmDialog } from './confirm-dialog';

/** "Archive" on a location card: asks first, then the location leaves the dashboard (and its guide goes offline if it was published). */
export function ArchiveButton({ locale, org, place, name, published }: { locale: Locale; org: string; place: string; name: string; published: boolean }) {
  const t = getArchiveCopy(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const confirm = () => {
    setFailed(false);
    start(async () => {
      const result = await archivePlace(org, place);
      setOpen(false);
      if (result.ok) router.refresh();
      else setFailed(true);
    });
  };
  return (
    <>
      <button type="button" className="button button-outline button-small" disabled={pending} aria-label={fill(t.archiveAria, { name })} onClick={() => setOpen(true)}>{t.archive}</button>
      <ConfirmDialog open={open} title={fill(t.title, { name })} body={published ? t.bodyPublished : t.bodyDraft} confirm={t.confirm} cancel={t.cancel}
        onConfirm={confirm} onCancel={() => setOpen(false)} />
      {failed && <p role="alert" className="small-note">{t.error}</p>}
    </>
  );
}

/** One row of the archive: the location's name and a button that brings it back as a draft. */
export function RestoreButton({ locale, org, place, name }: { locale: Locale; org: string; place: string; name: string }) {
  const t = getArchiveCopy(locale);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const restore = () => {
    setFailed(false);
    start(async () => {
      const result = await restorePlace(org, place);
      if (result.ok) router.refresh();
      else setFailed(true);
    });
  };
  return (
    <>
      <button type="button" className="button button-outline button-small" disabled={pending} aria-label={fill(t.restoreAria, { name })} onClick={restore}>{t.restore}</button>
      {failed && <span role="alert" className="small-note">{t.error}</span>}
    </>
  );
}
