'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { getCopy, type Locale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { preparePhoto, readLocalPhoto, saveLocalPhoto } from '@/lib/local-photos';
import type { ZonePhoto, Zone } from '@/lib/demo';

export function useLocalPhoto(id?: string) {
  const [result, setResult] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let url: string | undefined;
    readLocalPhoto(id).then(blob => {
      if (!active) return;
      url = blob ? URL.createObjectURL(blob) : undefined;
      setResult({ id, url: url ?? null });
    }).catch(() => { if (active) setResult({ id, url: null }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return result?.id === id ? result : null;
}

export function ZonePhotoEditor({ zone, locale, disabled, onChange }: {
  zone: Zone; locale: Locale; disabled: boolean; onChange: (photo?: ZonePhoto) => void;
}) {
  const t = getOrganisationCopy(locale);
  const common = getCopy(locale);
  const local = useLocalPhoto(zone.photo?.id);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  const uploadSequence = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function upload(file?: File) {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    setBusy(true); setStatus(t.processing); setError(false);
    try {
      const blob = await preparePhoto(file);
      const id = crypto.randomUUID();
      await saveLocalPhoto(id, blob);
      if (!mounted.current || sequence !== uploadSequence.current) return;
      onChange({ id, alt: '', rights: '', photographedOn: '' });
      setStatus(t.photoAdded);
    } catch (cause) {
      if (!mounted.current || sequence !== uploadSequence.current) return;
      setError(true);
      setStatus(cause instanceof Error && cause.message === 'invalid-photo' ? t.invalidPhoto : t.photoFailed);
    } finally { if (mounted.current && sequence === uploadSequence.current) setBusy(false); }
  }

  return <fieldset className="photo-editor">
    <legend>{t.photo}</legend>
    <p id={`photo-hint-${zone.id}`}>{t.photoHint}</p>
    <label className="form-field"><span className="sr-only">{t.photo}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy}
        aria-describedby={`photo-hint-${zone.id}`} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; void upload(file);
        }}/>
    </label>
    <Image unoptimized src={local?.url || zone.illustration} alt={local?.url ? zone.photo?.alt || zone.title : common.illustration} width={600} height={400} className="draft-photo"/>
    {zone.photo && <>
      {local && !local.url && <p className="notice">{t.photoMissing}</p>}
      <div className="form-grid">
        <label className="form-field wide">{t.photoAlt}<textarea required maxLength={500} rows={2} value={zone.photo.alt} onChange={event => onChange({ ...zone.photo!, alt: event.target.value })}/></label>
        <div className="form-field"><label htmlFor={`photo-rights-${zone.id}`}>{t.photoRights}</label><input id={`photo-rights-${zone.id}`} aria-describedby={`rights-hint-${zone.id}`} required maxLength={500} value={zone.photo.rights} onChange={event => onChange({ ...zone.photo!, rights: event.target.value })}/><small id={`rights-hint-${zone.id}`}>{t.photoRightsHint}</small></div>
        <label className="form-field">{t.photoDate}<input required type="date" max={new Date().toISOString().slice(0,10)} value={zone.photo.photographedOn} onChange={event => onChange({ ...zone.photo!, photographedOn: event.target.value })}/></label>
      </div>
      <p>{t.sensitive}</p>
      <button type="button" className="text-button" disabled={busy} onClick={() => { onChange(undefined); setStatus(''); }}>{t.removePhoto}</button>
    </>}
    {status && <p role={error ? 'alert' : 'status'}>{status}</p>}
  </fieldset>;
}
