import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type SpeechFixture={texts:string[];lang:string;rate:number;paused:number;resumed:number;cancelled:number;pausedState:boolean;finish:()=>void;fail:()=>void;voices:SpeechSynthesisVoice[]};
async function mockSpeech(page:Page,locale='en',unsupported=false) {
  await page.addInitScript(({locale,unsupported})=>{
    if(unsupported){Object.defineProperty(window,'speechSynthesis',{value:undefined});return;}
    let current:SpeechSynthesisUtterance|null=null;
    const state:SpeechFixture={texts:[],lang:'',rate:1,paused:0,resumed:0,cancelled:0,pausedState:false,
      voices:[{lang:`${locale}-TEST`,name:'Test voice',default:true,localService:true,voiceURI:'test'}],
      finish:()=>{let count=0;while(current && count++<200){const next=current;current=null;next.onend?.({} as SpeechSynthesisEvent);}},
      fail:()=>{const next=current;current=null;next?.onerror?.({error:'synthesis-failed'} as SpeechSynthesisErrorEvent);}};
    Object.defineProperty(window,'__speech',{value:state});
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>state.voices,
      speak:(utterance:SpeechSynthesisUtterance)=>{current=utterance;state.texts.push(utterance.text);state.lang=utterance.lang;state.rate=utterance.rate;},
      cancel:()=>{state.cancelled++;const old=current;current=null;old?.onerror?.({error:'canceled'} as SpeechSynthesisErrorEvent);},
      pause:()=>{state.paused++;state.pausedState=true;},resume:()=>{state.resumed++;state.pausedState=false;}}});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string;lang='';rate=1;voice=null;onend=null;onerror=null;constructor(text:string){this.text=text;}}});
  },{locale,unsupported});
}
const fixture=(page:Page)=>page.evaluate(()=>{const s=(window as unknown as {__speech:SpeechFixture}).__speech;return {texts:s.texts,lang:s.lang,rate:s.rate,paused:s.paused,resumed:s.resumed,cancelled:s.cancelled,pausedState:s.pausedState};});
const copy={
  en:{start:'Read aloud',pause:'Pause',resume:'Resume',stop:'Stop',speed:'Reading speed',next:'Next step',full:'Complete guide in text',playing:'Reading aloud.',paused:'Reading paused.',finished:'Reading finished.',options:'Guide options',closeOptions:'Close guide options'},
  ro:{start:'Citește cu voce',pause:'Pauză',resume:'Continuă',stop:'Oprește',speed:'Viteza lecturii',next:'Pasul următor',full:'Ghid complet în text',playing:'Lectură în curs.',paused:'Lectură în pauză.',finished:'Lectură încheiată.',options:'Opțiuni pentru ghid',closeOptions:'Închide opțiunile ghidului'},
  de:{start:'Vorlesen',pause:'Pause',resume:'Fortsetzen',stop:'Stoppen',speed:'Lesegeschwindigkeit',next:'Nächster Schritt',full:'Vollständiger Guide als Text',playing:'Wird vorgelesen.',paused:'Vorlesen pausiert.',finished:'Vorlesen beendet.',options:'Guide-Optionen',closeOptions:'Guide-Optionen schließen'},
};
for(const locale of ['en','ro','de'] as const) {
  test(`${locale}: optional guide speech supports pause, resume, stop, speed and all guide content`,async({page})=>{
    await mockSpeech(page,locale);await page.goto(`/${locale}/example-guide`);const t=copy[locale];
    const openOptions=()=>page.getByRole('button',{name:t.options,exact:true}).click();
    const closeOptions=()=>page.getByRole('button',{name:t.closeOptions,exact:true}).click();
    await openOptions();const audio=page.locator('.gg-sheet .read-aloud');
    expect((await fixture(page)).texts).toEqual([]);
    await audio.getByLabel(t.speed,{exact:true}).selectOption('0.75');await audio.getByRole('button',{name:t.start,exact:true}).click();
    await expect(audio.getByRole('status')).toHaveText(t.playing);expect((await fixture(page)).lang).toBe(`${locale}-TEST`);expect((await fixture(page)).rate).toBe(.75);
    await audio.getByRole('button',{name:t.pause,exact:true}).click();await expect(audio.getByRole('status')).toHaveText(t.paused);
    await audio.getByRole('button',{name:t.resume,exact:true}).click();expect((await fixture(page)).resumed).toBe(2);
    await closeOptions();await page.locator('.guide-navigation').getByRole('button').last().click();await openOptions();
    await expect(audio.getByRole('button',{name:t.stop,exact:true})).toBeDisabled();
    await audio.getByRole('button',{name:t.start,exact:true}).click();await audio.getByRole('button',{name:t.pause,exact:true}).click();await audio.getByRole('button',{name:t.stop,exact:true}).click();
    await audio.getByRole('button',{name:t.start,exact:true}).click();expect((await fixture(page)).pausedState).toBe(false);await audio.getByRole('button',{name:t.stop,exact:true}).click();
    await page.getByRole('button',{name:t.full,exact:true}).click();await openOptions();await audio.getByRole('button',{name:t.start,exact:true}).click();
    await page.evaluate(()=>(window as unknown as {__speech:SpeechFixture}).__speech.finish());await expect(audio.getByRole('status')).toHaveText(t.finished);
    const spoken=(await fixture(page)).texts.join('\n');
    for(const content of await page.locator('.guide-text-steps h3,.guide-text-steps>li>p.preserve-lines,.guide-info-text p,.guide-text-steps dd').allTextContents())expect(spoken).toContain(content);
    expect((await fixture(page)).texts.every(text=>text.length<=500)).toBe(true);
    await audio.getByRole('button',{name:t.start,exact:true}).click();await page.evaluate(()=>(window as unknown as {__speech:SpeechFixture}).__speech.fail());
    await expect(audio.getByRole('button',{name:t.stop,exact:true})).toBeDisabled();await expect(audio.getByRole('status')).not.toHaveText(t.finished);
  });
}
test('one control docks to the left screen edge while the page scrolls and reflows at 320px',async({page})=>{
  await mockSpeech(page,'ro');await page.setViewportSize({width:1440,height:1000});
  for(const route of ['/ro','/ro/example-guide']) {
    await page.goto(route);const trigger=page.locator('.floating-reading');const image=page.locator('main img').first();
    await expect(page.getByRole('button',{name:'Setări de lectură',exact:true})).toHaveCount(1);await expect(page.locator('header .reading-trigger,.media-tools')).toHaveCount(0);
    const tb=await trigger.boundingBox();const ib=await image.boundingBox();expect(tb!.x).toBe(0);expect(tb!.width).toBe(48);expect(tb!.x+tb!.width).toBeLessThan(ib!.x);
    await trigger.click();const panel=page.getByRole('dialog');const before=await panel.boundingBox();expect(before!.x).toBe(60);expect(before!.x+before!.width).toBeLessThan(ib!.x);
    await page.mouse.move(1400,800);await page.mouse.wheel(0,600);await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(200);
    const after=await panel.boundingBox();expect(after!.x).toBeCloseTo(before!.x,0);expect(after!.y).toBeCloseTo(before!.y,0);
    const triggerAfter=await trigger.boundingBox();expect(triggerAfter!.x).toBe(0);expect(triggerAfter!.y).toBeCloseTo(tb!.y,0);await expect(panel).toBeVisible();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:route==='/ro'?'docs/verification/screenshots/media-controls-preview.png':'docs/verification/screenshots/audio-guide-preview.png',fullPage:true});
    await page.setViewportSize({width:320,height:900});await page.evaluate(()=>document.documentElement.style.fontSize='32px');
    await expect.poll(async()=>panel.evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0 && r.right<=window.innerWidth && r.top>=0 && r.bottom<=window.innerHeight && node.scrollWidth<=node.clientWidth;})).toBe(true);
    await expect.poll(async()=> (await trigger.boundingBox())!.x).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);
    await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='');
  }
});
test('missing language voices never fall back to a different language and can be retried',async({page})=>{
  await mockSpeech(page,'en');await page.goto('/ro/example-guide');await page.getByRole('button',{name:copy.ro.options,exact:true}).click();const audio=page.locator('.gg-sheet .read-aloud');
  await audio.getByRole('button',{name:copy.ro.start,exact:true}).click();await expect(audio.getByRole('status')).toContainText('voce în română');expect((await fixture(page)).texts).toEqual([]);
  await page.evaluate(()=>{const s=(window as unknown as {__speech:SpeechFixture}).__speech;s.voices[0]={...s.voices[0],lang:'ro-RO'};});
  await audio.getByRole('button',{name:copy.ro.start,exact:true}).click();expect((await fixture(page)).lang).toBe('ro-RO');
});
test('unsupported speech leaves the complete readable guide and screen-reader guidance available',async({page})=>{
  await mockSpeech(page,'en',true);await page.goto('/en/example-guide');await page.getByRole('button',{name:copy.en.options,exact:true}).click();const audio=page.locator('.gg-sheet .read-aloud');
  await expect(audio.getByRole('button',{name:copy.en.start,exact:true})).toBeDisabled();await expect(audio.getByRole('status')).toContainText('screen reader');
  await page.getByRole('button',{name:copy.en.full,exact:true}).click();await expect(page.locator('.guide-text-steps>li')).toHaveCount(5);
});
test('page reader excludes controls and form values, stops on panel close and cancels competing narration',async({page})=>{
  await mockSpeech(page);await page.goto('/en/contact');await page.getByLabel('Your name *',{exact:true}).fill('Do not narrate this input value');
  await page.locator('.floating-reading').click();const dialog=page.getByRole('dialog');await dialog.locator('.reading-audio-details summary').click();const pageAudio=dialog.locator('.read-aloud');
  await pageAudio.getByRole('button',{name:copy.en.start,exact:true}).click();await page.evaluate(()=>(window as unknown as {__speech:SpeechFixture}).__speech.finish());
  const spoken=(await fixture(page)).texts.join('\n');expect(spoken).toContain('Let’s make visits clearer.');expect(spoken).not.toContain('Do not narrate this input value');
  await page.keyboard.press('Escape');await page.goto('/en/example-guide');await page.getByRole('button',{name:copy.en.options,exact:true}).click();const guideAudio=page.locator('.gg-sheet .read-aloud');
  await guideAudio.getByRole('button',{name:copy.en.start,exact:true}).click();await page.locator('.floating-reading').click();await dialog.locator('.reading-audio-details summary').click();
  await pageAudio.getByRole('button',{name:copy.en.start,exact:true}).click();await expect(guideAudio.getByRole('button',{name:copy.en.stop,exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');expect((await fixture(page)).cancelled).toBeGreaterThan(0);
  await guideAudio.getByRole('button',{name:copy.en.start,exact:true}).click();await page.getByRole('link',{name:'Contact',exact:true}).first().click();
  await expect(page).toHaveURL(/\/en\/contact$/);
});
