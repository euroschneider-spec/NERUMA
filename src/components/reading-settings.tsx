'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SlidersHorizontal, X, GripHorizontal, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { getAccessCopy } from '@/lib/accessibility-copy';
import { ReadAloud } from './read-aloud';
import { applyPreferences, defaults, fromStored, followSystemTheme, savePreferences, storageKey, useThemeChoice, type Preferences } from '@/lib/reading-prefs';

/** Inside the organisation app the panel opens from a labelled button in the sidebar instead of the floating tab. */
type ReadingTrigger={register:(element:HTMLButtonElement|null)=>void;open:()=>void;isOpen:boolean};
const ReadingTriggerContext=createContext<ReadingTrigger|null>(null);
export const useReadingTrigger=()=>useContext(ReadingTriggerContext);
/* The provider hands out a callback ref (not a ref value); the lint rule can't tell the difference. */
/* eslint-disable react-hooks/refs */
export function ReadingSidebarButton({label,children}:{label:string;children:React.ReactNode}) {
  const reading=useReadingTrigger();
  if(!reading) return null;
  return <button ref={reading.register} type="button" className="button button-small button-outline app-reading" aria-haspopup="dialog" aria-controls="reading-panel" aria-expanded={reading.isOpen} onClick={reading.open} data-tip={label}>
    {children}
    <span className="app-label">{label}</span>
  </button>;
}
/* eslint-enable react-hooks/refs */
export const inWorkspace=(path:string)=>/^\/(en|ro|de)\/workspace(\/|$)/.test(path);

export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)));
// Dock to the bottom-left corner, clear of body copy that runs mid-page.
export const launcherTop=(viewportHeight:number,buttonHeight:number)=>clamp(viewportHeight-buttonHeight-24,8,viewportHeight-buttonHeight-8);
function placeLauncher(button:HTMLButtonElement) {
  const bounds=button.getBoundingClientRect();
  button.style.left='0px';
  button.style.top=`${launcherTop(window.innerHeight,bounds.height)}px`;
}

function movePanel(panel:HTMLDialogElement,left:number,top:number) {
  const bounds=panel.getBoundingClientRect();
  panel.style.left=`${clamp(left,16,window.innerWidth-bounds.width-16)}px`;
  panel.style.top=`${clamp(top,16,window.innerHeight-bounds.height-16)}px`;
}
function placePanel(panel:HTMLDialogElement,button:HTMLButtonElement) {
  const bounds=button.getBoundingClientRect();
  // Open beside the left-edge tab; retain these coordinates during page scroll.
  movePanel(panel,bounds.right+12,bounds.top);
}

