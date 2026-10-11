'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { getCopy, locales, localeNames, type Locale } from '@/lib/i18n';
import { contentPages } from '@/lib/content';
import { PageDensity } from './page-density';
import { ThemeToggle } from './theme-toggle';
import { ToneSwitch } from './tone-switch';
export function Brand() { return <span className="brand"><span className="brand-mark" aria-hidden="true"><span/><span/><span/></span>NERUMA</span>; }
export function SiteHeader({locale}:{locale:Locale}) {
  const t=getCopy(locale); const path=usePathname(); const [open,setOpen]=useState(false); const languageMenu=useRef<HTMLDetailsElement>(null);
  const languageLabel=locale==='ro'?'Limbă':locale==='de'?'Sprache':'Language';
  const closeLanguageMenu=()=>languageMenu.current?.removeAttribute('open');
  // The first three jump to sections of the home page; from any other page they lead back to it.
  const links=[
    {href:`/${locale}#how-it-works`,label:t.nav[0]},
    {href:`/${locale}#who`,label:t.navWho},
    {href:`/${locale}#sources`,label:t.navSources},
    {href:`/${locale}/explore`,label:t.nav[3]},
  ];
  const guideRoute=`/${locale}/example-guide`;
  const organisationsRoute=`/${locale}/for-organisations`;
  const readable=contentPages.some(page=>path===`/${locale}/${page}`);
  return <>
    <a className="skip-link" href="#main-content">{t.skip}</a>
    {/* Language and appearance sit above the brand row: settings for the whole site, not navigation. */}
    <div className="topbar">
      <details
        className="language-switch"
        ref={languageMenu}
        onKeyDown={event=>{ if(event.key==='Escape') closeLanguageMenu(); }}
      >
        <summary aria-label={`${languageLabel}: ${localeNames[locale]}`}>
          {locale.toUpperCase()}
          <ChevronDown aria-hidden="true" />
        </summary>
        <nav aria-label={languageLabel}>
          {locales.map(lang=><Link key={lang} href={path.replace(/^\/(en|ro|de)(?=\/|$)/,`/${lang}`)} lang={lang} hrefLang={lang} aria-current={lang===locale?'page':undefined} onClick={closeLanguageMenu}>{localeNames[lang]}</Link>)}
        </nav>
      </details>
      {readable ? <PageDensity locale={locale}/> : null}
      <ToneSwitch locale={locale}/>
      <ThemeToggle locale={locale}/>
    </div>
    <header className="site-header"><div className="header-inner">
      <Link className="brand-link" href={`/${locale}`} aria-label="NERUMA"><Brand/></Link>
      <button className="menu-toggle icon-button" aria-label={open ? (locale==='ro'?'Închide meniul':locale==='de'?'Menü schließen':'Close menu') : (locale==='ro'?'Deschide meniul':locale==='de'?'Menü öffnen':'Open menu')} aria-expanded={open} aria-controls="site-navigation" onClick={()=>setOpen(!open)}>{open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button>
      <nav id="site-navigation" className={open?'navigation is-open':'navigation'} aria-label={locale==='ro'?'Navigare principală':locale==='de'?'Hauptnavigation':'Main navigation'}>
        {links.map(({href,label})=><Link key={href} href={href} aria-current={path===href?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}
        <Link className="nav-button" href={guideRoute} aria-current={path===guideRoute?'page':undefined} onClick={()=>setOpen(false)}>{t.guide}</Link>
        {/* The one door for organisations: registering and signing in sit behind this page, not in the menu. */}
        <Link className="nav-button nav-org" href={organisationsRoute} aria-current={path===organisationsRoute?'page':undefined} onClick={()=>setOpen(false)}>{t.nav[1]}</Link>
      </nav>
    </div></header>
  </>;
}
