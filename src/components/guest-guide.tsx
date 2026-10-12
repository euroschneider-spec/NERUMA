'use client';
import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { getAccessCopy } from '@/lib/accessibility-copy';
import { getDemoGuide, type SensoryProfile } from '@/lib/demo';
import { spokenGuide, spokenZone } from '@/lib/speech';
import { ReadAloud } from './read-aloud';
import { GuideText } from './guide-text';
import { LevelSquares } from './level-squares';

const channels = ['sound','light','crowding','smell','temperature','visual'] as const;

/**
 * The guest guide as a visitor meets it after scanning a QR code: one mobile surface, no account,
 * no autoplay, content first. Reading choices (step-by-step or complete text, and read-aloud) live
 * in the guide's own options sheet rather than above the content, so a visitor arrives at the guide
 * itself. The sheet stays mounted while closed so speech continues after it is dismissed.
 */
export function GuestGuide({locale}:{locale:Locale}) {
  const t=getCopy(locale);const a=getAccessCopy(locale);
  const guide=useMemo(()=>getDemoGuide(locale),[locale]);
  const [index,setIndex]=useState(0);const [textView,setTextView]=useState(false);const [optionsOpen,setOptionsOpen]=useState(false);
  const titleRef=useRef<HTMLHeadingElement>(null);const optionsButton=useRef<HTMLButtonElement>(null);
  const zone=guide.zones[index];
  const info:[string,string][]=[[t.arrival,t.arrivalBody],[t.general,t.generalBody],[t.provenance,t.provenanceBody]];

  function move(next:number) {setTextView(false);setOptionsOpen(false);setIndex(next);requestAnimationFrame(()=>titleRef.current?.focus());}
  function display(show:boolean) {setTextView(show);setOptionsOpen(false);requestAnimationFrame(()=>titleRef.current?.focus());}
  function closeOptions() {setOptionsOpen(false);requestAnimationFrame(()=>optionsButton.current?.focus());}

  return <div className="gg">
    <div className="gg-header">
      <div style={{minWidth:0,flex:1}}>
        <span className="brand">NERUMA</span>
        <p className="venue">{guide.title}</p>
      </div>
      <button ref={optionsButton} type="button" className="icon-button" aria-label={a.guideOptions} aria-haspopup="dialog" aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(true)}><SlidersHorizontal size={20} aria-hidden="true"/></button>
    </div>

    <div className="gg-scroll" tabIndex={0} role="region" aria-label={guide.title}>
      <div className="gg-body">
        {textView ? <GuideText locale={locale} guide={guide} headingRef={titleRef}/>
          : zone ? <>
            <div className="gg-progress" aria-hidden="true">{guide.zones.map((item,i)=><div key={item.id} className={i<=index?'done':undefined}/>)}</div>
            <p className="small-label">{t.step} {index+1} {t.of} {guide.zones.length}</p>
            <h2 className="gg-title" ref={titleRef} tabIndex={-1}>{zone.title}</h2>
            <div className="gg-photo"><Image src={zone.illustration} alt={t.illustration+': '+zone.title} width={600} height={400} priority/></div>
            <p className="gg-desc">{zone.description}</p>
            <div>{channels.map(channel=>{
              const level=zone.sensory[channel as keyof SensoryProfile];
              return <div className="gg-chrow" key={channel}>
                <span className="lbl">{t[channel]}</span>
                <LevelSquares level={level}/>
                <span className="gg-lv"><b>{t[level]}</b></span>
              </div>;
            })}</div>
            <div className="gg-note"><span className="h">{t.support}</span><p>{zone.note}</p></div>
            <div className="gg-note"><span className="h">{t.predictability}</span><p>{zone.next}</p></div>
          </>
          : <div className="completion"><CheckCircle2 size={32} aria-hidden="true"/><h2 ref={titleRef} tabIndex={-1}>{t.completed}</h2><p>{t.completedBody}</p><button className="button" onClick={()=>move(0)}>{t.restart}<ArrowRight size={17} aria-hidden="true"/></button></div>}

        <div className="guide-info">{info.map(([heading,body])=>textView
          ? <section className="guide-info-text" key={heading}><h3>{heading}</h3><p>{body}</p></section>
          : <details key={heading}><summary>{heading}</summary><p>{body}</p></details>)}</div>
        <p className="notice sound-independent">{a.withoutSound}</p>
        <p className="source-label"><ShieldCheck size={14} aria-hidden="true"/>{t.source}</p>
      </div>
    </div>

    {zone && !textView ? <nav className="gg-footer guide-navigation" aria-label={t.guideIndex}>
      <button className="button button-small button-outline" disabled={index===0} onClick={()=>move(index-1)}><ArrowLeft size={16} aria-hidden="true"/>{t.previous}</button>
      <button className="button button-small" onClick={()=>move(index+1)}>{index===guide.zones.length-1?t.finish:t.next}<ArrowRight size={16} aria-hidden="true"/></button>
    </nav> : null}

    {/* Kept mounted while closed: unmounting would cancel speech the visitor started. */}
    <div className={optionsOpen?'gg-sheet-bg':'gg-sheet-bg is-closed'} onClick={event=>{if(event.target===event.currentTarget)closeOptions();}}>
      <div className="gg-sheet guide-display" role="dialog" aria-modal="false" aria-label={a.guideOptions}>
        <div className="row" style={{justifyContent:'space-between',gap:12}}>
          <h2 style={{margin:0,fontSize:'1.25rem'}}>{a.guideOptions}</h2>
          <button type="button" className="icon-button" aria-label={a.closeOptions} onClick={closeOptions}><X size={20} aria-hidden="true"/></button>
        </div>
        <div className="button-row" role="group" aria-label={a.display}>
          <button type="button" className="button button-small button-outline" aria-pressed={!textView} onClick={()=>display(false)}>{a.stepByStep}</button>
          <button type="button" className="button button-small button-outline" aria-pressed={textView} onClick={()=>display(true)}>{a.fullText}</button>
        </div>
        <nav aria-label={t.guideIndex}>
          <ol style={{listStyle:'none',padding:0,margin:0}}>{guide.zones.map((item,i)=><li key={item.id}>
            <button type="button" className="gg-step" aria-current={index===i&&!textView?'step':undefined} onClick={()=>move(i)}><span className="small-label">0{i+1}</span>{item.title}</button>
          </li>)}</ol>
        </nav>
        <ReadAloud key={textView?'full-text':zone?.id||'completion'} locale={locale} label={textView?a.listenGuide:a.listenStep}
          text={textView?spokenGuide(guide,locale):zone?t.demo+'\n'+t.source+'\n'+spokenZone(zone,locale,index,guide.zones.length):t.completed+'\n'+t.completedBody}/>
      </div>
    </div>
  </div>;
}