export function ReadingSettingsProvider({locale,children}:{locale:Locale;children:React.ReactNode}) {
  const t=getCopy(locale);const a=getAccessCopy(locale);const path=usePathname();
  const [stored,setPrefs]=useState(defaults);const theme=useThemeChoice();const prefs:Preferences={...stored,theme};const [isOpen,setOpen]=useState(false);const [moveControls,setMoveControls]=useState(false);const [audioOpen,setAudioOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);
  const moved=useRef(false);const restoreFocus=useRef(true);const dragged=useRef(false);
  const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  useEffect(()=>{
    let frame:number|undefined;
    try {
      const saved=fromStored(JSON.parse(localStorage.getItem(storageKey)||'null'));
      applyPreferences(saved);frame=requestAnimationFrame(()=>setPrefs(saved));
    } catch { /* Defaults work when storage is unavailable. */ }
    return()=>{if(frame!==undefined) cancelAnimationFrame(frame);};
  },[]);
  useEffect(()=>followSystemTheme(),[]);
  useEffect(()=>{
    restoreFocus.current=false;dialog.current?.close();
    // Only the floating tab is docked to the corner; a button inside the sidebar stays where the page puts it.
    const position=()=>{if(trigger.current?.classList.contains('floating-reading'))placeLauncher(trigger.current);};
    const frame=requestAnimationFrame(position);window.addEventListener('resize',position);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',position);};
  },[path]);
  useEffect(()=>{
    if(!isOpen) return;
    const resize=()=>{
      if(!dialog.current || !trigger.current) return;
      if(moved.current){const bounds=dialog.current.getBoundingClientRect();movePanel(dialog.current,bounds.left,bounds.top);}
      else placePanel(dialog.current,trigger.current);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();restoreFocus.current=true;dialog.current?.close();}};
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof Node && !dialog.current?.contains(event.target) && !trigger.current?.contains(event.target)) {
        restoreFocus.current=false;dialog.current?.close();
      }
    };
    resize();window.addEventListener('resize',resize);window.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
    const observer=new ResizeObserver(resize);if(dialog.current)observer.observe(dialog.current);
    return()=>{observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);};
  },[isOpen]);
  function update(next:Preferences) {setPrefs(next);savePreferences(next);}
  function close() {restoreFocus.current=true;dialog.current?.close();}
  function open() {
    if(!dialog.current || !trigger.current) return;
    if(dialog.current.open){close();return;}
    moved.current=false;restoreFocus.current=true;
    // A nonmodal dialog leaves page scrolling and background controls available.
    dialog.current.show();placePanel(dialog.current,trigger.current);setOpen(true);
  }
  function closed() {setOpen(false);setMoveControls(false);setAudioOpen(false);drag.current=null;if(restoreFocus.current)trigger.current?.focus({preventScroll:true});}
  function nudge(x:number,y:number) {
    if(!dialog.current) return;const bounds=dialog.current.getBoundingClientRect();moved.current=true;movePanel(dialog.current,bounds.left+x,bounds.top+y);
  }
  function resetPosition() {moved.current=false;if(dialog.current && trigger.current)placePanel(dialog.current,trigger.current);}
  return <ReadingTriggerContext.Provider value={{register:element=>{trigger.current=element;},open,isOpen}}>{children}
    {!inWorkspace(path) && <button ref={trigger} type="button" className="reading-trigger floating-reading" aria-label={t.settings} title={t.settings} aria-haspopup="dialog" aria-controls="reading-panel" aria-expanded={isOpen} onClick={open}><SlidersHorizontal size={20} aria-hidden="true"/><span aria-hidden="true">{a.tools}</span></button>}
    <dialog ref={dialog} id="reading-panel" className="reading-dialog" aria-labelledby="reading-title" aria-describedby="reading-intro reading-popup-hint" onClose={closed} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
      <div className="reading-dialog-heading"><h2 id="reading-title">{t.settings}</h2>
        <button type="button" className="icon-button panel-drag-handle" aria-label={a.movePanel} title={a.movePanel} aria-expanded={moveControls} aria-controls="reading-move-controls" onClick={()=>{if(dragged.current){dragged.current=false;return;}setMoveControls(value=>!value);}}
          onPointerDown={event=>{if(event.button!==0 || !dialog.current)return;dragged.current=false;const bounds=dialog.current.getBoundingClientRect();drag.current={x:event.clientX,y:event.clientY,left:bounds.left,top:bounds.top};event.currentTarget.setPointerCapture(event.pointerId);}}
          onPointerMove={event=>{if(!drag.current || !dialog.current)return;const dx=event.clientX-drag.current.x;const dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>4){dragged.current=true;moved.current=true;movePanel(dialog.current,drag.current.left+dx,drag.current.top+dy);}}}
          onLostPointerCapture={()=>{drag.current=null;}}
          onKeyDown={event=>{const offsets:Record<string,[number,number]>={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(offsets[event.key]){event.preventDefault();nudge(...offsets[event.key]);}else if(event.key==='Home'){event.preventDefault();resetPosition();}}}><GripHorizontal size={20} aria-hidden="true"/></button>
        <button type="button" className="icon-button" aria-label={a.close} onClick={close}><X aria-hidden="true" size={20}/></button>
      </div>
      <div id="reading-move-controls" className="panel-move-controls" hidden={!moveControls} role="group" aria-label={a.movePanel}>
        <button type="button" className="icon-button" aria-label={a.moveLeft} onClick={()=>nudge(-24,0)}><ArrowLeft size={18} aria-hidden="true"/></button>
        <button type="button" className="icon-button" aria-label={a.moveRight} onClick={()=>nudge(24,0)}><ArrowRight size={18} aria-hidden="true"/></button>
        <button type="button" className="icon-button" aria-label={a.moveUp} onClick={()=>nudge(0,-24)}><ArrowUp size={18} aria-hidden="true"/></button>
        <button type="button" className="icon-button" aria-label={a.moveDown} onClick={()=>nudge(0,24)}><ArrowDown size={18} aria-hidden="true"/></button>
        <button type="button" className="icon-button" aria-label={a.resetPosition} onClick={resetPosition}><RotateCcw size={18} aria-hidden="true"/></button>
      </div>
      <p id="reading-popup-hint" className="small-note">{a.popupHint}</p>
      <p id="reading-intro">{a.readingIntro}</p>
      <div className="form-field"><label htmlFor="reading-size">{t.fontSize}</label><select id="reading-size" autoFocus value={prefs.size} onChange={e=>update({...prefs,size:e.target.value as Preferences['size']})}><option value="normal">{t.normal}</option><option value="large">{t.large}</option><option value="larger">{t.larger}</option></select></div>
      <div className="form-field"><label htmlFor="reading-theme">{t.theme}</label><select id="reading-theme" value={prefs.theme} onChange={e=>update({...prefs,theme:e.target.value as Preferences['theme']})}><option value="system">{t.systemTheme}</option><option value="light">{t.lightMode}</option><option value="dark">{t.darkMode}</option><option value="contrast">{t.contrast}</option></select></div>
      <div className="form-field"><label htmlFor="reading-width">{a.lineWidth}</label><select id="reading-width" value={prefs.width} onChange={e=>update({...prefs,width:e.target.value as Preferences['width']})}><option value="default">{a.lineDefault}</option><option value="narrow">{a.lineNarrow}</option></select></div>
      <div className="form-field"><label htmlFor="reading-font">{a.typeface}</label><select id="reading-font" value={prefs.font} onChange={e=>update({...prefs,font:e.target.value as Preferences['font']})}><option value="default">{a.typeDefault}</option><option value="hyperlegible">{a.typeHyperlegible}</option></select></div>
      <label className="checkbox-label"><input type="checkbox" checked={prefs.spacing} onChange={e=>update({...prefs,spacing:e.target.checked})}/>{t.spacing}</label>
      <p className="notice reading-sound-note">{a.withoutSound}</p>
      <button type="button" className="text-button" onClick={()=>update(defaults)}>{t.reset}</button>
      <details className="reading-audio-details" open={audioOpen} onToggle={event=>setAudioOpen(event.currentTarget.open)}><summary>{a.listenPage}</summary><ReadAloud locale={locale} label={a.listenPage} enabled={isOpen && audioOpen}/></details>
    </dialog>
  </ReadingTriggerContext.Provider>;
}
