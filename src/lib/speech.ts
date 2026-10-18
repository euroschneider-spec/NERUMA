import type { Locale } from './i18n';
import { getCopy } from './i18n';
import { getAccessCopy } from './accessibility-copy';
import { getPublishingCopy } from './publishing';
import type { Guide, Zone, SensoryProfile } from './demo';

// Short utterances avoid browser limits: Chrome stops a long utterance after about 15 seconds.
// Whole sentences are packed together so the voice pauses where the text does. No text is sent to an app API.
const chunkLength=220;

export function speechChunks(text:string):string[] {
  const chunks:string[]=[];
  for(const paragraph of text.split(/\n+/).map(value=>value.trim()).filter(Boolean)) {
    let current='';
    for(const sentence of paragraph.split(/(?<=[.!?…]["'”»)]*)\s+/).filter(Boolean)) {
      let rest=sentence;
      // A sentence too long for one utterance breaks after a comma, else after a word.
      while(rest.length>chunkLength) {
        const comma=rest.lastIndexOf(', ',chunkLength);
        const space=rest.lastIndexOf(' ',chunkLength);
        const end=comma>0?comma+1:space>0?space:chunkLength;
        if(current) {
          chunks.push(current);
          current='';
        }
        chunks.push(rest.slice(0,end).trim());
        rest=rest.slice(end).trim();
      }
      if(current && current.length+1+rest.length>chunkLength) {
        chunks.push(current);
        current='';
      }
      current=current?`${current} ${rest}`:rest;
    }
    if(current) chunks.push(current);
  }
  return chunks;
}

// Apple's joke voices (English only) and eSpeak sound robotic; they are chosen only when nothing else exists.
const noveltyVoices=/^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;

function voiceScore(voice:SpeechSynthesisVoice):number {
  let score=0;
  // On-device voices keep the text on the device, so they come first.
  if(voice.localService) score+=10;
  if(/premium/i.test(voice.name)) score+=4;
  else if(/enhanced|neural|natural|erweitert|îmbunătățit/i.test(voice.name)) score+=3;
  if(/compact/i.test(voice.name)) score-=1;
  if(/espeak/i.test(voice.name)) score-=3;
  if(noveltyVoices.test(voice.name)) score-=20;
  if(voice.default) score+=1;
  return score;
}

// The best voice the device has for the page language, never one for another language.
export function pickVoice(voices:SpeechSynthesisVoice[],locale:Locale):SpeechSynthesisVoice|undefined {
  const matching=voices.filter(voice=>voice.lang.replace('_','-').toLowerCase().split('-')[0]===locale);
  let best:SpeechSynthesisVoice|undefined;
  for(const voice of matching) {
    if(!best || voiceScore(voice)>voiceScore(best)) best=voice;
  }
  return best;
}

export function spokenZone(zone:Zone,locale:Locale,index:number,total:number):string {
  const t=getCopy(locale);const a=getAccessCopy(locale);
  return [`${t.step} ${index+1} ${t.of} ${total}. ${zone.title}`,zone.description,
    zone.photo?`${a.photoDescription}: ${zone.photo.alt}. ${zone.photo.rights}. ${zone.photo.photographedOn}`:zone.illustration?`${t.illustration}: ${zone.title}`:'',
    ...(['sound','light','crowding','smell','temperature','visual'] as (keyof SensoryProfile)[]).map(channel=>`${t[channel]}: ${t[zone.sensory[channel]]}`),
    zone.note?`${t.support}. ${zone.note}`:'',zone.next?`${t.predictability}. ${zone.next}`:'',
    ...(zone.fields || []).map(field=>`${field.label}: ${field.kind==='text'?field.value:field.answer==='yes'?getPublishingCopy(locale).answerYes:getPublishingCopy(locale).answerNo}`),
    zone.optional?getPublishingCopy(locale).maySkip:''].filter(Boolean).join('\n');
}

export function spokenGuide(guide:Guide,locale:Locale):string {
  const t=getCopy(locale);
  const zones=guide.zones.map((zone,index)=>spokenZone(zone,locale,index,guide.zones.length));
  // A published guide never says "demo", and reads the venue's own arrival text.
  if(!guide.isDemo) return [guide.title,t.source,guide.description || '',...zones,guide.arrival?`${t.arrival}. ${guide.arrival}`:''].filter(Boolean).join('\n');
  return [guide.title,t.demo,t.source,...zones,t.arrival,t.arrivalBody,t.general,t.generalBody,t.provenance,t.provenanceBody].join('\n');
}
