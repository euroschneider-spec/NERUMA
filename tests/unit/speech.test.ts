import { describe, expect, it } from 'vitest';
import { pickVoice, speechChunks } from '@/lib/speech';

function voice(name:string,lang:string,localService=true,isDefault=false):SpeechSynthesisVoice {
  return {name,lang,localService,default:isDefault,voiceURI:name};
}

describe('pickVoice',()=>{
  it('never picks a voice for another language',()=>{
    expect(pickVoice([voice('Anna (Premium)','de-DE')],'ro')).toBeUndefined();
  });
  it('accepts underscores and any region',()=>{
    expect(pickVoice([voice('Ioana','ro_RO')],'ro')?.name).toBe('Ioana');
  });
  it('prefers an enhanced or premium voice over the first one listed',()=>{
    const voices=[voice('Anna','de-DE'),voice('Anna (Enhanced)','de-DE'),voice('Petra (Premium)','de-DE')];
    expect(pickVoice(voices,'de')?.name).toBe('Petra (Premium)');
    expect(pickVoice(voices.slice(0,2),'de')?.name).toBe('Anna (Enhanced)');
  });
  it('keeps the text on the device: an on-device voice beats an online natural one',()=>{
    const voices=[voice('Microsoft Katja Online (Natural) - German (Germany)','de-DE',false),voice('Anna','de-DE')];
    expect(pickVoice(voices,'de')?.name).toBe('Anna');
  });
  it('uses an online voice when the device has nothing else',()=>{
    expect(pickVoice([voice('Google română','ro-RO',false)],'ro')?.name).toBe('Google română');
  });
  it('avoids joke voices and eSpeak',()=>{
    expect(pickVoice([voice('Zarvox','en-US'),voice('Bad News','en-US'),voice('Samantha','en-US')],'en')?.name).toBe('Samantha');
    expect(pickVoice([voice('eSpeak German','de'),voice('Anna','de-DE')],'de')?.name).toBe('Anna');
  });
  it('among equal voices, keeps the device default, else the first listed',()=>{
    expect(pickVoice([voice('Daniel','en-GB'),voice('Samantha','en-US',true,true)],'en')?.name).toBe('Samantha');
    expect(pickVoice([voice('Daniel','en-GB'),voice('Samantha','en-US')],'en')?.name).toBe('Daniel');
  });
});

describe('speechChunks',()=>{
  it('keeps short sentences of one paragraph together and paragraphs apart',()=>{
    expect(speechChunks('Step 1 of 5. Entrance.\nThe hall is quiet.')).toEqual(['Step 1 of 5. Entrance.','The hall is quiet.']);
  });
  it('breaks between sentences, keeps every word, and never splits a number',()=>{
    const sentence='The gallery is 2.5 metres wide and lit softly from above, with benches along the wall.';
    const text=Array(6).fill(sentence).join(' ');
    const chunks=speechChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk=>chunk.length<=220)).toBe(true);
    expect(chunks.every(chunk=>chunk.endsWith('.'))).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });
  it('splits a very long sentence after a comma, else after a word',()=>{
    const long=`${'word '.repeat(30)}then a pause, ${'and more words '.repeat(15)}to finish`;
    const chunks=speechChunks(long);
    expect(chunks.every(chunk=>chunk.length<=220)).toBe(true);
    expect(chunks[0].endsWith(',')).toBe(true);
    expect(chunks.join(' ')).toBe(long.replace(/\s+/g,' ').trim());
  });
});
