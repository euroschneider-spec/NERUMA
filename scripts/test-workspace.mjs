import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';

const env={...process.env,VIANORAE_TEST_FIXTURE:'1',VIANORAE_SUPABASE_PROJECT_REF:'vianorae-fixture',NEXT_PUBLIC_SUPABASE_URL:'https://vianorae-fixture.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VIANORAE_WORKSPACE_ENABLED:'1'};
const children=[];let browser;let checks=0;
function start(command,args,extra={},log='/tmp/vianorae-workspace-test.log') {
  const child=spawn(command,args,{env:{...env,...extra},stdio:['ignore','pipe','pipe']});children.push(child);
  const output=createWriteStream(log);child.stdout.pipe(output);child.stderr.pipe(output);return child;
}
async function ready(url) {
  for(let i=0;i<120;i++) {
    try {if((await fetch(url)).ok) return;} catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`Test service did not start: ${url}`);
}
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
const base='http://localhost:3011';
async function login(page,owner=1) {
  await page.goto(`${base}/en/login`);await page.getByLabel('Work email',{exact:true}).fill(`owner${owner}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill('Fixture-only-passphrase-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(/\/en\/(account|workspace|admin\/organisations)$/);
}
const saved=page=>expect(page.locator('.status-message[role]')).toContainText('Draft saved');
const save=async page=>{await page.getByRole('button',{name:'Save',exact:true}).last().click();await saved(page);};
try {
  if(!process.argv.includes('--skip-build')) {
    const build=start('npm',['run','build'],{},'/tmp/vianorae-workspace-build.log');
    const code=await new Promise(resolve=>build.on('exit',resolve));assert.equal(code,0,'Fixture build failed; inspect /tmp/vianorae-workspace-build.log');
  }
  start('node',['scripts/workspace-fixture.mjs'],{},'/tmp/vianorae-workspace-fixture.log');
  await ready('http://127.0.0.1:3012/health');
  start('node',['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{NODE_OPTIONS:`${process.env.NODE_OPTIONS || ''} --import ${process.cwd()}/scripts/workspace-fixture-fetch.mjs`},'/tmp/vianorae-workspace-server.log');
  await ready(`${base}/en/login`);browser=await chromium.launch();
  const context=await browser.newContext();const page=await context.newPage();
  await check('unauthenticated workspace redirects to sign in and photo API returns 401',async()=>{
    await page.goto(`${base}/en/workspace`);await expect(page).toHaveURL(/\/en\/login$/);
    assert.equal((await context.request.get(`${base}/api/workspace/photos?key=anything`)).status(),401);
  });
  await check('verified owner signs in and opens their organisation workspace',async()=>{
    await login(page);await expect(page).toHaveURL(/\/en\/workspace$/);
    const sidebar=page.getByRole('complementary');
    await expect(sidebar.getByText('Fixture museum 1',{exact:true})).toBeVisible();
    await expect(sidebar.getByText('Owner',{exact:true})).toBeVisible();
    await expect(page.locator('.site-header')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Dashboard',level:1})).toBeVisible();
    await expect(sidebar.getByRole('link',{name:'Public site'})).toHaveCount(0);
    await expect(sidebar.getByRole('link',{name:'NERUMA'})).toHaveAttribute('href','/en');
    await expect(sidebar.locator('.language-switch summary')).toBeVisible();
    await expect(sidebar.getByRole('group',{name:'Colour tone'}).getByRole('button',{name:'Warm'})).toBeVisible();
    const tab=await page.locator('.floating-reading').boundingBox();const signOut=await sidebar.getByRole('button',{name:'Sign out',exact:true}).boundingBox();
    assert.ok(tab && signOut && (tab.y+tab.height<=signOut.y || signOut.y+signOut.height<=tab.y || tab.x+tab.width<=signOut.x || signOut.x+signOut.width<=tab.x),'the reading tab must not cover Sign out');
    await sidebar.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
    await expect(sidebar.getByText('Fixture museum 1',{exact:true})).toBeHidden();
    await expect(sidebar.getByRole('link',{name:'Dashboard',exact:true})).toBeVisible();
    await page.reload();await expect(sidebar.getByRole('button',{name:'Expand sidebar',exact:true})).toBeVisible();
    await sidebar.getByRole('button',{name:'Expand sidebar',exact:true}).click();await expect(sidebar.getByText('Fixture museum 1',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Create a location',exact:true}).click();
  });
  await check('the location editor opens quietly: a status line, no responsibility box, hints as tooltips',async()=>{
    await expect(page.locator('.responsibility-notice')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Save',exact:true})).toHaveCount(2);
    const publish=page.getByRole('button',{name:'Publish',exact:true});
    await expect(publish).toHaveCount(2);for(const button of await publish.all()) await expect(button).toHaveAttribute('aria-disabled','true');
    await expect(page.getByText('Editing in')).toHaveCount(0);
    const hint='Publishing is not available yet';
    const tip=page.getByRole('button',{name:'Publish',exact:true}).first();
    const text=page.getByRole('tooltip').filter({hasText:hint});
    await expect(text).toBeHidden();
    await tip.hover();await expect(text).toBeVisible();await page.mouse.move(0,0);await expect(text).toBeHidden();
    await tip.focus();await expect(text).toBeVisible();await page.keyboard.press('Escape');await expect(text).toBeHidden();
    await expect(page.getByLabel('Country code',{exact:false})).toHaveCount(0);
    await expect(page.getByRole('radiogroup',{name:'Location type',exact:true}).getByText('Other',{exact:true})).toBeVisible();
  });
  await check('new zone requires initial save before private photo upload',async()=>{
    await expect(page.locator('input[type=file]')).toBeDisabled();
    await page.getByLabel('Location name',{exact:true}).fill('Fixture Gallery');await page.getByLabel('City',{exact:true}).fill('Example city');
    await page.getByLabel('Zone title',{exact:true}).fill('Main entrance');
    await page.locator('.builder-zone').getByLabel('Short description',{exact:true}).fill('A step-free entrance, checked by the venue.');
    await save(page);await page.waitForURL(/\/en\/workspace\/[0-9a-f-]{36}$/);await expect(page.locator('input[type=file]')).toBeEnabled();
  });
  const editUrl=page.url();
  await check('the dashboard lists the saved location with its status, and sign out works from the sidebar',async()=>{
    await page.goto(`${base}/en/workspace`);
    await expect(page.getByRole('heading',{name:'Fixture Gallery',level:3})).toBeVisible();
    await expect(page.locator('.location-card').getByText('Draft',{exact:true})).toBeVisible();
    await expect(page.locator('.location-card').getByRole('button',{name:'Publish',exact:true})).toHaveAttribute('aria-disabled','true');
    await expect(page.locator('.location-card').getByText('Example city',{exact:false})).toBeVisible();
    const other=await (await browser.newContext()).newPage();
    await login(other);await other.getByRole('button',{name:'Sign out',exact:true}).click();
    await expect(other).toHaveURL(/\/en\/login$/);await other.goto(`${base}/en/workspace`);await expect(other).toHaveURL(/\/en\/login$/);
    await page.goto(editUrl);
  });
  await check('saved draft and sensory data survive a full reload',async()=>{
    await page.getByRole('radiogroup',{name:'Sound',exact:true}).getByText('Moderate',{exact:true}).click();await save(page);await page.reload();
    await expect(page.getByLabel('Location name',{exact:true})).toHaveValue('Fixture Gallery');
    await expect(page.getByRole('radiogroup',{name:'Sound',exact:true}).getByLabel('Moderate',{exact:true})).toBeChecked();
  });
  const png=await sharp({create:{width:1900,height:1100,channels:3,background:'#668878'}}).png().toBuffer();
  await check('PNG upload is converted into a private WebP and requires attribution',async()=>{
    await page.locator('input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
    await expect(page.getByText('Photograph uploaded privately.',{exact:false})).toBeVisible();
    await page.getByLabel('Image description (alternative text)',{exact:true}).fill('Fictional green entrance illustration');
    await page.getByLabel('Image rights / credit',{exact:true}).fill('VIANORAE test fixture');
    await page.getByLabel('Date photographed',{exact:true}).fill('2026-10-01');await save(page);
  });
  let photoPath;
  await check('private photo download is resized and metadata-free',async()=>{
    photoPath=await page.locator('.draft-photo').getAttribute('src');const response=await context.request.get(`${base}${photoPath}`);
    assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);
    const info=await sharp(await response.body()).metadata();assert.equal(info.format,'webp');assert.equal(info.width,1600);assert.equal(info.exif,undefined);assert.equal(info.xmp,undefined);
  });
  await check('saved preview reads persisted photograph and description',async()=>{
    await page.getByRole('link',{name:'Preview',exact:true}).first().click();
    await expect(page.getByText('A step-free entrance, checked by the venue.',{exact:true})).toBeVisible();
    await expect(page.getByRole('img',{name:'Fictional green entrance illustration'})).toBeVisible();
    assert.match((await context.request.get(page.url())).headers()['cache-control'],/private.*no-store/);
  });
  await check('private preview offers reading controls and narrates only saved organisation content',async()=>{
    await expect(page.locator('.floating-reading')).toBeVisible();
    await page.evaluate(()=>{
      let current=null;const spoken=[];
      Object.defineProperty(window,'__privateSpeech',{value:{spoken,finish:()=>{let count=0;while(current&&count++<100){const next=current;current=null;next.onend?.({});}}},configurable:true});
      Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'en-GB',name:'Fixture English',default:true,localService:true,voiceURI:'fixture'}],speak:utterance=>{current=utterance;spoken.push(utterance.text);},cancel:()=>{current=null;},pause:()=>{},resume:()=>{}},configurable:true});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});
    });
    const audio=page.locator('main .read-aloud');await audio.getByRole('button',{name:'Read aloud',exact:true}).click();
    await page.evaluate(()=>window.__privateSpeech.finish());await expect(audio.getByRole('status')).toHaveText('Reading finished.');
    const spoken=await page.evaluate(()=>window.__privateSpeech.spoken.join('\n'));
    assert.match(spoken,/Fixture Gallery/);assert.match(spoken,/A step-free entrance, checked by the venue/);assert.match(spoken,/Fictional green entrance illustration/);assert.match(spoken,/Sound: Moderate/);assert.doesNotMatch(spoken,/Willow Museum|Willow Square/);
  });
  const second=await browser.newContext();const secondPage=await second.newPage();await login(secondPage);await secondPage.goto(editUrl);
  await check('a separate browser session sees the saved draft and photo',async()=>{
    await expect(secondPage.getByLabel('Zone title',{exact:true})).toHaveValue('Main entrance');
    await expect(secondPage.getByLabel('Image rights / credit',{exact:true})).toHaveValue('VIANORAE test fixture');
    await expect(secondPage.getByLabel('Date photographed',{exact:true})).toHaveValue('2026-10-01');
  });
  await page.goto(editUrl);
  await check('concurrent stale save preserves unsaved text and does not overwrite the newer revision',async()=>{
    await page.getByLabel('Location name',{exact:true}).fill('Latest fixture name');await save(page);
    await secondPage.getByLabel('Location name',{exact:true}).fill('Unsaved conflicting name');
    await secondPage.getByRole('button',{name:'Save',exact:true}).last().click();
    await expect(secondPage.locator('.status-message[role=alert]')).toContainText('Someone saved a newer version');
    await expect(secondPage.getByLabel('Location name',{exact:true})).toHaveValue('Unsaved conflicting name');
    await page.reload();await expect(page.getByLabel('Location name',{exact:true})).toHaveValue('Latest fixture name');
  });
  await check('unsaved navigation can be cancelled',async()=>{
    let seen=false;secondPage.once('dialog',async dialog=>{seen=true;await dialog.dismiss();});
    await secondPage.getByRole('complementary').getByRole('link',{name:'Dashboard',exact:true}).click();assert.equal(seen,true);await expect(secondPage).toHaveURL(editUrl);
  });
  const other=await browser.newContext();const otherPage=await other.newPage();await login(otherPage,2);
  await check('another organisation cannot read the place, preview or private photo',async()=>{
    const place=await otherPage.goto(editUrl);assert.equal(place.status(),404);
    const preview=await otherPage.goto(`${editUrl}/preview`);assert.equal(preview.status(),404);
    assert.equal((await other.request.get(`${base}${photoPath}`)).status(),404);
    await otherPage.goto(`${base}/en/workspace`);await expect(otherPage.getByText('No locations yet.',{exact:false})).toBeVisible();
  });
  await check('cross-origin, oversized and malformed images are rejected without replacing the saved photo',async()=>{
    const endpoint=`${base}/api/workspace/photos`;const fields={placeId:editUrl.split('/').at(-1),zoneId:photoPath.split('%2F')[2]};
    const wrong=await context.request.post(endpoint,{headers:{Origin:'https://other.example.test'},multipart:{...fields,file:{name:'a.webp',mimeType:'image/webp',buffer:Buffer.from('RIFF')}}});assert.equal(wrong.status(),403);
    const missing=await context.request.post(endpoint,{multipart:{...fields,file:{name:'a.webp',mimeType:'image/webp',buffer:Buffer.from('RIFF')}}});assert.equal(missing.status(),403);
    const huge=await context.request.post(endpoint,{headers:{Origin:base},multipart:{...fields,file:{name:'large.webp',mimeType:'image/webp',buffer:Buffer.alloc(3*1024*1024+65537)}}});assert.equal(huge.status(),413);
    const response=await context.request.post(endpoint,{headers:{Origin:base},multipart:{...fields,file:{name:'bad.webp',mimeType:'image/webp',buffer:Buffer.from('not an image')}}});
    assert.equal(response.status(),400);await page.reload();await expect(page.getByLabel('Image rights / credit',{exact:true})).toHaveValue('VIANORAE test fixture');
  });
  await check('steps fold, a folded required field opens its step, and adding and removing a step persists without deleting zone history',async()=>{
    await page.getByRole('button',{name:'Add a zone',exact:true}).click();
    const zone=page.locator('.builder-zone').nth(1);await zone.getByLabel('Zone title',{exact:true}).fill('Quiet room');
    await zone.getByLabel('Short description',{exact:true}).fill('A fictional quiet room.');
    await expect(page.getByRole('button',{name:/^Move (earlier|later)/})).toHaveCount(0);
    await save(page);await page.reload();
    const second=page.locator('.builder-zone').nth(1);const toggle=second.locator('.zone-toggle');await expect(toggle).toHaveAccessibleName(/^Step 2 · Quiet room/);
    await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(second.getByLabel('Zone title',{exact:true})).toBeHidden();
    await expect(toggle).not.toContainText('Needs details');
    const first=page.locator('.builder-zone').first().locator('.zone-toggle');
    await expect(page.getByRole('button',{name:'Move up: Quiet room',exact:true})).toHaveCount(0);
    await first.click();await expect(first).toHaveAttribute('aria-expanded','false');
    await page.getByRole('button',{name:'Move up: Quiet room',exact:true}).click();
    await expect(page.locator('.builder-zone').first().locator('.zone-toggle')).toHaveAccessibleName(/^Step 1 · Quiet room/);
    await page.getByRole('button',{name:'Move down: Quiet room',exact:true}).click();
    await expect(toggle).toHaveAccessibleName(/^Step 2 · Quiet room/);
    await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
    await expect(second.getByLabel('Zone title',{exact:true})).toHaveValue('Quiet room');
    await second.getByLabel('Zone title',{exact:true}).fill('');await toggle.click();
    await page.getByRole('button',{name:'Save',exact:true}).last().click();
    await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(second.getByLabel('Zone title',{exact:true})).toBeFocused();
    await second.getByLabel('Zone title',{exact:true}).fill('Quiet room');
    await page.locator('.builder-zone').nth(1).getByRole('button',{name:'Remove this step: Quiet room',exact:true}).click();await save(page);await page.reload();
    assert.equal(await page.locator('.builder-zone').count(),1);
  });
  await check('Romanian descriptions and photo alternative text persist separately from English',async()=>{
    await page.goto(editUrl.replace('/en/','/ro/'));
    await page.getByLabel('Numele locației',{exact:true}).fill('Galerie fictivă');
    await page.getByLabel('Titlul zonei',{exact:true}).fill('Intrarea principală');
    await page.locator('.builder-zone').getByLabel('Descriere scurtă',{exact:true}).fill('O intrare fictivă fără trepte.');
    await page.getByLabel('Descrierea imaginii (text alternativ)',{exact:true}).fill('Ilustrație fictivă a intrării');
    await page.getByRole('button',{name:'Salvează',exact:true}).last().click();
    await expect(page.locator('.status-message[role]')).toContainText('Draft salvat');await page.reload();
    await expect(page.getByLabel('Numele locației',{exact:true})).toHaveValue('Galerie fictivă');
    await page.goto(editUrl);await expect(page.getByLabel('Location name',{exact:true})).toHaveValue('Latest fixture name');
    await expect(page.getByLabel('Image description (alternative text)',{exact:true})).toHaveValue('Fictional green entrance illustration');
  });
  await check('a step removes a field and adds it back with its text, and keeps its own short text and yes / no per language',async()=>{
    const zone=page.locator('.builder-zone').first();
    await zone.getByLabel('Useful note',{exact:true}).fill('Ask staff at the desk');
    await zone.getByRole('button',{name:'Remove: Useful note',exact:true}).click();
    await expect(zone.getByLabel('Useful note',{exact:true})).toHaveCount(0);
    await expect(zone.getByRole('button',{name:'Useful note',exact:true})).toBeFocused();
    await zone.getByRole('button',{name:'Short text',exact:true}).click();
    await expect(zone.getByLabel('Field name',{exact:true})).toBeFocused();
    await zone.getByLabel('Field name',{exact:true}).fill('Opening hours');await zone.getByLabel('Text',{exact:true}).fill('10-18');
    await zone.getByRole('button',{name:'Yes / no',exact:true}).click();
    await zone.getByLabel('Question',{exact:true}).fill('Seating available?');
    await zone.getByRole('radiogroup',{name:'Answer'}).getByText('Yes',{exact:true}).click();
    await expect(zone.getByRole('button',{name:'Remove: Seating available?',exact:true})).toBeVisible();
    await expect(zone.getByRole('button',{name:'Remove: Sensory profile'})).toHaveCount(0);
    await save(page);await page.reload();
    await expect(zone.getByLabel('Useful note',{exact:true})).toHaveCount(0);
    await expect(zone.getByLabel('Field name',{exact:true})).toHaveValue('Opening hours');
    await page.getByRole('link',{name:'Preview',exact:true}).first().click();
    await expect(page.locator('.own-fields')).toContainText('Opening hours10-18');await expect(page.locator('.own-fields')).toContainText('Seating available?Yes');
    await expect(page.getByText('Ask staff at the desk')).toHaveCount(0);
    await page.goto(editUrl.replace('/en/','/ro/'));
    await expect(zone.locator('.zone-toggle')).toContainText('Necesită detalii');
    await expect(zone.getByLabel('Numele câmpului',{exact:true})).toHaveValue('');
    await expect(zone.getByRole('radiogroup',{name:'Răspuns'}).getByRole('radio',{name:'Da',exact:true})).toBeChecked();
    await zone.getByLabel('Numele câmpului',{exact:true}).fill('Program');await zone.getByLabel('Text',{exact:true}).fill('10-18');
    await zone.getByLabel('Întrebare',{exact:true}).fill('Locuri de stat?');
    await page.getByRole('button',{name:'Salvează',exact:true}).last().click();
    await expect(page.locator('.status-message[role]')).toContainText('Draft salvat');
    await page.goto(editUrl);
    await expect(zone.getByLabel('Field name',{exact:true})).toHaveValue('Opening hours');
    await zone.getByRole('button',{name:'Useful note',exact:true}).click();
    await expect(zone.getByLabel('Useful note',{exact:true})).toHaveValue('Ask staff at the desk');
    await expect(zone.getByLabel('Useful note',{exact:true})).toBeFocused();
    await save(page);
  });
  for(const locale of ['en','ro','de']) {
    await check(`${locale.toUpperCase()} online editor passes automated WCAG A/AA checks and narrow-screen reflow`,async()=>{
      await page.goto(editUrl.replace('/en/',`/${locale}/`));
      const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(audit.violations,[]);
      await page.setViewportSize({width:320,height:800});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Horizontal overflow');
      await page.addStyleTag({content:'html { font-size: 200%; }'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'200% text overflow');
      await page.setViewportSize({width:1280,height:900});
    });
  }
  await page.goto(editUrl);await page.screenshot({path:'docs/verification/screenshots/online-builder-preview.png',fullPage:true});
  await check('detaching a photo persists while retaining the private file',async()=>{
    await page.getByRole('button',{name:'Detach photograph from draft',exact:true}).click();await save(page);await page.reload();
    await expect(page.getByText('No photograph attached.',{exact:true})).toBeVisible();
    assert.equal((await context.request.get(`${base}${photoPath}`)).status(),200);
  });
  await check('sign out clears access to the saved workspace and photo',async()=>{
    await page.goto(`${base}/en/account`);await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/en/login');
    assert.equal((await context.request.get(`${base}${photoPath}`)).status(),401);
    await page.goto(editUrl);await expect(page).toHaveURL(/\/en\/login$/);
  });
  const applicantContext=await browser.newContext();const applicant=await applicantContext.newPage();
  const adminContext=await browser.newContext();const adminPage=await adminContext.newPage();
  const fillApplication=async()=>{
    await applicant.getByLabel('Organisation name',{exact:true}).fill('Verified fixture museum');
    await applicant.getByLabel('Responsible representative',{exact:true}).fill('Fixture director');
    await applicant.getByLabel('Official website (https://)',{exact:true}).fill('https://museum.example.test');
    await applicant.getByLabel('Country code (two letters)',{exact:true}).fill('DE');
    await applicant.getByLabel('Registry reference (optional)',{exact:true}).fill('Fixture register 42');
    await applicant.getByLabel('Your role in the organisation',{exact:true}).fill('Director');
    await applicant.getByLabel('How can your authority to represent the organisation be confirmed?',{exact:true}).fill('The registered office can independently confirm the director’s written mandate.');
    for(const checkbox of await applicant.locator('.organisation-form').getByRole('checkbox').all()) await checkbox.check();
  };
  const pdf=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  let mandatePath;
  await check('confirmed applicant sees verification form and cannot access the editor',async()=>{
    await login(applicant,4);await expect(applicant.getByRole('button',{name:'Submit for manual review',exact:true})).toBeVisible();
    await applicant.goto(`${base}/en/workspace`);await expect(applicant).toHaveURL(/\/en\/account$/);
    await expect(applicant.getByRole('link',{name:'Organisation workspace',exact:true})).toHaveCount(0);
    await fillApplication();
    if(!await applicant.locator('input[name=document]').count()) {
      await expect(applicant.getByRole('button',{name:'Submit for manual review',exact:true})).toBeDisabled();
      await applicant.getByLabel('Upload mandate document',{exact:true}).setInputFiles({name:'mandate.pdf',mimeType:'application/pdf',buffer:pdf});
      await expect(applicant.getByText('Document uploaded privately.',{exact:true})).toBeVisible();
      mandatePath=await applicant.locator('a[download]').first().getAttribute('href');
      await applicant.reload();await expect(applicant.locator('input[name=document]')).toHaveCount(1);await fillApplication();
    }
    await applicant.getByRole('button',{name:'Submit for manual review',exact:true}).click();
    await expect(applicant.getByRole('heading',{name:'Awaiting manual verification',exact:true})).toBeVisible();
    await expect(applicant.getByRole('button',{name:'Submit for manual review',exact:true})).toHaveCount(0);
  });
  await check('mandate download is private, immutable and served as an attachment',async()=>{
    const owner=await applicantContext.request.get(base+mandatePath);assert.equal(owner.status(),200);assert.deepEqual(await owner.body(),pdf);assert.match(owner.headers()['content-disposition'],/^attachment;/);assert.equal(owner.headers()['cache-control'],'private, no-store');
    assert.equal((await browser.newContext().then(async c=>{try{return (await c.request.get(base+mandatePath)).status();}finally{await c.close();}})),401);
    await login(page,2);assert.equal((await context.request.get(base+mandatePath)).status(),404);
  });
  await check('cross-origin and malformed mandate uploads are rejected',async()=>{
    const endpoint=`${base}/api/verification/documents`;
    const wrong=await applicantContext.request.post(endpoint,{headers:{Origin:'https://other.example.test'},multipart:{file:{name:'mandate.pdf',mimeType:'application/pdf',buffer:pdf}}});assert.equal(wrong.status(),403);
    const fake=await applicantContext.request.post(endpoint,{headers:{Origin:base},multipart:{file:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')}}});assert.equal(fake.status(),400);
    const huge=await applicantContext.request.post(endpoint,{headers:{Origin:base},multipart:{file:{name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(3*1024*1024+1)}}});assert.ok([400,413].includes(huge.status()));
  });
  await check('ordinary applicants cannot open the platform review queue',async()=>{
    const response=await applicant.goto(`${base}/en/admin/organisations`);assert.equal(response.status(),404);
    await applicant.goto(`${base}/en/account`);await expect(applicant.getByRole('heading',{name:'Awaiting manual verification',exact:true})).toBeVisible();
  });
  await check('platform administrator sees pending request and manual evidence controls',async()=>{
    await login(adminPage,3);await expect(adminPage).toHaveURL(/\/en\/admin\/organisations$/);
    await expect(adminPage.getByRole('heading',{name:'Verified fixture museum',exact:true})).toBeVisible();
    assert.equal((await adminContext.request.get(base+mandatePath)).status(),200);
    await expect(adminPage.getByLabel('I opened and checked this mandate document: mandate.pdf',{exact:true})).toHaveJSProperty('required',true);
    await expect(adminPage.getByLabel('Independent mandate confirmation (reference, contact, method and date)',{exact:true})).toHaveJSProperty('required',true);
    const audit=await new AxeBuilder({page:adminPage}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(audit.violations,[]);
    await adminPage.setViewportSize({width:320,height:800});await adminPage.addStyleTag({content:'html{font-size:200%}'});
    assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await adminPage.setViewportSize({width:1280,height:900});await adminPage.reload();
  });
  await check('incomplete approval is prevented in browser; request for information is recorded',async()=>{
    await adminPage.getByLabel('Message for the applicant',{exact:true}).fill('Please identify the official contact for confirming your mandate.');
    await adminPage.getByRole('button',{name:'Record decision',exact:true}).click();
    await expect(adminPage.getByRole('heading',{name:'Verified fixture museum',exact:true})).toBeVisible();
    await adminPage.getByRole('radiogroup',{name:'Decision',exact:true}).getByText('Request more information',{exact:true}).click();
    await adminPage.getByRole('button',{name:'Record decision',exact:true}).click();
    await expect(adminPage.getByRole('heading',{name:'Verified fixture museum',exact:true})).toHaveCount(0);
    await applicant.goto(`${base}/en/account`);await expect(applicant.getByRole('heading',{name:'More information required',exact:true})).toBeVisible();
    await expect(applicant.getByText('Please identify the official contact for confirming your mandate.',{exact:true})).toBeVisible();
  });
  await check('applicant can resubmit corrections without receiving access',async()=>{
    await fillApplication();
    if(!await applicant.locator('input[name=document]').count()) {
      await expect(applicant.getByRole('button',{name:'Submit for manual review',exact:true})).toBeDisabled();
      await applicant.getByLabel('Upload mandate document',{exact:true}).setInputFiles({name:'mandate.pdf',mimeType:'application/pdf',buffer:pdf});
      await expect(applicant.getByText('Document uploaded privately.',{exact:true})).toBeVisible();
      mandatePath=await applicant.locator('a[download]').first().getAttribute('href');
      await applicant.reload();await expect(applicant.locator('input[name=document]')).toHaveCount(1);await fillApplication();
    }
    await applicant.getByRole('button',{name:'Submit for manual review',exact:true}).click();
    await expect(applicant.getByRole('heading',{name:'Awaiting manual verification',exact:true})).toBeVisible();
    await applicant.goto(`${base}/en/workspace`);await expect(applicant).toHaveURL(/\/en\/account$/);
  });
  await check('manual approval with evidence grants organisation editing and keeps audit private',async()=>{
    await adminPage.goto(`${base}/en/admin/organisations`);
    await adminPage.getByLabel('Official source checked (URL / registry reference)',{exact:true}).fill('https://registry.example.test/museum-42');
    await adminPage.getByLabel('Independent mandate confirmation (reference, contact, method and date)',{exact:true}).fill('Fixture mandate confirmed by the independently sourced registered office on 2026-10-07.');
    await adminPage.getByLabel('Message for the applicant',{exact:true}).fill('Your organisation and representative mandate have been verified.');
    await adminPage.getByLabel('I independently verified the organisation’s existence and identity.',{exact:true}).check();
    await adminPage.getByLabel('I opened and checked this mandate document: mandate.pdf',{exact:true}).check();
    await adminPage.getByLabel('I independently confirmed this person’s authority to represent the organisation.',{exact:true}).check();
    await adminPage.getByRole('button',{name:'Record decision',exact:true}).click();
    await expect(adminPage.getByRole('heading',{name:'Verified fixture museum',exact:true})).toHaveCount(0);
    await applicant.goto(`${base}/en/account`);await expect(applicant.getByRole('heading',{name:'Organisation access approved',exact:true})).toBeVisible();
    await expect(applicant.getByText('Fixture mandate confirmed by the independently sourced registered office',{exact:false})).toHaveCount(0);
    await applicant.getByRole('link',{name:'Organisation workspace',exact:true}).click();
    await applicant.waitForURL('**/en/workspace');
    await expect(applicant.getByText('Verified fixture museum',{exact:true})).toBeVisible();
    await adminPage.goto(`${base}/en/admin/organisations?history=1`);
    await adminPage.locator('.verification-request details').getByText('Review history (administrators only)',{exact:true}).click();
    await expect(adminPage.getByText('Fixture mandate confirmed by the independently sourced registered office on 2026-10-07.',{exact:true})).toBeVisible();
    await adminPage.screenshot({path:'docs/verification/screenshots/organisation-verification-preview.png',fullPage:true});
  });
  await check('suspending an approved organisation removes access without signing the applicant out',async()=>{
    await adminPage.getByRole('radiogroup',{name:'Decision',exact:true}).getByText('Suspend access',{exact:true}).click();
    await adminPage.getByLabel('Message for the applicant',{exact:true}).fill('Access suspended until the representative mandate is reconfirmed.');
    await adminPage.getByRole('button',{name:'Record decision',exact:true}).click();
    await expect(adminPage.getByText('Organisation access suspended',{exact:false}).first()).toBeVisible();
    await applicant.goto(`${base}/en/account`);
    await expect(applicant.getByRole('heading',{name:'Organisation access suspended',exact:true})).toBeVisible();
    await applicant.goto(`${base}/en/workspace`);await expect(applicant).toHaveURL(/\/en\/account$/);
    await expect(applicant.getByRole('link',{name:'Organisation workspace',exact:true})).toHaveCount(0);
  });
  for(const locale of ['en','ro','de']) {
    await check(`${locale.toUpperCase()} request form is accessible and explains manual approval`,async()=>{
      await applicant.goto(`${base}/${locale}/register`);
      const audit=await new AxeBuilder({page:applicant}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(audit.violations,[]);
      await applicant.setViewportSize({width:320,height:800});await applicant.addStyleTag({content:'html{font-size:200%}'});
      assert.equal(await applicant.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await applicant.setViewportSize({width:1280,height:900});
    });
  }
  await check('the header offers one organisations door and advertises no tier-specific destination',async()=>{
    for(const page of [adminPage,applicant]) {
      await page.goto(`${base}/en`);
      await expect(page.locator('.nav-org')).toHaveAttribute('href','/en/for-organisations');
      await expect(page.locator('.site-header').getByRole('link',{name:'Platform administration',exact:true})).toHaveCount(0);
      await expect(page.locator('.site-header').getByRole('link',{name:'Organisation account',exact:true})).toHaveCount(0);
    }
    await adminPage.goto(`${base}/en/admin/organisations`);await expect(adminPage).toHaveURL(/\/en\/admin\/organisations$/);
  });
  await check('signup success states email confirmation and explicitly distinguishes unsubmitted organisation request',async()=>{
    await applicant.goto(`${base}/en/register`);await fillApplication();await applicant.getByLabel('Work email',{exact:true}).fill('signup@example.test');await applicant.getByLabel('Password',{exact:true}).fill('Fixture-only-passphrase-123');
    await applicant.getByRole('button',{name:'Request organisation access',exact:true}).click();
    await expect(applicant.getByRole('heading',{name:'Email confirmation needed',exact:true})).toBeVisible();
    await expect(applicant.getByText('Your organisation request has not been submitted yet.',{exact:false})).toBeVisible();
    await expect(applicant.getByRole('button',{name:'Request organisation access',exact:true})).toHaveCount(0);
  });
  await check('email rate limits and resend feedback are visible without claiming delivery',async()=>{
    await applicant.goto(`${base}/en/register`);await fillApplication();await applicant.getByLabel('Work email',{exact:true}).fill('limited@example.test');await applicant.getByLabel('Password',{exact:true}).fill('Fixture-only-passphrase-123');
    await applicant.getByRole('button',{name:'Request organisation access',exact:true}).click();await expect(applicant.locator('main').getByRole('alert')).toContainText('The email service is limiting requests.');
    await applicant.goto(`${base}/en/login`);await applicant.getByLabel('Confirmation email address',{exact:true}).fill('limited@example.test');await applicant.getByRole('button',{name:'Resend confirmation email',exact:true}).click();await expect(applicant.locator('main').getByRole('alert')).toContainText('The email service is limiting requests.');
    await applicant.getByLabel('Confirmation email address',{exact:true}).fill('confirmed@example.test');await applicant.getByRole('button',{name:'Resend confirmation email',exact:true}).click();await expect(applicant.getByRole('status')).toContainText('The confirmation request was accepted.');
  });
  await check('missing evidence migration locks request submission but preserves approved workspaces',async()=>{
    await fetch('http://127.0.0.1:3012/__fixture/evidence-mode',{method:'POST',body:JSON.stringify({enabled:false})});
    try {
      await login(page,5);await expect(page.getByRole('button',{name:'Submit for manual review',exact:true})).toBeDisabled();
      await expect(page.getByText('Private document upload is being activated.',{exact:false})).toBeVisible();
      await login(page,1);await page.goto(editUrl);await expect(page).toHaveURL(new RegExp('/en/workspace/'+new URL(editUrl).pathname.split('/').at(-1)+'$'));
    } finally {await fetch('http://127.0.0.1:3012/__fixture/evidence-mode',{method:'POST',body:JSON.stringify({enabled:true})});}
  });
  await check('missing verification migration fails closed for registration, workspace and photos',async()=>{
    await login(page,1);await fetch('http://127.0.0.1:3012/__fixture/verification-mode',{method:'POST',body:JSON.stringify({enabled:false})});
    try {
      await page.goto(`${base}/en/register`);await expect(page.getByRole('button',{name:'Request organisation access',exact:true})).toBeDisabled();
      await page.goto(editUrl);await expect(page).toHaveURL(/\/en\/account$/);
      await expect(page.getByText('Organisation verification is being activated.',{exact:false})).toBeVisible();
      assert.equal((await context.request.get(`${base}${photoPath}`)).status(),401);
    } finally {await fetch('http://127.0.0.1:3012/__fixture/verification-mode',{method:'POST',body:JSON.stringify({enabled:true})});}
  });
  console.log(`${checks} online workspace checks passed (real migrations; simulated Auth/Storage HTTP).`);
} finally {
  if(browser) await browser.close();for(const child of children) if(child.exitCode===null) child.kill('SIGTERM');
}
