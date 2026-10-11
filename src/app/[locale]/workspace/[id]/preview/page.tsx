import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ReadAloud } from '@/components/read-aloud';
import { getAccessCopy } from '@/lib/accessibility-copy';
import { isLocale, getCopy } from '@/lib/i18n';
import { getWorkspaceCopy, photoUrl, sensoryChannels, visibleZone, type OwnField } from '@/lib/workspace';
import { loadPlace, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';

export const dynamic='force-dynamic';
// The browser tab speaks the page's language too.
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;const t=getWorkspaceCopy(isLocale(locale) ? locale : 'en');
  return {title:t.draft,robots:{index:false,follow:false}};
}
export default async function DraftPreview({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;if(!isLocale(locale)) notFound();const t=getWorkspaceCopy(locale);const common=getCopy(locale);
  const context=await workspaceSession(locale);if(!workspaceConfigured()) notFound();
  const result=await loadPlace(context.supabase,id,context.organisations,locale);if(!result) notFound();const {draft}=result;const a=getAccessCopy(locale);
  const shown=draft.zones.map(visibleZone);
  const fieldValue=(f:OwnField)=>f.kind==='text' ? f.value : f.answer==='yes' ? t.answerYes : t.answerNo;
  const narration=[t.draft,t.boundary,draft.name,draft.city,draft.description,t.arrival,draft.arrivalInfo,
    ...draft.zones.map((zone,index)=>{const v=shown[index];return [`${common.step} ${index+1}. ${zone.title}`,v.photo?.alt,zone.description,
      ...sensoryChannels.map(channel=>`${common[channel]}: ${common[zone.sensory[channel]]}`),
      v.note?`${common.support}. ${v.note}`:'',v.next?`${common.predictability}. ${v.next}`:'',
      ...v.fields.map(f=>`${f.label}: ${fieldValue(f)}`),v.optional?t.optional:''].filter(Boolean).join('\n');})].filter(Boolean).join('\n');
  return <main id="main-content" className="app-main"><div className="app-heading"><div><h1>{draft.name || t.missing}</h1>{draft.city && <p className="lead">{draft.city}</p>}</div>
      <Link className="button" href={`/${locale}/workspace/${id}`}>{t.edit}</Link></div>
    <div className="content-body"><p className="notice">{t.boundary}</p><ReadAloud locale={locale} text={narration} label={a.listenGuide}/>{result.missingTranslation && <p>{t.missing}</p>}
      {draft.description && <p className="lead">{draft.description}</p>}{draft.arrivalInfo && <section><h2>{t.arrival}</h2><p className="preserve-lines">{draft.arrivalInfo}</p></section>}
      {draft.zones.map((zone,index)=>{const v=shown[index];return <section key={zone.id} className="builder-zone"><p className="eyebrow">{common.step} {index+1}</p><h2>{zone.title || t.missing}</h2>
        {v.photo && <><div className="guide-media"><Image unoptimized src={photoUrl(v.photo.storageKey)} alt={v.photo.alt || t.photoPreview} width={600} height={400} className="draft-photo"/></div><p className="muted">{v.photo.rights} · {v.photo.photographedOn}</p></>}
        <p className="preserve-lines">{zone.description}</p><dl className="draft-sensory">{sensoryChannels.map(channel=><div key={channel}><dt>{common[channel]}</dt><dd>{common[zone.sensory[channel]]}</dd></div>)}</dl>
        {v.note && <p className="notice preserve-lines">{v.note}</p>}{v.next && <p className="preserve-lines">{v.next}</p>}
        {v.fields.length>0 && <dl className="own-fields">{v.fields.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{fieldValue(f)}</dd></div>)}</dl>}
        {v.optional && <p>{t.optional}</p>}
      </section>;})}<div className="button-row"><Link className="button" href={`/${locale}/workspace/${id}`}>{t.edit}</Link></div>
    </div></main>;
}
