import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getCopy,isLocale } from '@/lib/i18n';
import { getContent,contentPages,references,splitLead,slug } from '@/lib/content';
import { ResponsibilityNotice } from '@/components/responsibility-notice';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { DensityNote } from '@/components/page-density';
/** Pages where seeing a real guide backs up what the page says; privacy and terms have no use for it. */
const exampleGuidePages:string[]=['methodology','accessibility'];
/** Pages an organisation meets first; the internal methodology label is not for them. */
const visitorFacing:string[]=['for-organisations'];
export function generateStaticParams(){return contentPages.map(page=>({page}));}
export async function generateMetadata({params}:{params:Promise<{locale:string;page:string}>}){const {locale,page}=await params;return {title:isLocale(locale)?getContent(locale,page)?.title:'NERUMA'};}
export default async function ContentPage({params}:{params:Promise<{locale:string;page:string}>}){const {locale,page}=await params;if(!isLocale(locale))notFound();const content=getContent(locale,page);if(!content)notFound();const t=getCopy(locale);return <main id="main-content" className="container"><div className="page-heading">{visitorFacing.includes(page)?null:<p className="eyebrow">NERUMA · {t.methodVersion}</p>}<h1>{content.title}</h1><p className="lead">{content.intro}</p>{page==='for-organisations'?<div className="button-row"><Link className="button" href={`/${locale}/register`}>{getOrganisationCopy(locale).register}</Link><Link className="button button-outline" href={`/${locale}/login`}>{getOrganisationCopy(locale).login}</Link></div>:null}</div><article className="content-body prose"><DensityNote locale={locale}/>{content.sections.map(section=>{const [lead,rest]=splitLead(section.body);const id=slug(section.heading);return <section key={section.heading} aria-labelledby={id}><h2 id={id}>{section.heading}</h2><p>{lead}</p>{rest?<p className="section-rest">{rest}</p>:null}{section.items?<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>:null}</section>;})}{page==='methodology'?<ul>{references.map(([name,url])=><li key={url}><a href={url}>{name}</a></li>)}</ul>:null}{page==='terms'?<ResponsibilityNotice locale={locale}/>:null}{page==='for-organisations'?<><div className="button-row"><Link className="quiet-link" href={`/${locale}/register#responsibility`}>{getOrganisationCopy(locale).responsibilityLink}<ArrowRight size={17} aria-hidden="true"/></Link><Link className="quiet-link" href={`/${locale}/demo`}>{t.openWorkspace}<ArrowRight size={17} aria-hidden="true"/></Link></div></>:exampleGuidePages.includes(page)?<div className="callout"><Link className="quiet-link" href={`/${locale}/places/willow-museum/guide`}>{t.guide}<ArrowRight size={17} aria-hidden="true"/></Link></div>:null}</article></main>;}
