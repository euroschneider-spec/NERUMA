'use client';

import Image from 'next/image';
import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { preparePhoto } from '@/lib/local-photos';
import { getWorkspaceCopy, MAX_ONLINE_PHOTO, photoUrl, uuidPattern, type OnlinePhoto, type OnlineZone } from '@/lib/workspace';
import { InfoTip } from './info-tip';

export function OnlinePhotoEditor({zone,placeId,locale,persisted,disabled,onChange,onBusy}: {
  zone:OnlineZone;placeId:string;locale:Locale;persisted:boolean;disabled:boolean;
  onChange:(photo?:OnlinePhoto)=>void;onBusy:(busy:boolean)=>void;
}) {
  const t=getWorkspaceCopy(locale);const o=getOrganisationCopy(locale);
  const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [error,setError]=useState(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function upload(file:File) {
    setBusy(true);onBusy(true);setError(false);setStatus(o.processing);
    try {
      const blob=await preparePhoto(file);
      if(blob.type!=='image/webp' || blob.size>MAX_ONLINE_PHOTO) throw new Error('invalid-photo');
      const form=new FormData();form.set('file',blob,'zone.webp');form.set('placeId',placeId);form.set('zoneId',zone.id);
      const response=await fetch('/api/workspace/photos',{method:'POST',body:form});
      if(!response.ok) throw new Error('upload-failed');
      const result=await response.json();
      if(typeof result.id!=='string' || !uuidPattern.test(result.id) || typeof result.storageKey!=='string') throw new Error('upload-failed');
      if(!mounted.current) return;
      onChange({id:result.id,storageKey:result.storageKey,alt:'',rights:'',photographedOn:''});setStatus(t.photoAdded);
    } catch(cause) {
      if(!mounted.current) return;
      setError(true);setStatus(cause instanceof Error && cause.message==='invalid-photo' ? o.invalidPhoto : t.photoError);
    } finally {if(mounted.current){setBusy(false);onBusy(false);}}
  }
  return <fieldset className="photo-editor" disabled={disabled || busy}>
    <legend>{o.photo}</legend>
    {!persisted && <p className="notice">{t.saveFirst}</p>}
    <label className="file-pick">
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={!persisted || disabled || busy}
        aria-describedby={`online-photo-hint-${zone.id}`} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file) void upload(file);}}/>
      <span className="file-pick-action"><Upload size={18} aria-hidden="true" />{t.choosePhoto}</span>
      <span className="file-pick-status">{zone.photo ? t.photoAttached : t.noPhoto}</span>
    </label>
    <p id={`online-photo-hint-${zone.id}`} className="label-row">{t.photoHint}<InfoTip text={t.photoPrivacy} label={t.moreInfo} /></p>
    {zone.photo ? <>
      <Image unoptimized src={photoUrl(zone.photo.storageKey)} alt={zone.photo.alt || t.photoPreview} width={600} height={400} className="draft-photo"/>
      <div className="form-grid">
        <div className="form-field wide"><label htmlFor={`online-photo-alt-${zone.id}`}>{o.photoAlt}</label><textarea id={`online-photo-alt-${zone.id}`} required maxLength={500} rows={2} value={zone.photo.alt} onChange={e=>onChange({...zone.photo!,alt:e.target.value})}/></div>
        <label className="form-field">{o.photoRights}<input required maxLength={500} value={zone.photo.rights} onChange={e=>onChange({...zone.photo!,rights:e.target.value})}/></label>
        <label className="form-field">{o.photoDate}<input required type="date" max={new Date().toISOString().slice(0,10)} value={zone.photo.photographedOn} onChange={e=>onChange({...zone.photo!,photographedOn:e.target.value})}/></label>
      </div><p>{o.sensitive}</p><p className="muted">{t.retained}</p>
      <button type="button" className="text-button" onClick={()=>{onChange(undefined);setStatus('');}}>{t.removePhoto}</button>
    </> : null}
    {status && <p role={error?'alert':'status'}>{status}</p>}
  </fieldset>;
}
