'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Volume2, Pause, Play, Square } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { getAccessCopy } from '@/lib/accessibility-copy';
import { pickVoice, speechChunks } from '@/lib/speech';

const stopEvent='vianorae:stop-reading';
type State='idle'|'playing'|'paused'|'finished'|'error'|'missingVoice';

function pageText():string {
  const main=document.querySelector('main')?.cloneNode(true) as HTMLElement|undefined;
  if(!main) return '';
  main.querySelectorAll('button,nav,input,select,textarea,script,style,[hidden],[aria-hidden="true"],[role="status"],.read-aloud').forEach(node=>node.remove());
  main.querySelectorAll('img').forEach(img=>img.replaceWith(document.createTextNode(img.alt)));
  // Preserve boundaries between headings, paragraphs and list entries.
  main.querySelectorAll('p,h1,h2,h3,h4,li,dt,dd').forEach(node=>node.append(document.createTextNode('\n')));
  return main.textContent || '';
}

export function ReadAloud({locale,text,label,enabled=true}:{locale:Locale;text?:string;label:string;enabled?:boolean}) {
  const a=getAccessCopy(locale);const id=useId();
  const [supported,setSupported]=useState<boolean|null>(null);const [state,setState]=useState<State>('idle');const [rate,setRate]=useState('1');
  const generation=useRef(0);const active=useRef(false);const currentUtterance=useRef<SpeechSynthesisUtterance|null>(null);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{const available=typeof window.speechSynthesis?.speak==='function' && typeof window.SpeechSynthesisUtterance==='function';setSupported(available);if(available) window.speechSynthesis.getVoices();});
    const cancel=()=>{generation.current++;if(active.current){window.speechSynthesis?.cancel();active.current=false;return true;}return false;};
    const stop=()=>{if(cancel())setState('idle');};
    window.addEventListener(stopEvent,stop);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener(stopEvent,stop);cancel();};
  },[]);
  // A new step, language or saved draft always stops the previous narration.
  useEffect(()=>{
    if(!active.current) return;
    generation.current++;window.speechSynthesis?.cancel();active.current=false;
    const frame=requestAnimationFrame(()=>setState('idle'));return()=>cancelAnimationFrame(frame);
  },[text,locale,enabled]);

  function start() {
    if(!supported || !enabled) return;
    window.dispatchEvent(new Event(stopEvent));
    const synth=window.speechSynthesis;
    const voice=pickVoice(synth.getVoices(),locale);
    if(!voice){setState('missingVoice');return;}
    const chunks=speechChunks(text??pageText());if(!chunks.length){setState('error');return;}
    // cancel() does not clear the browser's paused flag. A fresh user request must.
    synth.resume();
    const version=++generation.current;active.current=true;setState('playing');
    function speak(index:number) {
      if(version!==generation.current) return;
      if(index===chunks.length){active.current=false;setState('finished');return;}
      const utterance=new SpeechSynthesisUtterance(chunks[index]);utterance.lang=voice!.lang;utterance.voice=voice!;utterance.rate=Number(rate);
      utterance.onend=()=>speak(index+1);
      utterance.onerror=()=>{if(version===generation.current){generation.current++;active.current=false;synth.cancel();setState('error');}};
      currentUtterance.current=utterance;synth.speak(utterance);
    }
    speak(0);
  }
  function pause() {
    if(state==='paused'){window.speechSynthesis.resume();setState('playing');}
    else{window.speechSynthesis.pause();setState('paused');}
  }
  function stop(){generation.current++;if(active.current) window.speechSynthesis.cancel();active.current=false;setState('idle');}
  const busy=state==='playing'||state==='paused';
  const status=supported===false?a.audioUnsupported:state==='missingVoice'?a.audioNoVoice:state==='error'?a.audioError:state==='playing'?a.audioPlaying:state==='paused'?a.audioPaused:state==='finished'?a.audioFinished:a.audioReady;
  return <section className="read-aloud" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{label}</h3><p className="small-note">{a.audioIntro}</p>
    <p className="small-note">{a.audioVoiceTip}</p>
    <div className="button-row"><button type="button" className="button button-outline" onClick={start} disabled={supported!==true || !enabled}><Volume2 size={18} aria-hidden="true"/>{busy?a.audioRestart:a.audioStart}</button>
      <button type="button" className="button button-outline" onClick={pause} disabled={!busy}>{state==='paused'?<Play size={18} aria-hidden="true"/>:<Pause size={18} aria-hidden="true"/>}{state==='paused'?a.audioResume:a.audioPause}</button>
      <button type="button" className="button button-outline" onClick={stop} disabled={!busy}><Square size={18} aria-hidden="true"/>{a.audioStop}</button>
    </div>
    <div className="form-field audio-rate"><label htmlFor={`${id}-rate`}>{a.audioSpeed}</label><select id={`${id}-rate`} value={rate} disabled={busy} onChange={event=>setRate(event.target.value)}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></div>
    <p role="status" className="audio-status">{status}</p>
  </section>;
}
