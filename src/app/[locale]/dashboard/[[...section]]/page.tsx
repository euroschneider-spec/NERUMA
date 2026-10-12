import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getCopy,isLocale,locales,localeNames } from '@/lib/i18n';
import { roleDescriptions } from '@/lib/roles';
import { DemoBuilder,ResetDraft } from '@/components/demo-builder';
import { GuideViewer } from '@/components/guide-viewer';
const sections=['overview','locations','builder','preview','team','settings','share'] as const;
export function generateStaticParams(){return [{section:[]},...sections.filter(s=>s!=='overview').map(s=>({section:[s]}))];}
export const metadata={robots:{index:false,follow:false},title:'Demo workspace'};
export default async function DashboardPage({params}:{params:Promise<{locale:string;section?:string[]}>}){
 const {locale,section}=await params;if(!isLocale(locale)||(section&&section.length>1))notFound();const selected=section?.[0]||'overview';if(!sections.includes(selected as typeof sections[number]))notFound();const t=getCopy(locale);
 const nav=[['overview',t.dashboard],['locations',t.locations],['builder',t.builder],['preview',t.previewGuide],['share',t.share],['team',t.team],['settings',t.settingsNav]];
 const heading=selected==='overview'?t.overviewTitle:nav.find(([key])=>key===selected)?.[1]||t.dashboard;
 return <main id="main-content" className="container"><div className="page-heading"><p className="eyebrow">{t.workspace}</p><h1>{heading}</h1>{selected==='overview'?<p className="lead">{t.overviewBody}</p>:null}</div><div className="notice">{t.demoNotice}</div><div className="workspace-layout"><nav className="workspace-nav" aria-label={t.workspace}>{nav.map(([key,label])=><Link key={key} href={`/${locale}/dashboard${key==='overview'?'':'/'+key}`} aria-current={selected===key?'page':undefined}>{label}</Link>)}</nav><div>
 {selected==='overview'?<><div className="stats">{[[1,t.placeCount],[5,t.zoneCount],[3,t.languageCount]].map(([n,label])=><div className="stat" key={label}><strong>{n}</strong><span>{label}</span></div>)}</div><section className="workspace-card"><span className="badge">{t.draft}</span><h2>{t.currentGuide}</h2><p>{t.museum} · Museum · {t.fictional}</p><p className="source-label">{t.source}</p><div className="button-row"><Link className="button" href={`/${locale}/dashboard/builder`}>{t.editGuide}<ArrowRight size={17} aria-hidden="true"/></Link><Link className="quiet-link" href={`/${locale}/places/willow-museum/guide`}>{t.publicExample}<ArrowUpRight size={17} aria-hidden="true"/></Link></div></section><div className="notice">{t.publishUnavailable}</div></>:null}
 {selected==='locations'?<article className="workspace-card"><Image src="/illustrations/entrance.svg" width={600} height={400} alt={t.illustration}/><h2>{t.museum}</h2><p>{t.museumLocation}</p><Link className="button" href={`/${locale}/dashboard/builder`}>{t.editGuide}<ArrowRight size={17} aria-hidden="true"/></Link></article>:null}
 {selected==='builder'?<DemoBuilder locale={locale}/>:null}
 {selected==='preview'?<GuideViewer locale={locale} preview/>:null}
 {selected==='team'?<section className="workspace-card"><p>{t.rolesIntro}</p><ul className="role-list">{Object.entries(roleDescriptions[locale]).map(([role,description])=><li key={role}><strong>{role.charAt(0).toUpperCase()+role.slice(1)}</strong><span>{description}</span></li>)}</ul></section>:null}
 {selected==='settings'?<section className="workspace-card"><h2>{t.languageCount}</h2><p>{locales.map(lang=>localeNames[lang]).join(' · ')}</p><p>{t.demoNotice}</p><ResetDraft locale={locale}/></section>:null}
 {selected==='share'?<section className="workspace-card"><h2>{t.share}</h2><p>{t.qrNote}</p><div className="qr-box"><Image unoptimized src={`/api/qr/willow-museum?locale=${locale}`} alt={`QR: ${t.museum}`} width={180} height={180}/><div><a className="button" href={`/api/qr/willow-museum?locale=${locale}&download=1`} download="vianorae-willow-museum.svg">{t.downloadQr}</a><p><Link className="subtle-link" href={`/q/willow-museum?locale=${locale}`}>{t.openGuide}<ArrowUpRight size={16} aria-hidden="true"/></Link></p></div></div></section>:null}
 </div></div></main>;
}
