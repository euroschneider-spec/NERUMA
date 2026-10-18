'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCopy, type Locale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy, MAX_OWN_FIELDS, newOwnField, newZone, ownFieldKinds, yesNoAnswers, type OwnField, type RemovableField, parsePlaceDraft, placeTypes, sensoryChannels, sensoryLevels, type PlaceDraft, type OnlineZone, type OnlinePhoto } from '@/lib/workspace';
import { savePlaceDraft } from '@/app/workspace/actions';
import { DEMO_ORG, saveDemoPlace } from '@/lib/demo-workspace';
import { OnlinePhotoEditor } from './online-photo';
import { StepPhoto, type WorkspaceMode } from './step-photo';
import { ChoiceGroup } from './choice-group';
import { PublishButton } from './publish-button';
import { PublishDialog } from './publish-dialog';
import { getPublishingCopy, type Publication } from '@/lib/publishing';
import { getBillingCopy } from '@/lib/billing';
import { unpublishPlace } from '@/app/workspace/actions';
import { ConfirmDialog } from './confirm-dialog';

/** The small × beside a field that hides it from the step (the text is kept). */
function RemoveField({label,disabled,onClick,enabled=true}:{label:string;disabled:boolean;onClick:()=>void;enabled?:boolean}) {
  if(!enabled) return null;
  return <button type="button" className="remove-field" aria-label={label} title={label} disabled={disabled} onClick={onClick}><X size={14} aria-hidden="true"/></button>;
}

/**
 * The step editor. In the demo (`mode='demo'`) it is the same editor, but saving and photos stay in the visitor's
 * browser and publishing is switched off; the live workspace saves to the database.
 */
