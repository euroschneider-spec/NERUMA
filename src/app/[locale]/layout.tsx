import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, getCopy } from '@/lib/i18n';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AppChrome } from '@/components/app-chrome';
import { ReadingSettingsProvider } from '@/components/reading-settings';
import { hyperlegible } from '@/lib/fonts';
import '../globals.css';
export function generateStaticParams(){return locales.map(locale=>({locale}));}
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:[{media:'(prefers-color-scheme: dark)',color:'#131519'},{media:'(prefers-color-scheme: light)',color:'#f6f7f9'}]};
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const {locale}=await params;if(!isLocale(locale)) return {}; const t=getCopy(locale);return {title:{default:'NERUMA — '+t.footerLine,template:'%s | NERUMA'},description:t.heroDescription,robots:{index:false,follow:false},icons:{icon:'/favicon.svg'}};}

// The reading preferences live in localStorage, so the stored theme, text size and spacing
// are reapplied before first paint. Without this, a visitor who chose light or high contrast
// would see one dark frame, because dark is the stylesheet default. A visitor who has not chosen follows the
// device, resolved here too, so a light device does not flash dark first.
const restorePreferences=`try{var p=JSON.parse(localStorage.getItem('vianorae:reading:v1')||'null')||{};var r=document.documentElement;var pick=function(v,a,d){return a.indexOf(v)>-1?v:d};var c=p.themeV===2?pick(p.theme,['system','light','dark','contrast'],'system'):'system';r.dataset.themeChoice=c;var m=function(q){return !!(window.matchMedia&&window.matchMedia(q).matches)};r.dataset.theme=c==='system'?(m('(prefers-contrast: more)')?'contrast':m('(prefers-color-scheme: light)')?'light':'dark'):c;r.dataset.textSize=pick(p.size,['normal','large','larger'],'normal');r.dataset.spacing=String(p.spacing===true);r.dataset.width=pick(p.width,['default','narrow'],'default');r.dataset.font=pick(p.font,['default','hyperlegible'],'default');r.dataset.density=pick(p.density,['full','summary'],'full');r.dataset.tone=pick(p.tone,['cool','warm'],'cool');}catch(e){}`;

export default async function LocaleLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();
  return <html lang={locale} className={hyperlegible.variable} data-theme="dark" data-theme-choice="system" data-density="full" data-tone="cool" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{__html:restorePreferences}}/></head>
    <body><ReadingSettingsProvider locale={locale}><AppChrome header={<SiteHeader locale={locale}/>} footer={<SiteFooter locale={locale}/>}>{children}</AppChrome></ReadingSettingsProvider></body>
  </html>;
}
