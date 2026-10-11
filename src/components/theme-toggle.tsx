'use client';
import { Sun, Moon } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { setPreference, useTheme } from '@/lib/reading-prefs';

/**
 * Shows the theme it would switch *to*, so the label is an action rather than a status.
 * High contrast is a deliberate choice made in the reading panel; from there this offers
 * dark, and never silently replaces it with plain light.
 */
export function ThemeToggle({locale}:{locale:Locale}) {
  const t=getCopy(locale);const theme=useTheme();const dark=theme==='dark';
  return <button type="button" className="button button-small button-outline theme-toggle" aria-pressed={dark} data-tip={dark ? t.lightMode : t.darkMode} onClick={()=>setPreference('theme',dark?'light':'dark')}>
    {dark ? <Sun size={16} aria-hidden="true"/> : <Moon size={16} aria-hidden="true"/>}
    <span className="app-label">{dark ? t.lightMode : t.darkMode}</span>
  </button>;
}