export function OnlineBuilder({locale,org,initial,persistedZoneIds,missingTranslation=false,fieldsEnabled=false,mode='live',publication}: {
  locale:Locale;org:string;initial:PlaceDraft;persistedZoneIds:string[];missingTranslation?:boolean;fieldsEnabled?:boolean;mode?:WorkspaceMode;publication?:Publication;
}) {
  const t=getWorkspaceCopy(locale);const common=getCopy(locale);const o=getOrganisationCopy(locale);const router=useRouter();
  const savedText=mode==='demo' ? t.demoSaved : t.saved;
  const p=getPublishingCopy(locale);
  // Publishing is live only in the real workspace, and only once its migration exists (`publication` is then set).
  const [live,setLive]=useState(publication);const [publishOpen,setPublishOpen]=useState(false);const [takeDown,setTakeDown]=useState(false);
  const [draft,setDraft]=useState(initial);const [dirty,setDirty]=useState(false);const [pending,setPending]=useState(false);
  const [persisted,setPersisted]=useState(new Set(persistedZoneIds));const [busyPhotos,setBusyPhotos]=useState(new Set<string>());
  const [message,setMessage]=useState(initial.revision>0?savedText:'');const [error,setError]=useState<'auth'|'conflict'|'other'|null>(null);
  const disabled=pending || busyPhotos.size>0;
  // Steps fold in place; the first one starts open, and a step you add opens so you can fill it in.
  const [openZones,setOpenZones]=useState(()=>new Set(initial.zones.slice(0,1).map(z=>z.id)));
  // Reordering is offered only while every step is folded: short cards are easy to drag, and nothing jumps under the pointer.
  const allFolded=draft.zones.length>1 && draft.zones.every(z=>!openZones.has(z.id));
  const [confirmRemove,setConfirmRemove]=useState<string|null>(null);
  const [dragIndex,setDragIndex]=useState<number|null>(null);
  function moveZone(from:number,to:number){if(from===to || to<0) return;change(current=>{const zones=[...current.zones];const [zone]=zones.splice(from,1);zones.splice(Math.min(to,zones.length),0,zone);return {...current,zones};});}
  function toggleZone(id:string){setOpenZones(current=>{const next=new Set(current);if(next.has(id)) next.delete(id);else next.add(id);return next;});}
  // A required field inside a folded step can't show its message: open that step, then ask again.
  function openInvalid(event:React.FormEvent<HTMLFormElement>){
    const target=event.target as HTMLInputElement;const body=target.closest<HTMLElement>('[data-zone-body]');
    if(!body?.hidden) return;
    setOpenZones(current=>new Set(current).add(body.dataset.zoneBody!));
    requestAnimationFrame(()=>target.reportValidity());
  }
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
  // Removing a field only hides it; its text stays in the draft and comes back when the field is added again.
  // Focus moves to the matching "Add a field" choice or into the new field, so keyboard users don't lose their place.
  function focusLater(id:string){requestAnimationFrame(()=>document.getElementById(id)?.focus());}
  function hideField(index:number,zoneId:string,name:RemovableField){zoneField(index,z=>({...z,hidden:[...z.hidden,name]}));focusLater(`add-${zoneId}-${name}`);}
  function showField(index:number,zoneId:string,name:RemovableField){
    zoneField(index,z=>({...z,hidden:z.hidden.filter(h=>h!==name)}));
    focusLater(`online-${name}-${zoneId}`);
  }
  function addOwnField(index:number,kind:OwnField['kind']){const own=newOwnField(kind);zoneField(index,z=>({...z,fields:[...z.fields,own]}));focusLater(`own-field-${own.id}`);}
  function removeOwnField(index:number,zoneId:string,id:string){zoneField(index,z=>({...z,fields:z.fields.filter(f=>f.id!==id)}));focusLater(`add-${zoneId}-text`);}
  function ownField(index:number,fieldIndex:number,update:Partial<OwnField>){zoneField(index,z=>({...z,fields:z.fields.map((f,i)=>i===fieldIndex?{...f,...update}:f)}));}
  const offeredLabel=(name:RemovableField)=>name==='photo' ? t.fieldPhoto : name==='note' ? common.note : name==='next' ? common.predictability : t.optional;
  function photoBusy(id:string,busy:boolean){setBusyPhotos(current=>{const next=new Set(current);if(busy) next.add(id);else next.delete(id);return next;});}
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(disabled) return;
    if(!parsePlaceDraft(draft,mode==='demo' ? DEMO_ORG : org)){setMessage(t.invalid);setError('other');return;}
    setPending(true);setMessage(t.saving);setError(null);
    try {
      const result=mode==='demo' ? saveDemoPlace(draft,locale) : await savePlaceDraft(org,locale,draft);
      if(!result.ok){setError(result.error==='conflict'?'conflict':result.error==='auth'?'auth':'other');setMessage(result.error==='conflict'?t.conflict:result.error==='invalid'?t.invalid:t.error);return;}
      setDraft(current=>({...current,revision:result.revision}));setPersisted(new Set(draft.zones.map(z=>z.id)));setDirty(false);setMessage(savedText);
      if(initial.revision===0) router.replace(`/${locale}/workspace/${draft.id}`);
    } catch {setError('other');setMessage(t.error);}
    finally {setPending(false);}
  }
  // Save, Preview and Publish sit at the top and the bottom of the editor. Only the bottom copy announces the result,
  // so a screen reader hears each message once.
  // Collapse all / Expand all, above and below the steps. Each shows only when it has something to do.
  const anyOpen=draft.zones.some(z=>openZones.has(z.id));
  const anyFolded=draft.zones.some(z=>!openZones.has(z.id));
  const foldBar=(withHint:boolean)=>draft.zones.length>1 && (anyOpen || anyFolded) && <p className="editor-fold">
    {anyOpen && <button type="button" className="text-button" onClick={()=>setOpenZones(new Set())}>{t.collapseAll}</button>}
    {anyFolded && <button type="button" className="text-button" onClick={()=>setOpenZones(new Set(draft.zones.map(z=>z.id)))}>{t.expandAll}</button>}
    {withHint && !allFolded && <span className="small-note">{t.reorderHint}</span>}
  </p>;
  const previewHref=`/${locale}/${mode==='demo' ? 'demo' : 'workspace'}/${draft.id}/preview`;
  // Publish: off in the demo, off before the publishing migration, waits for a saved version, otherwise it opens the confirm step.
  const canPublish=mode==='live' && live!==undefined;
  const publishButtons=<>
    {!canPublish ? <PublishButton label={t.publish} hint={mode==='demo' ? t.publishDemo : t.publishSoon} />
      : dirty || draft.revision===0 ? <PublishButton label={t.publish} hint={p.publishSaveFirst} />
      : <button className="button button-outline" type="button" disabled={disabled} onClick={()=>setPublishOpen(true)}>{t.publish}</button>}
    {canPublish && live?.published && <>
      <button className="button button-outline" type="button" disabled={disabled} onClick={()=>setTakeDown(true)}>{p.unpublish}</button>
      {live.slug && <Link className="quiet-link" href={`/${locale}/places/${live.slug}/guide`} target="_blank" rel="noopener noreferrer">{p.viewPublic}</Link>}
    </>}
  </>;
  const actions=(announce:boolean)=><div className={announce ? 'editor-actions is-bottom' : 'editor-actions'}>
    <button className="button" type="submit" disabled={disabled}>{pending?t.saving:t.save}</button>
    {draft.revision>0 ? <Link className="button button-outline" href={previewHref}>{t.preview}</Link> : <button className="button button-outline" type="button" disabled>{t.preview}</button>}
    {publishButtons}
    <p className="status-message" {...(announce ? {role:error?'alert':'status'} : {'aria-hidden':true as const})}>{message || (dirty?t.unsaved:'')}</p>
  </div>;
  return <>
    {missingTranslation && <p className="notice">{t.missing}</p>}
    <form onSubmit={save} onInvalidCapture={openInvalid} aria-label={t.edit}>
      {actions(false)}
      <fieldset className="online-fields" disabled={disabled}>
        <div className="form-grid">
          <label className="form-field wide">{t.location}<input name="location-name" required maxLength={160} value={draft.name} onChange={e=>field('name',e.target.value)}/></label>
          <label className="form-field wide">{t.city}<input required maxLength={160} value={draft.city} onChange={e=>field('city',e.target.value)}/></label>
          <label className="form-field wide">{t.address}<input maxLength={500} value={draft.address} onChange={e=>field('address',e.target.value)}/></label>
          <ChoiceGroup className="wide" label={t.kind} value={draft.placeType} onChange={value=>field('placeType',value as PlaceDraft['placeType'])} options={placeTypes.map((kind,i)=>({value:kind,label:kind==='other' ? t.kindOther : o.types[i]}))}/>
          <div className="form-field wide"><label htmlFor="online-description">{t.summary}</label><textarea id="online-description" rows={2} maxLength={2000} value={draft.description} onChange={e=>field('description',e.target.value)}/></div>
          <div className="form-field wide"><label htmlFor="online-arrivalInfo">{t.arrival}</label><textarea id="online-arrivalInfo" rows={3} maxLength={2000} value={draft.arrivalInfo} onChange={e=>field('arrivalInfo',e.target.value)}/></div>
        </div>
        {foldBar(true)}
        {draft.zones.map((zone,index)=>{
          const open=openZones.has(zone.id);
          const complete=Boolean(zone.title.trim() && zone.description.trim() && (!zone.photo || zone.hidden.includes('photo') || zone.photo.alt.trim())
            && zone.fields.every(f=>f.label.trim() && (f.kind!=='text' || f.value.trim())));
          const name=zone.title || String(index+1);
          return <section className="builder-zone" key={zone.id} aria-labelledby={`online-zone-${zone.id}`} data-open={open} data-dragging={dragIndex===index}
            draggable={allFolded && !disabled} onDragStart={event=>{setDragIndex(index);event.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDragIndex(null)}
            onDragOver={event=>{if(dragIndex!==null) event.preventDefault();}} onDrop={event=>{event.preventDefault();if(dragIndex!==null) moveZone(dragIndex,index);setDragIndex(null);}}>
          <div className="zone-head">
            {allFolded && <span className="zone-grip" title={t.dragStep} aria-hidden="true"><GripVertical size={18}/></span>}
            <h2 className="zone-heading"><button type="button" id={`online-zone-${zone.id}`} className="zone-toggle" aria-expanded={open} aria-controls={`online-zone-body-${zone.id}`} onClick={()=>toggleZone(zone.id)}>
              {zone.photo && <StepPhoto mode={mode} storageKey={zone.photo.storageKey} alt="" width={40} height={40} className="zone-thumb"/>}
              <span className="zone-toggle-title">{common.step} {index+1}{zone.title?` · ${zone.title}`:''}</span>
              {!complete && <span className="zone-needs">{t.stepIncomplete}</span>}
              <ChevronDown size={20} aria-hidden="true" className="zone-chevron"/>
            </button></h2>
            {allFolded && <span className="zone-move">
              <button type="button" disabled={disabled || index===0} onClick={()=>moveZone(index,index-1)} aria-label={`${t.moveUp}: ${name}`} title={t.moveUp}><ArrowUp size={16} aria-hidden="true"/></button>
              <button type="button" disabled={disabled || index===draft.zones.length-1} onClick={()=>moveZone(index,index+1)} aria-label={`${t.moveDown}: ${name}`} title={t.moveDown}><ArrowDown size={16} aria-hidden="true"/></button>
            </span>}
          </div>
          <div id={`online-zone-body-${zone.id}`} className="zone-body" data-zone-body={zone.id} hidden={!open}>
          <div className="form-grid">
            <label className="form-field wide">{t.stepName}<input required maxLength={160} value={zone.title} onChange={e=>zoneField(index,z=>({...z,title:e.target.value}))}/></label>
            <div className="form-field wide"><label htmlFor={`online-description-${zone.id}`}>{common.description}</label><textarea id={`online-description-${zone.id}`} required rows={3} maxLength={2000} value={zone.description} onChange={e=>zoneField(index,z=>({...z,description:e.target.value}))}/></div>
          </div>
          {!zone.hidden.includes('photo') && <OnlinePhotoEditor zone={zone} placeId={draft.id} locale={locale} mode={mode} persisted={mode==='demo' || persisted.has(zone.id)} disabled={disabled} onBusy={busy=>photoBusy(zone.id,busy)} onChange={(photo?:OnlinePhoto)=>zoneField(index,z=>({...z,photo}))}/>}
          <fieldset className="sensory-fields"><legend>{locale==='ro'?'Profil senzorial':locale==='de'?'Sensorisches Profil':'Sensory profile'}</legend>
            {sensoryChannels.map(channel=><ChoiceGroup key={channel} label={common[channel]} value={zone.sensory[channel]} onChange={value=>zoneField(index,z=>({...z,sensory:{...z.sensory,[channel]:value}}))} options={sensoryLevels.map(level=>({value:level,label:common[level]}))}/>)}
          </fieldset>
          {!zone.hidden.includes('note') && <div className="form-field"><span className="label-row"><label htmlFor={`online-note-${zone.id}`}>{common.note}</label><RemoveField enabled={fieldsEnabled} label={`${t.removeField}: ${common.note}`} disabled={disabled} onClick={()=>hideField(index,zone.id,'note')}/></span><textarea id={`online-note-${zone.id}`} rows={2} maxLength={2000} value={zone.note} onChange={e=>zoneField(index,z=>({...z,note:e.target.value}))}/></div>}
          {!zone.hidden.includes('next') && <div className="form-field"><span className="label-row"><label htmlFor={`online-next-${zone.id}`}>{common.predictability}</label><RemoveField enabled={fieldsEnabled} label={`${t.removeField}: ${common.predictability}`} disabled={disabled} onClick={()=>hideField(index,zone.id,'next')}/></span><textarea id={`online-next-${zone.id}`} rows={2} maxLength={2000} value={zone.next} onChange={e=>zoneField(index,z=>({...z,next:e.target.value}))}/></div>}
          {!zone.hidden.includes('optional') && <div className="commitment label-row"><label className="checkbox-label"><input id={`online-optional-${zone.id}`} type="checkbox" checked={zone.optional} onChange={e=>zoneField(index,z=>({...z,optional:e.target.checked}))}/>{t.optional}</label><RemoveField enabled={fieldsEnabled} label={`${t.removeField}: ${t.optional}`} disabled={disabled} onClick={()=>hideField(index,zone.id,'optional')}/></div>}
          {zone.fields.map((own,fieldIndex)=><div className="own-field" key={own.id}>
            <div className="label-row own-field-head"><span className="small-label">{own.kind==='text' ? t.fieldShortText : t.fieldYesNo}</span><RemoveField enabled={fieldsEnabled} label={`${t.removeField}: ${own.label || (own.kind==='text' ? t.fieldShortText : t.fieldYesNo)}`} disabled={disabled} onClick={()=>removeOwnField(index,zone.id,own.id)}/></div>
            <div className="form-grid">
              <label className="form-field wide">{own.kind==='text' ? t.ownLabel : t.ownQuestion}<input id={`own-field-${own.id}`} required maxLength={80} value={own.label} onChange={e=>ownField(index,fieldIndex,{label:e.target.value})}/></label>
              {own.kind==='text'
                ? <label className="form-field wide">{t.ownValue}<input maxLength={500} value={own.value} onChange={e=>ownField(index,fieldIndex,{value:e.target.value})}/></label>
                : <ChoiceGroup className="wide" label={t.ownAnswer} value={own.answer} onChange={value=>ownField(index,fieldIndex,{answer:value as OwnField['answer']})} options={yesNoAnswers.map(answer=>({value:answer,label:answer==='yes' ? t.answerYes : answer==='no' ? t.answerNo : t.answerUnanswered}))}/>}
            </div>
          </div>)}
          {fieldsEnabled && <div className="add-field" role="group" aria-labelledby={`add-field-${zone.id}`}>
            <span id={`add-field-${zone.id}`} className="choice-label">{t.addField}</span>
            <div className="add-field-options">
              {zone.hidden.map(name=><button key={name} id={`add-${zone.id}-${name}`} type="button" className="button button-outline button-small" disabled={disabled} onClick={()=>showField(index,zone.id,name)}><Plus size={14} aria-hidden="true"/>{offeredLabel(name)}</button>)}
              {ownFieldKinds.map(kind=><button key={kind} id={`add-${zone.id}-${kind}`} type="button" className="button button-outline button-small" disabled={disabled || zone.fields.length>=MAX_OWN_FIELDS} onClick={()=>addOwnField(index,kind)}><Plus size={14} aria-hidden="true"/>{kind==='text' ? t.fieldShortText : t.fieldYesNo}</button>)}
            </div>
            {zone.fields.length>=MAX_OWN_FIELDS && <p className="small-note">{t.fieldLimit}</p>}
          </div>}
          <div className="zone-remove"><button type="button" className="text-button" disabled={disabled || draft.zones.length===1} onClick={()=>setConfirmRemove(zone.id)} aria-label={`${t.removeZone}: ${zone.title || index+1}`}>{t.removeZone}</button></div>
          </div>
        </section>;})}
        {foldBar(false)}
        <div className="editor-add"><button id="add-zone" className="button button-outline" type="button" disabled={disabled || draft.zones.length>=8} onClick={()=>{const zone=newZone();setOpenZones(current=>new Set(current).add(zone.id));change(current=>({...current,zones:[...current.zones,zone]}));}}>{t.addZone}</button></div>
      </fieldset>
      {actions(true)}
    </form>
    {canPublish && <PublishDialog open={publishOpen} locale={locale} org={org} placeId={draft.id} revision={draft.revision} onClose={()=>setPublishOpen(false)}
      onPublished={result=>{setLive({published:true,slug:result.slug});setError(null);setMessage(p.publishDone);router.refresh();}}
      onFailed={failure=>{setError(failure==='auth'?'auth':failure==='conflict'?'conflict':'other');setMessage(failure==='conflict'?p.publishConflict:failure==='auth'?p.publishAuth:failure==='nothing'?p.publishNothing:failure==='plan'?getBillingCopy(locale).publishNeedsPlan:p.publishError);}}/>}
    {canPublish && <ConfirmDialog open={takeDown} title={p.unpublishTitle} body={p.unpublishBody} confirm={p.unpublish} cancel={t.cancel} onCancel={()=>setTakeDown(false)}
      onConfirm={async()=>{
        setTakeDown(false);
        const result=await unpublishPlace(org,draft.id).catch(()=>({ok:false}));
        if(result.ok){setLive({published:false,slug:live?.slug});setError(null);setMessage(p.unpublishDone);router.refresh();}
        else {setError('other');setMessage(p.unpublishError);}
      }}/>}
    <ConfirmDialog open={confirmRemove!==null} title={t.removeConfirmTitle} body={t.removeConfirmBody} confirm={t.removeConfirm} cancel={t.cancel}
      onCancel={()=>setConfirmRemove(null)}
      onConfirm={()=>{const id=confirmRemove;setConfirmRemove(null);if(id){change(current=>({...current,zones:current.zones.filter(z=>z.id!==id)}));focusLater('add-zone');}}}/>
    {error==='conflict' && <a className="quiet-link" href={`/${locale}/workspace/${draft.id}`} target="_blank" rel="noopener noreferrer">{t.reload}</a>}
    {error==='auth' && <Link className="quiet-link" href={`/${locale}/login`}>{t.login}</Link>}
  </>;
}
