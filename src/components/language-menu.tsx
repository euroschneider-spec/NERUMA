'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/lib/i18n';

/** The language dropdown, shared by the public header and the organisation sidebar. */
export function LanguageMenu({ locale }: { locale: Locale }) {
  const path = usePathname();
  const languageMenu = useRef<HTMLDetailsElement>(null);
  const languageLabel = locale === 'ro' ? 'Limbă' : locale === 'de' ? 'Sprache' : 'Language';
  const closeLanguageMenu = () => languageMenu.current?.removeAttribute('open');
  return (
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
  );
}
