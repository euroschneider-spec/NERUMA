import type { RefObject } from 'react';
import { getCopy, type Locale } from '@/lib/i18n';
import { getAccessCopy } from '@/lib/accessibility-copy';
import { getPublishingCopy } from '@/lib/publishing';
import type { Guide, SensoryProfile } from '@/lib/demo';

export function GuideText({locale,guide,headingRef}:{locale:Locale;guide:Guide;headingRef:RefObject<HTMLHeadingElement|null>}) {
  const t=getCopy(locale);const a=getAccessCopy(locale);const p=getPublishingCopy(locale);
  return <section className="guide-text-view" aria-labelledby="guide-text-heading"><h2 id="guide-text-heading" ref={headingRef} tabIndex={-1}>{a.textTitle}</h2><p>{a.textIntro}</p>
    <ol className="guide-text-steps">{guide.zones.map((zone,index)=><li key={zone.id}>
      <p className="eyebrow">{t.step} {index+1} {t.of} {guide.zones.length}</p><h3>{zone.title}</h3>
      <p className="preserve-lines">{zone.description}</p>
      {zone.photo && <p className="small-note">{a.photoDescription}: {zone.photo.alt} · {zone.photo.rights} · {zone.photo.photographedOn}</p>}
      <dl className="draft-sensory">{(['sound','light','crowding','smell','temperature','visual'] as (keyof SensoryProfile)[]).map(channel=><div key={channel}><dt>{t[channel]}</dt><dd>{t[zone.sensory[channel]]}</dd></div>)}</dl>
      {zone.note && <><h4>{t.support}</h4><p className="preserve-lines">{zone.note}</p></>}{zone.next && <><h4>{t.predictability}</h4><p className="preserve-lines">{zone.next}</p></>}
      {zone.fields && zone.fields.length>0 && <dl className="draft-sensory">{zone.fields.map(field=><div key={field.label}><dt>{field.label}</dt><dd>{field.kind==='text' ? field.value : field.answer==='yes' ? p.answerYes : p.answerNo}</dd></div>)}</dl>}
      {zone.optional && <p>{p.maySkip}</p>}
    </li>)}</ol>
  </section>;
}
