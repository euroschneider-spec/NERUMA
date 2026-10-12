'use client';
import { Sun, Moon } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { setPreference, useTheme } from '@/lib/reading-prefs';

/**
 * Shows the theme it would switch *to*, so the label is an action rather than a status.
 * High contrast is a deliberate choice made in the reading panel; from there this offers
 * dark, and never silently replaces it with plain light.
 * In the top bar it is an icon on its own: the action is its accessible name and its tooltip.
 */
export function ThemeToggle({locale,iconOnly=false}:{locale:Locale;iconOnly?:boolean}) {
  const t=getCopy(locale);const theme=useTheme();const dark=theme==='dark';
  const action=dark ? t.switchToLight : t.switchToDark;
  const label=dark ? t.lightMode : t.darkMode;
  return <button type="button" className={iconOnly ? 'button button-small button-outline theme-toggle is-icon' : 'button button-small button-outline theme-toggle'} aria-pressed={dark} data-tip={label} title={iconOnly ? action : undefined} onClick={()=>setPreference('theme',dark?'light':'dark')}>
    {dark ? <Sun size={16} aria-hidden="true"/> : <Moon size={16} aria-hidden="true"/>}
    <span className={iconOnly ? 'sr-only' : 'app-label'}>{iconOnly ? action : label}</span>
  </button>;
}
