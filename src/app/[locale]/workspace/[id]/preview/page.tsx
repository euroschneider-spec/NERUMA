import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ReadAloud } from '@/components/read-aloud';
import { getAccessCopy } from '@/lib/accessibility-copy';
import { isLocale, getCopy } from '@/lib/i18n';
import { getWorkspaceCopy, photoUrl, sensoryChannels } from '@/lib/workspace';
import { loadPlace, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';

export const dynamic='force-dynamic';
export const metadata={title:'Private organisation draft preview',robots:{index:false,follow:false}};
export default async function DraftPreview({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;if(!isLocale(locale)) notFound();const t=getWorkspaceCopy(locale);const common=getCopy(locale);
  const context=await workspaceSession(locale);if(!workspaceConfigured()) notFound();
  const result=await loadPlace(context.supabase,id,context.organisations,locale);if(!result) notFound();const {draft}=result;const a=getAccessCopy(locale);
  const narration=[t.draft,t.boundary,draft.name,draft.city,draft.description,t.arrival,draft.arrivalInfo,
    ...draft.zones.map((zone,index)=>[`${common.step} ${index+1}. ${zone.title}`,zone.photo?.alt,zone.description,
      ...sensoryChannels.map(channel=>`${common[channel]}: ${common[zone.sensory[channel]]}`),
      zone.note?`${common.support}. ${zone.note}`:'',zone.next?`${common.predictability}. ${zone.next}`:'',zone.optional?t.optional:''].filter(Boolean).join('\n'))].filter(Boolean).join('\n');
  return <main id="main-content" className="container"><div className="page-heading"><p className="eyebrow">{t.draft}</p><h1>{draft.name || t.missing}</h1><p className="lead">{draft.city}</p></div>
    <div className="content-body"><p className="notice">{t.boundary}</p><ReadAloud locale={locale} text={narration} label={a.listenGuide}/>{result.missingTranslation && <p>{t.missing}</p>}
      {draft.description && <p>{draft.description}</p>}{draft.arrivalInfo && <section><h2>{t.arrival}</h2><p className="preserve-lines">{draft.arrivalInfo}</p></section>}
      {draft.zones.map((zone,index)=><section key={zone.id} className="builder-zone"><p className="eyebrow">{common.step} {index+1}</p><h2>{zone.title || t.missing}</h2>
        {zone.photo && <><div className="guide-media"><Image unoptimized src={photoUrl(zone.photo.storageKey)} alt={zone.photo.alt || t.photoPreview} width={600} height={400} className="draft-photo"/></div><p className="muted">{zone.photo.rights} · {zone.photo.photographedOn}</p></>}
        <p className="preserve-lines">{zone.description}</p><dl className="draft-sensory">{sensoryChannels.map(channel=><div key={channel}><dt>{common[channel]}</dt><dd>{common[zone.sensory[channel]]}</dd></div>)}</dl>
        {zone.note && <p className="notice preserve-lines">{zone.note}</p>}{zone.next && <p className="preserve-lines">{zone.next}</p>}{zone.optional && <p>{t.optional}</p>}
      </section>)}<div className="button-row"><Link className="button" href={`/${locale}/workspace/${id}`}>{t.edit}</Link></div>
    </div></main>;
}
