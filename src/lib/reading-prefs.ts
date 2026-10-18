'use client';
import { useSyncExternalStore } from 'react';

export type Theme='light'|'dark'|'contrast';
/** What the reader chose: a theme, or 'system' to follow the device until they choose one. */
export type ThemeChoice='system'|Theme;
export type Size='normal'|'large'|'larger';
export type Width='default'|'narrow';
export type Font='default'|'hyperlegible';
export type Density='full'|'summary';
export type Tone='cool'|'warm';
export type Preferences={size:Size;theme:ThemeChoice;spacing:boolean;width:Width;font:Font;density:Density;tone:Tone};

// Until a reader chooses, the theme follows their device; the stored choice is reapplied before paint in the locale layout.
export const defaults:Preferences={size:'normal',theme:'system',spacing:false,width:'default',font:'default',density:'full',tone:'cool'};
export const storageKey='vianorae:reading:v1';
// Versions before this one saved the theme with every setting, so a stored theme can't be told from a choice.
// Only a theme saved with this marker counts as chosen; older ones follow the device again, once. Safe while no
// real visitors exist; bump it only for a reason like that.
export const themeVersion=2;

const sizes:Size[]=['normal','large','larger'];
const themes:ThemeChoice[]=['system','light','dark','contrast'];
const widths:Width[]=['default','narrow'];
const fonts:Font[]=['default','hyperlegible'];
const densities:Density[]=['full','summary'];
const tones:Tone[]=['cool','warm'];

// Each field is validated on its own so preferences stored before a field existed still load.
// Rejecting the whole object would silently reset a reader's theme when we add a setting.
function one<T extends string>(value:unknown,allowed:T[],fallback:T):T {
  return allowed.includes(value as T) ? value as T : fallback;
}

export function fromStored(raw:unknown):Preferences {
  const v=(raw||{}) as Partial<Record<keyof Preferences|'themeV',unknown>>;
  return {
    size:one(v.size,sizes,defaults.size),
    theme:v.themeV===themeVersion ? one(v.theme,themes,defaults.theme) : defaults.theme,
    spacing:typeof v.spacing==='boolean'?v.spacing:defaults.spacing,
    width:one(v.width,widths,defaults.width),
    font:one(v.font,fonts,defaults.font),
    density:one(v.density,densities,defaults.density),
    tone:one(v.tone,tones,defaults.tone),
  };
}

function readPreferences():Preferences {
  try { return fromStored(JSON.parse(localStorage.getItem(storageKey)||'null')); }
  catch { return defaults; }
}

/**
 * The theme on screen for a choice. 'system' follows the device: high contrast when it asks for more contrast,
 * otherwise light or dark, falling back to dark, the design default, when it can't be asked.
 */
export function resolveTheme(choice:ThemeChoice,deviceIsLight:boolean,deviceWantsContrast:boolean):Theme {
  if(choice!=='system') return choice;
  if(deviceWantsContrast) return 'contrast';
  return deviceIsLight ? 'light' : 'dark';
}
const lightQuery='(prefers-color-scheme: light)';
const contrastQuery='(prefers-contrast: more)';
const deviceMatches=(query:string)=>typeof window.matchMedia==='function' && window.matchMedia(query).matches;
const deviceTheme=(choice:ThemeChoice)=>resolveTheme(choice,deviceMatches(lightQuery),deviceMatches(contrastQuery));

export function applyPreferences(p:Preferences) {
  const root=document.documentElement;
  root.dataset.themeChoice=p.theme;root.dataset.theme=deviceTheme(p.theme);root.dataset.textSize=p.size;root.dataset.spacing=String(p.spacing);
  root.dataset.width=p.width;root.dataset.font=p.font;root.dataset.density=p.density;root.dataset.tone=p.tone;
}

export function savePreferences(p:Preferences) {
  applyPreferences(p);
  try { localStorage.setItem(storageKey,JSON.stringify({...p,themeV:themeVersion})); } catch { /* Settings still work for this visit. */ }
}

/** Change one setting, leaving every other choice the reader made untouched. */
export function setPreference<K extends keyof Preferences>(key:K,value:Preferences[K]) {
  savePreferences({...readPreferences(),[key]:value});
}

// The data attributes on <html> are the single source of truth, so controls in the header, the
// reading panel and the page body never disagree about the current setting.
function watch(attribute:string) {
  return (notify:()=>void)=>{
    const observer=new MutationObserver(notify);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:[attribute]});
    return ()=>observer.disconnect();
  };
}

const themeStore=watch('data-theme');
const themeChoiceStore=watch('data-theme-choice');
const densityStore=watch('data-density');
const toneStore=watch('data-tone');

export function useTheme():Theme {
  return useSyncExternalStore<Theme>(themeStore,
    ()=>one(document.documentElement.dataset.theme,['light','dark','contrast'],'dark'),
    ()=>'dark');
}

/** The reader's choice (including 'system'), as opposed to the theme on screen. */
export function useThemeChoice():ThemeChoice {
  return useSyncExternalStore<ThemeChoice>(themeChoiceStore,
    ()=>one(document.documentElement.dataset.themeChoice,themes,defaults.theme),
    ()=>defaults.theme);
}

/** While the choice is 'system', follow the device when it switches light/dark or asks for more contrast. Returns the cleanup. */
export function followSystemTheme():()=>void {
  if(typeof window.matchMedia!=='function') return ()=>{};
  const queries=[window.matchMedia(lightQuery),window.matchMedia(contrastQuery)];
  const update=()=>{
    const root=document.documentElement;
    if(root.dataset.themeChoice==='system') root.dataset.theme=deviceTheme('system');
  };
  for(const query of queries) query.addEventListener('change',update);
  return ()=>{
    for(const query of queries) query.removeEventListener('change',update);
  };
}

export function useDensity():Density {
  return useSyncExternalStore<Density>(densityStore,
    ()=>one(document.documentElement.dataset.density,densities,defaults.density),
    ()=>defaults.density);
}

export function useTone():Tone {
  return useSyncExternalStore<Tone>(toneStore,
    ()=>one(document.documentElement.dataset.tone,tones,defaults.tone),
    ()=>defaults.tone);
}
