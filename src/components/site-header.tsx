'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, SlidersHorizontal, X } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { ThemeToggle } from './theme-toggle';
import { LanguageMenu } from './language-menu';
import { ReadingButton } from './reading-settings';
export function Brand() { return <span className="brand"><span className="brand-mark" aria-hidden="true"><span/><span/><span/></span>NERUMA</span>; }
export function SiteHeader({locale}:{locale:Locale}) {
  const t=getCopy(locale); const path=usePathname(); const [open,setOpen]=useState(false);
  // The first three jump to sections of the home page; from any other page they lead back to it.
  const links=[
    {href:`/${locale}#how-it-works`,label:t.nav[0]},
    {href:`/${locale}#who`,label:t.navWho},
    {href:`/${locale}#sources`,label:t.navSources},
    {href:`/${locale}/explore`,label:t.nav[3]},
  ];
  const guideRoute=`/${locale}/places/willow-museum/guide`;
  const organisationsRoute=`/${locale}/for-organisations`;
  return <>
    <a className="skip-link" href="#main-content">{t.skip}</a>
    {/* Two settings above the brand row: language, and light or dark. Everything else is in the reading panel. */}
    <div className="topbar">
      <LanguageMenu locale={locale}/>
      <ThemeToggle locale={locale} iconOnly/>
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
      {/* In the sticky row, so the reading panel is one tap away however far the page is scrolled. */}
      <ReadingButton label={t.settings} className="header-reading" placement="below"><SlidersHorizontal size={16} aria-hidden="true"/></ReadingButton>
    </div></header>
  </>;
}
