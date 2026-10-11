'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCopy, type Locale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy, newZone, parsePlaceDraft, placeTypes, sensoryChannels, sensoryLevels, type PlaceDraft, type OnlineZone, type OnlinePhoto } from '@/lib/workspace';
import { savePlaceDraft } from '@/app/workspace/actions';
import { OnlinePhotoEditor } from './online-photo';
import { ChoiceGroup } from './choice-group';
import { PublishButton } from './publish-button';

export function OnlineBuilder({locale,org,initial,persistedZoneIds,missingTranslation=false}: {
  locale:Locale;org:string;initial:PlaceDraft;persistedZoneIds:string[];missingTranslation?:boolean;
}) {
  const t=getWorkspaceCopy(locale);const common=getCopy(locale);const o=getOrganisationCopy(locale);const router=useRouter();
  const [draft,setDraft]=useState(initial);const [dirty,setDirty]=useState(false);const [pending,setPending]=useState(false);
  const [persisted,setPersisted]=useState(new Set(persistedZoneIds));const [busyPhotos,setBusyPhotos]=useState(new Set<string>());
  const [message,setMessage]=useState(initial.revision>0?t.saved:'');const [error,setError]=useState<'auth'|'conflict'|'other'|null>(null);
  const disabled=pending || busyPhotos.size>0;
  useEffect(()=>{
    if(!dirty) return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const beforeLink=(event:MouseEvent)=>{
      if(event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof Element)) return;
      const link=event.target.closest<HTMLAnchorElement>('a[href]');
      if(!link || link.target==='_blank' || link.hasAttribute('download') || new URL(link.href).pathname===window.location.pathname) return;
      if(!window.confirm(t.discard)){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload',beforeUnload);document.addEventListener('click',beforeLink,true);
    return()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',beforeLink,true);};
  },[dirty,t.discard]);
  function change(update:(current:PlaceDraft)=>PlaceDraft){setDraft(update);setDirty(true);setMessage('');setError(null);}
  function field<K extends keyof Omit<PlaceDraft,'id'|'revision'|'zones'>>(key:K,value:PlaceDraft[K]){change(current=>({...current,[key]:value}));}
  function zoneField(index:number,update:(zone:OnlineZone)=>OnlineZone){change(current=>({...current,zones:current.zones.map((zone,i)=>i===index?update(zone):zone)}));}
  function photoBusy(id:string,busy:boolean){setBusyPhotos(current=>{const next=new Set(current);if(busy) next.add(id);else next.delete(id);return next;});}
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(disabled) return;
    if(!parsePlaceDraft(draft,org)){setMessage(t.invalid);setError('other');return;}
    setPending(true);setMessage(t.saving);setError(null);
    try {
      const result=await savePlaceDraft(org,locale,draft);
      if(!result.ok){setError(result.error==='conflict'?'conflict':result.error==='auth'?'auth':'other');setMessage(result.error==='conflict'?t.conflict:result.error==='invalid'?t.invalid:t.error);return;}
      setDraft(current=>({...current,revision:result.revision}));setPersisted(new Set(draft.zones.map(z=>z.id)));setDirty(false);setMessage(t.saved);
      if(initial.revision===0) router.replace(`/${locale}/workspace/${draft.id}`);
    } catch {setError('other');setMessage(t.error);}
    finally {setPending(false);}
  }
  // Save, Preview and Publish sit at the top and the bottom of the editor. Only the bottom copy announces the result,
  // so a screen reader hears each message once.
  const actions=(announce:boolean)=><div className="editor-actions">
    <button className="button" type="submit" disabled={disabled}>{pending?t.saving:t.save}</button>
    {draft.revision>0 ? <Link className="button button-outline" href={`/${locale}/workspace/${draft.id}/preview`}>{t.preview}</Link> : <button className="button button-outline" type="button" disabled>{t.preview}</button>}
    <PublishButton label={t.publish} hint={t.publishSoon} />
    <p className="status-message" {...(announce ? {role:error?'alert':'status'} : {'aria-hidden':true as const})}>{message || (dirty?t.unsaved:'')}</p>
  </div>;
  return <>
    {missingTranslation && <p className="notice">{t.missing}</p>}
    <form onSubmit={save} aria-label={t.edit}>
      {actions(false)}
      <fieldset className="online-fields" disabled={disabled}>
        <div className="form-grid">
          <label className="form-field wide">{t.location}<input name="location-name" required maxLength={160} value={draft.name} onChange={e=>field('name',e.target.value)}/></label>
          <label className="form-field wide">{t.city}<input required maxLength={160} value={draft.city} onChange={e=>field('city',e.target.value)}/></label>
          <label className="form-field wide">{t.address}<input maxLength={500} value={draft.address} onChange={e=>field('address',e.target.value)}/></label>
          <ChoiceGroup label={t.kind} value={draft.placeType} onChange={value=>field('placeType',value as PlaceDraft['placeType'])} options={placeTypes.map((kind,i)=>({value:kind,label:kind==='other' ? t.kindOther : o.types[i]}))}/>
          <div className="form-field wide"><label htmlFor="online-description">{t.summary}</label><textarea id="online-description" rows={2} maxLength={2000} value={draft.description} onChange={e=>field('description',e.target.value)}/></div>
          <div className="form-field wide"><label htmlFor="online-arrivalInfo">{t.arrival}</label><textarea id="online-arrivalInfo" rows={3} maxLength={2000} value={draft.arrivalInfo} onChange={e=>field('arrivalInfo',e.target.value)}/></div>
        </div>
        {draft.zones.map((zone,index)=><section className="builder-zone" key={zone.id} aria-labelledby={`online-zone-${zone.id}`}>
          <h2 id={`online-zone-${zone.id}`}>{common.step} {index+1}{zone.title?` · ${zone.title}`:''}</h2>
          <div className="button-row zone-order"><button type="button" className="text-button" disabled={disabled || draft.zones.length===1} onClick={()=>change(current=>({...current,zones:current.zones.filter(z=>z.id!==zone.id)}))} aria-label={`${t.removeZone}: ${zone.title || index+1}`}>{t.removeZone}</button></div>
          <div className="form-grid">
            <label className="form-field wide">{common.zoneName}<input required maxLength={160} value={zone.title} onChange={e=>zoneField(index,z=>({...z,title:e.target.value}))}/></label>
            <div className="form-field wide"><label htmlFor={`online-description-${zone.id}`}>{common.description}</label><textarea id={`online-description-${zone.id}`} required rows={3} maxLength={2000} value={zone.description} onChange={e=>zoneField(index,z=>({...z,description:e.target.value}))}/></div>
          </div>
          <OnlinePhotoEditor zone={zone} placeId={draft.id} locale={locale} persisted={persisted.has(zone.id)} disabled={disabled} onBusy={busy=>photoBusy(zone.id,busy)} onChange={(photo?:OnlinePhoto)=>zoneField(index,z=>({...z,photo}))}/>
          <fieldset className="sensory-fields"><legend>{locale==='ro'?'Profil senzorial':locale==='de'?'Sensorisches Profil':'Sensory profile'}</legend>
            {sensoryChannels.map(channel=><ChoiceGroup key={channel} label={common[channel]} value={zone.sensory[channel]} onChange={value=>zoneField(index,z=>({...z,sensory:{...z.sensory,[channel]:value}}))} options={sensoryLevels.map(level=>({value:level,label:common[level]}))}/>)}
          </fieldset>
          <div className="form-field"><label htmlFor={`online-note-${zone.id}`}>{common.note}</label><textarea id={`online-note-${zone.id}`} rows={2} maxLength={2000} value={zone.note} onChange={e=>zoneField(index,z=>({...z,note:e.target.value}))}/></div>
          <div className="form-field"><label htmlFor={`online-next-${zone.id}`}>{common.predictability}</label><textarea id={`online-next-${zone.id}`} rows={2} maxLength={2000} value={zone.next} onChange={e=>zoneField(index,z=>({...z,next:e.target.value}))}/></div>
          <label className="checkbox-label commitment"><input type="checkbox" checked={zone.optional} onChange={e=>zoneField(index,z=>({...z,optional:e.target.checked}))}/>{t.optional}</label>
        </section>)}
        <div className="editor-add"><button className="button button-outline" type="button" disabled={disabled || draft.zones.length>=8} onClick={()=>change(current=>({...current,zones:[...current.zones,newZone()]}))}>{t.addZone}</button></div>
      </fieldset>
      {actions(true)}
    </form>
    {error==='conflict' && <a className="quiet-link" href={`/${locale}/workspace/${draft.id}`} target="_blank" rel="noopener noreferrer">{t.reload}</a>}
    {error==='auth' && <Link className="quiet-link" href={`/${locale}/login`}>{t.login}</Link>}
  </>;
}
