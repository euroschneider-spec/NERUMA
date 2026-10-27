import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createHmac } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { FIXTURE_ADMIN_TOTP_SECRET, totp } from './fixture-totp.mjs';

const env={...process.env,VIANORAE_TEST_FIXTURE:'1',VIANORAE_SUPABASE_PROJECT_REF:'vianorae-fixture',NEXT_PUBLIC_SUPABASE_URL:'https://vianorae-fixture.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VIANORAE_WORKSPACE_ENABLED:'1',
  // Payments against the fixture's fake Stripe (test-only values; docs/guides/PAYMENTS.md).
  VIANORAE_STRIPE_SECRET_KEY:'sk_test_fixture',VIANORAE_STRIPE_WEBHOOK_SECRET:'whsec_fixture',VIANORAE_STRIPE_PRICE_ID:'price_fixture',
  VIANORAE_BILLING_SECRET:'fixture-only-billing-secret-0123456789abcdef'};
const children=[];let browser;let checks=0;
// `--group=<name>` runs one part of the suite on its own fixture so CI can run the parts side by side; no flag runs them all in order.
const group=process.argv.find(arg=>arg.startsWith('--group='))?.slice(8);
const only=name=>!group||group===name;
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
// Authenticator keys of the fixture users who have two-factor sign-in: the administrator from the start, others once set up.
const authenticators={3:FIXTURE_ADMIN_TOTP_SECRET};
const enterCode=async(page,code)=>{await page.getByLabel('6-digit code from the app',{exact:true}).fill(code);await page.getByRole('button',{name:'Confirm',exact:true}).click();};
async function signInWithPassword(page,owner) {
  // The login page sends a signed-in person on to their own page, so switching person starts from signed out.
  await page.context().clearCookies({name:/^sb-/});
  await page.goto(`${base}/en/login`);await page.getByLabel('Work email',{exact:true}).fill(`owner${owner}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill('Fixture-only-passphrase-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(/\/en\/(account|workspace|admin(\/organisations)?|login\/verify)$/);
}
async function signInWithPasswordExpectingRefusal(page,owner) {
  await page.goto(`${base}/en/login`);await page.waitForLoadState('networkidle');await page.getByLabel('Work email',{exact:true}).fill(`owner${owner}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill('Fixture-only-passphrase-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toBeVisible();
}
async function login(page,owner=1) {
  await signInWithPassword(page,owner);
  if(page.url().endsWith('/en/login/verify')) {await enterCode(page,totp(authenticators[owner]));await page.waitForURL(/\/en\/(account|workspace|admin(\/organisations)?)$/);}
}
// A subscription changes in Stripe, and Stripe tells the webhook, signing the event with the endpoint's secret the way Stripe does.
// The webhook then asks (the fake) Stripe for the subscription as it is now.
let stripeEventCount=0;
async function stripeEvent(status,{org='00000000-0000-4000-8000-000000000101',customer='cus_Fixture1',signature}={}) {
  const created=Math.floor(Date.now()/1000)+(++stripeEventCount);
  const subscription={id:'sub_Fixture1',object:'subscription',customer,status,cancel_at_period_end:false,cancel_at:null,metadata:{organization_id:org},
    items:{data:[{current_period_end:created+30*86400}]}};
  if(!signature) await fixture('stripe-subscription',subscription);
  const payload=JSON.stringify({id:`evt_fixture${stripeEventCount}`,object:'event',type:'customer.subscription.updated',created,data:{object:subscription}});
  const signed=signature ?? `t=${created},v1=${createHmac('sha256',env.VIANORAE_STRIPE_WEBHOOK_SECRET).update(`${created}.${payload}`).digest('hex')}`;
  return (await fetch(`${base}/api/stripe/webhook`,{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signed},body:payload})).status;
}
const fixture=(path,body)=>fetch(`http://127.0.0.1:3012/__fixture/${path}`,body===undefined?{}:{method:'POST',body:JSON.stringify(body)}).then(response=>response.json());
const newContext=async()=>{const context=await browser.newContext({colorScheme:'dark'});return {context,view:await context.newPage()};};
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
  const context=await browser.newContext({colorScheme:'dark'});const page=await context.newPage();
  if(only('workspace')) {
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
    await expect(sidebar.getByRole('group',{name:'Colour tone'})).toHaveCount(0);
    await expect(page.locator('.topbar-reading')).toHaveCount(0);
    const reading=sidebar.getByRole('button',{name:'Reading settings',exact:true});await expect(reading).toBeVisible();
    await reading.click();const panel=page.getByRole('dialog',{name:'Reading settings'});await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Accent colour',{exact:true})).toBeVisible();
    await page.keyboard.press('Escape');await expect(panel).toBeHidden();await expect(reading).toBeFocused();
    await sidebar.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
    await expect(sidebar.getByText('Fixture museum 1',{exact:true})).toBeHidden();
    await expect(sidebar.getByRole('link',{name:'Dashboard',exact:true})).toBeVisible();
    // The logo folds to its mark: the word goes, the link keeps its name.
    const folded=sidebar.getByRole('link',{name:'NERUMA',exact:true});
    await expect(folded.locator('svg').first()).toBeVisible();await expect(folded.locator('svg').last()).toBeHidden();
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
    await page.getByLabel('Step name',{exact:true}).fill('Main entrance');
    await page.locator('.builder-zone').getByLabel('Short description',{exact:true}).fill('A step-free entrance, checked by the venue.');
    await save(page);await page.waitForURL(/\/en\/workspace\/[0-9a-f-]{36}$/);await expect(page.locator('input[type=file]')).toBeEnabled();
  });
  const editUrl=page.url();
  await check('the dashboard lists the saved location with its status, and sign out works from the sidebar',async()=>{
    await page.goto(`${base}/en/workspace`);
    await expect(page.getByRole('heading',{name:'Fixture Gallery',level:3})).toBeVisible();
    await expect(page.locator('.location-card').getByText('Draft',{exact:true})).toBeVisible();
    // With publishing in the database, Publish lives in the editor (where the saved version is), not on the card.
    await expect(page.locator('.location-card').getByRole('button',{name:'Publish',exact:true})).toHaveCount(0);
    await expect(page.locator('.location-card').getByRole('button',{name:'QR code and link'})).toHaveCount(0);
    await expect(page.locator('.location-card').getByText('Example city',{exact:false})).toBeVisible();
    const other=await (await browser.newContext({colorScheme:'dark'})).newPage();
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
    await expect(page.getByRole('complementary').getByRole('button',{name:'Reading settings',exact:true})).toBeVisible();
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
  const second=await browser.newContext({colorScheme:'dark'});const secondPage=await second.newPage();await login(secondPage);await secondPage.goto(editUrl);
  await check('a separate browser session sees the saved draft and photo',async()=>{
    await expect(secondPage.getByLabel('Step name',{exact:true})).toHaveValue('Main entrance');
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
  const other=await browser.newContext({colorScheme:'dark'});const otherPage=await other.newPage();await login(otherPage,2);
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
    await page.getByRole('button',{name:'Add a step',exact:true}).click();
    const zone=page.locator('.builder-zone').nth(1);await zone.getByLabel('Step name',{exact:true}).fill('Quiet room');
    await zone.getByLabel('Short description',{exact:true}).fill('A fictional quiet room.');
    await expect(page.getByRole('button',{name:/^Move (earlier|later)/})).toHaveCount(0);
    await save(page);await page.reload();
    const second=page.locator('.builder-zone').nth(1);const toggle=second.locator('.zone-toggle');await expect(toggle).toHaveAccessibleName(/^Step 2 · Quiet room/);
    await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(second.getByLabel('Step name',{exact:true})).toBeHidden();
    await expect(toggle).not.toContainText('Needs details');
    const first=page.locator('.builder-zone').first().locator('.zone-toggle');
    await expect(page.getByRole('button',{name:'Move up: Quiet room',exact:true})).toHaveCount(0);
    await first.click();await expect(first).toHaveAttribute('aria-expanded','false');
    await page.getByRole('button',{name:'Move up: Quiet room',exact:true}).click();
    await expect(page.locator('.builder-zone').first().locator('.zone-toggle')).toHaveAccessibleName(/^Step 1 · Quiet room/);
    await page.getByRole('button',{name:'Move down: Quiet room',exact:true}).click();
    await expect(toggle).toHaveAccessibleName(/^Step 2 · Quiet room/);
    await expect(page.getByRole('button',{name:'Collapse all',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Expand all',exact:true})).toHaveCount(2);
    await first.click();await expect(first).toHaveAttribute('aria-expanded','true');
    await expect(page.getByRole('button',{name:'Collapse all',exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:'Collapse all',exact:true}).first().click();await expect(first).toHaveAttribute('aria-expanded','false');
    await expect(page.getByRole('button',{name:'Collapse all',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Expand all',exact:true}).last().click();
    await expect(first).toHaveAttribute('aria-expanded','true');await expect(toggle).toHaveAttribute('aria-expanded','true');
    await expect(page.getByRole('button',{name:'Expand all',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Collapse all',exact:true}).last().click();await expect(first).toHaveAttribute('aria-expanded','false');
    await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
    await expect(second.getByLabel('Step name',{exact:true})).toHaveValue('Quiet room');
    await second.getByLabel('Step name',{exact:true}).fill('');await toggle.click();
    await page.getByRole('button',{name:'Save',exact:true}).last().click();
    await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(second.getByLabel('Step name',{exact:true})).toBeFocused();
    await second.getByLabel('Step name',{exact:true}).fill('Quiet room');
    const removeLink=page.locator('.builder-zone').nth(1).getByRole('button',{name:'Remove this step: Quiet room',exact:true});
    await removeLink.click();
    const confirmBox=page.getByRole('dialog',{name:'Remove this step?'});await expect(confirmBox).toBeVisible();
    await expect(confirmBox.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');await expect(confirmBox).toBeHidden();assert.equal(await page.locator('.builder-zone').count(),2);
    await removeLink.click();await confirmBox.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirmBox).toBeHidden();assert.equal(await page.locator('.builder-zone').count(),2);
    await removeLink.click();await confirmBox.getByRole('button',{name:'Remove step',exact:true}).click();
    assert.equal(await page.locator('.builder-zone').count(),1);await expect(page.getByRole('button',{name:'Add a step',exact:true})).toBeFocused();
    await save(page);await page.reload();
    assert.equal(await page.locator('.builder-zone').count(),1);
  });
  await check('Romanian descriptions and photo alternative text persist separately from English',async()=>{
    await page.goto(editUrl.replace('/en/','/ro/'));
    await page.getByLabel('Numele locației',{exact:true}).fill('Galerie fictivă');
    await page.getByLabel('Numele pasului',{exact:true}).fill('Intrarea principală');
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
    await page.getByRole('button',{name:'Detach photo',exact:true}).click();await save(page);await page.reload();
    await expect(page.getByText('No photo yet.',{exact:true})).toBeVisible();
    assert.equal((await context.request.get(`${base}${photoPath}`)).status(),200);
  });
  let publicAddress,qrPath;
  // The QR code leads to the guide in the visitor's language when it is published (this visitor prefers Romanian, and Romanian is live too).
  const guideAddress=()=>new RegExp(`${publicAddress.replace('/en/','/(en|ro)/')}$`);
  const visitor=await (await browser.newContext({colorScheme:'dark',extraHTTPHeaders:{'Accept-Language':'ro-RO,ro;q=0.9'}})).newPage();
  const publishDialog=page.getByRole('dialog',{name:'Publish this guide?'});
  await check('Publish asks first: which languages go live and which wait, the responsibility text and one tick',async()=>{
    await page.goto(editUrl);
    // Publishing waits for a saved version: after a change it is switched off.
    await page.getByLabel('Location name',{exact:true}).fill('Fixture Gallery');
    await expect(page.getByRole('button',{name:'Publish',exact:true}).first()).toHaveAttribute('aria-disabled','true');
    await save(page);
    while(await page.locator('.builder-zone').count()<3) {
      await page.getByRole('button',{name:'Add a step',exact:true}).click();
      const zone=page.locator('.builder-zone').last();await zone.getByLabel('Step name',{exact:true}).fill(`Step ${await page.locator('.builder-zone').count()}`);
      await zone.getByLabel('Short description',{exact:true}).fill('A fictional space, described by the venue.');
    }
    await save(page);
    // Every photo needs its description in English; a step's photo from the earlier checks is detached.
    await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await expect(publishDialog).toBeVisible();
    // A guide needs one step: Romanian, saved with its one step, goes live too (it used to wait for three).
    await expect(publishDialog.getByRole('region',{name:'Goes live'})).toContainText('English');
    await expect(publishDialog.getByRole('region',{name:'Goes live'})).toContainText('Română');
    await expect(publishDialog.getByRole('region',{name:'Waits'})).toHaveCount(0);
    await expect(publishDialog).toContainText('Your information can change someone’s experience.');
    await expect(publishDialog.getByRole('button',{name:'Publish now',exact:true})).toBeDisabled();
    await publishDialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(publishDialog).toBeHidden();
  });
  await check('the owner publishes: the card says Published and has a QR code made for it, and the public guide opens for a visitor',async()=>{
    await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await publishDialog.getByLabel('We have checked this guide and take responsibility for it.').check();
    await publishDialog.getByRole('button',{name:'Publish now',exact:true}).click();
    await expect(page.locator('.status-message[role]')).toContainText('Published. Visitors see this version now.');
    await expect(page.getByRole('link',{name:'Open the public guide'}).first()).toHaveAttribute('href',/\/en\/places\/fixture-gallery-example-city\/guide$/);
    publicAddress=await page.getByRole('link',{name:'Open the public guide'}).first().getAttribute('href');
    await page.goto(`${base}/en/workspace`);
    const card=page.locator('.location-card').filter({hasText:'Fixture Gallery'});
    await expect(card.locator('.status-badge')).toHaveText('Published');
    await card.getByRole('button',{name:'QR code and link'}).click();
    const dialog=page.getByRole('dialog',{name:'QR code and link'});
    const link=(await dialog.locator('.qr-link code').textContent()).trim();assert.match(link,/^\/q\/[0-9a-f]{8}$/);qrPath=link;
    await expect(dialog.locator('img.qr-image')).toHaveAttribute('src',`/api${link.replace('/q/','/qr/')}`);
    await dialog.getByRole('button',{name:'Close'}).click();
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByRole('heading',{name:'Fixture Gallery',level:1})).toBeVisible();
    await expect(visitor.locator('.gg-title')).toBeVisible();
    await expect(visitor.getByText('Demonstration',{exact:false})).toHaveCount(0);
    // Published is not the same as listed: Explore is a feature a platform administrator switches on (next check).
    await visitor.goto(`${base}/en/explore`);
    await expect(visitor.getByText('Fixture Gallery')).toHaveCount(0);
  });
  await check('a platform administrator switches Explore on for the organisation: the "Show in Explore" switch per location is greyed out until then, and every switch lands in the change log',async()=>{
    const card=page.locator('.location-card').filter({hasText:'Fixture Gallery'});
    const toggle=card.getByLabel('Show in Explore',{exact:true});
    // Without Explore the switch is still there, greyed out, and says whom to ask.
    const greyedOut=async()=>{
      await expect(toggle).toHaveAttribute('aria-disabled','true');
      await expect(toggle).not.toBeChecked();
      await toggle.focus();
      await expect(card.getByRole('tooltip')).toBeVisible();
      await expect(card.getByRole('tooltip')).toHaveText('Explore listing is not switched on for your organisation. Contact NERUMA to enable it.');
      await toggle.click({force:true});
      await expect(toggle).not.toBeChecked();
    };
    await page.goto(`${base}/en/workspace`);
    await greyedOut();
    const greyedAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(greyedAudit.violations.map(v=>v.id),[]);
    const admin=await (await browser.newContext({colorScheme:'dark'})).newPage();
    await login(admin,3);
    const account=`${base}/en/admin/accounts/00000000-0000-4000-8000-000000000001`;
    await admin.goto(account);
    const organisation=admin.locator('li').filter({hasText:'Fixture museum 1'});
    await expect(organisation.getByText('Explore is off',{exact:false})).toBeVisible();
    await organisation.getByRole('button',{name:'Switch on Explore for Fixture museum 1',exact:true}).click();
    await expect(organisation.getByText('Explore is on',{exact:false})).toBeVisible();
    // The owner: on by default, and the guide appears in Explore.
    await page.goto(`${base}/en/workspace`);
    await expect(toggle).toBeChecked();
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[]);
    await visitor.goto(`${base}/en/explore`);
    await expect(visitor.getByRole('heading',{name:'Fixture Gallery',level:2})).toBeVisible();
    // Hiding the location takes it out of Explore only: its guide and QR code keep working.
    await toggle.uncheck();
    await expect(card.getByRole('status')).toHaveText('Saved.');
    await visitor.goto(`${base}/en/explore`);
    await expect(visitor.getByText('Fixture Gallery')).toHaveCount(0);
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.locator('.gg-title')).toBeVisible();
    await visitor.goto(`${base}${qrPath}`);
    await expect(visitor).toHaveURL(guideAddress());
    // Switching the feature off asks first, takes the switch away, and keeps the location's own choice.
    await admin.goto(account);
    await organisation.getByRole('button',{name:'Switch off Explore',exact:true}).click();
    const ask=admin.getByRole('dialog',{name:'Switch off Explore for Fixture museum 1?'});
    await ask.getByRole('button',{name:'Keep it on',exact:true}).click();
    await expect(organisation.getByText('Explore is on',{exact:false})).toBeVisible();
    await organisation.getByRole('button',{name:'Switch off Explore',exact:true}).click();
    await ask.getByRole('button',{name:'Switch off Explore',exact:true}).click();
    await expect(organisation.getByText('Explore is off',{exact:false})).toBeVisible();
    await page.goto(`${base}/en/workspace`);
    await greyedOut();
    await admin.goto(account);
    await organisation.getByRole('button',{name:'Switch on Explore for Fixture museum 1',exact:true}).click();
    await expect(organisation.getByText('Explore is on',{exact:false})).toBeVisible();
    await page.goto(`${base}/en/workspace`);
    await expect(toggle).not.toBeChecked();
    await visitor.goto(`${base}/en/explore`);
    await expect(visitor.getByText('Fixture Gallery')).toHaveCount(0);
    await toggle.check();
    await expect(card.getByRole('status')).toHaveText('Saved.');
    await visitor.goto(`${base}/en/explore`);
    await expect(visitor.getByRole('heading',{name:'Fixture Gallery',level:2})).toBeVisible();
    // The organisation reads each switch in its change log, without the administrator's name.
    await page.goto(`${base}/en/workspace/log`);
    await expect(page.getByRole('heading',{name:'Switched on · Explore listing',level:2})).toHaveCount(2);
    await expect(page.getByRole('heading',{name:'Switched off · Explore listing',level:2})).toHaveCount(1);
    await expect(page.locator('main')).not.toContainText('owner3@example.test');
    await admin.context().close();
  });
  await check('the QR code opens the guide; only published photos are public',async()=>{
    await visitor.goto(`${base}${qrPath}`);
    await expect(visitor).toHaveURL(guideAddress());
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByRole('heading',{name:'Fixture Gallery',level:1})).toBeVisible();
    assert.equal((await visitor.request.get(`${base}/api/guide-photos?key=${'x'.repeat(10)}`)).status(),404);
    assert.equal((await visitor.request.get(`${base}${photoPath}`)).status(),401);
    assert.equal((await visitor.request.get(`${base}/q/ffffffff`,{maxRedirects:0})).status(),404);
    assert.equal((await visitor.request.get(`${base}/en/places/fixture-no-such-guide/guide`)).status(),404);
    // The public guide passes the same automated checks as the rest of the site, in every theme.
    for(const theme of ['dark','light','contrast']) {
      await visitor.addInitScript(value=>localStorage.setItem('vianorae:reading:v1',JSON.stringify({theme:value,themeV:2})),theme);
      await visitor.goto(`${base}${publicAddress}`);await expect(visitor.locator('.gg-title')).toBeVisible();
      const result=await new AxeBuilder({page:visitor}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
      assert.deepEqual(result.violations.map(v=>v.id),[],`${theme}: published guide`);
    }
  });
  await check('the owner archives a published location: it leaves the dashboard and goes offline, can\'t be edited, and comes back as a draft that is published again at the same address',async()=>{
    await page.goto(`${base}/en/workspace`);
    const card=page.locator('.location-card').filter({hasText:'Fixture Gallery'});
    const ask=page.getByRole('dialog',{name:'Archive Fixture Gallery?'});
    await card.getByRole('button',{name:'Archive Fixture Gallery',exact:true}).click();
    await expect(ask).toContainText('Its guide goes offline in every language');
    await ask.getByRole('button',{name:'Keep it',exact:true}).click();
    await expect(card).toHaveCount(1);
    await card.getByRole('button',{name:'Archive Fixture Gallery',exact:true}).click();
    await ask.getByRole('button',{name:'Archive location',exact:true}).click();
    await expect(page.locator('.location-card').filter({hasText:'Fixture Gallery'})).toHaveCount(0);
    const archive=page.locator('details.archived-locations');
    await expect(archive.locator('summary')).toHaveText('Archived locations (1)');
    await archive.locator('summary').click();
    await expect(archive.getByText('Fixture Gallery',{exact:true})).toBeVisible();
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[]);
    // Offline for visitors, gone from Explore, and read-only for the organisation.
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.locator('.gg-title')).toHaveCount(0);
    await visitor.goto(`${base}${qrPath}`);
    await expect(visitor.locator('.gg-title')).toHaveCount(0);
    await visitor.goto(`${base}/en/explore`);
    await expect(visitor.getByText('Fixture Gallery')).toHaveCount(0);
    assert.equal((await page.goto(editUrl)).status(),404);
    // Restoring brings it back as a draft; publishing again keeps the address.
    await page.goto(`${base}/en/workspace`);
    await archive.locator('summary').click();
    await archive.getByRole('button',{name:'Restore Fixture Gallery',exact:true}).click();
    await expect(card.locator('.status-badge')).toHaveText('Draft');
    await expect(page.locator('details.archived-locations')).toHaveCount(0);
    await page.goto(editUrl);
    await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await publishDialog.getByLabel('We have checked this guide and take responsibility for it.').check();
    await publishDialog.getByRole('button',{name:'Publish now',exact:true}).click();
    await expect(page.locator('.status-message[role]')).toContainText('Published. Visitors see this version now.');
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByRole('heading',{name:'Fixture Gallery',level:1})).toBeVisible();
  });
  await check('editing after publishing leaves visitors on the live version and the card asks to publish again',async()=>{
    await page.goto(editUrl);
    await page.getByLabel('Step name',{exact:true}).first().fill('Renamed after publishing');
    await save(page);
    await page.goto(`${base}/en/workspace`);
    await expect(page.locator('.location-card').filter({hasText:'Fixture Gallery'}).getByText('Changes not yet published: publish to update')).toBeVisible();
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByText('Renamed after publishing',{exact:false})).toHaveCount(0);
    await page.goto(editUrl);await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await publishDialog.getByLabel('We have checked this guide and take responsibility for it.').check();
    await publishDialog.getByRole('button',{name:'Publish now',exact:true}).click();
    await expect(page.locator('.status-message[role]')).toContainText('Published.');
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.locator('.gg-title')).toHaveText('Renamed after publishing');
  });
  await check('unpublishing asks first; the address and the QR code then say the guide is unavailable, without its name',async()=>{
    await page.goto(editUrl);
    await page.getByRole('button',{name:'Unpublish',exact:true}).first().click();
    const ask=page.getByRole('dialog',{name:'Take this guide down?'});await expect(ask).toBeVisible();
    await ask.getByRole('button',{name:'Cancel',exact:true}).click();
    await visitor.goto(`${base}${publicAddress}`);await expect(visitor.locator('.gg-title')).toBeVisible();
    await page.getByRole('button',{name:'Unpublish',exact:true}).first().click();
    await page.getByRole('dialog',{name:'Take this guide down?'}).getByRole('button',{name:'Unpublish',exact:true}).click();
    await expect(page.locator('.status-message[role]')).toContainText('Taken down.');
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByRole('heading',{name:"This guide isn't available right now"})).toBeVisible();
    await expect(visitor.getByText('Fixture Gallery')).toHaveCount(0);
    await visitor.goto(`${base}${qrPath}`);
    await expect(visitor).toHaveURL(/\/ro\/guide-unavailable$/);
    await expect(visitor.getByRole('heading',{name:'Acest ghid nu este disponibil acum'})).toBeVisible();
    await visitor.goto(`${base}/en/explore`);await expect(visitor.getByText('Fixture Gallery')).toHaveCount(0);
  });
  await check('publishing again brings back the same address and QR code',async()=>{
    await page.goto(editUrl);await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await publishDialog.getByLabel('We have checked this guide and take responsibility for it.').check();
    await publishDialog.getByRole('button',{name:'Publish now',exact:true}).click();
    await expect(page.locator('.status-message[role]')).toContainText('Published.');
    await visitor.goto(`${base}${qrPath}`);
    await expect(visitor).toHaveURL(guideAddress());
    await expect(visitor.locator('.gg-title')).toBeVisible();
  });
  await check('a platform administrator visits the organisation: it is marked, they correct and take down but cannot publish or add, and the owner reads the change log',async()=>{
    const adminPage=await (await browser.newContext()).newPage();await login(adminPage,3);
    await adminPage.goto(`${base}/en/admin/accounts`);
    await adminPage.getByLabel('Search by email',{exact:true}).fill('owner1@');
    await adminPage.getByRole('button',{name:'Search',exact:true}).click();
    await adminPage.getByRole('button',{name:'Visit Fixture museum 1 as a platform administrator',exact:true}).click();
    await expect(adminPage).toHaveURL(/\/en\/workspace\?org=[0-9a-f-]{36}$/);
    const strip=adminPage.getByRole('region',{name:'Platform administrator visit'});
    await expect(strip).toContainText('You are viewing Fixture museum 1 as a platform administrator.');
    await expect(adminPage.getByRole('complementary').getByText('Platform administrator (visiting)',{exact:true})).toBeVisible();
    await expect(adminPage.getByRole('link',{name:'Create a location',exact:true})).toHaveCount(0);
    await expect(adminPage.getByRole('link',{name:'Plan & billing',exact:true})).toHaveCount(0);
    await expect(adminPage.getByRole('link',{name:'Report a problem',exact:true})).toHaveCount(0);
    await expect(adminPage.getByRole('complementary').getByRole('link',{name:'Change log',exact:true})).toBeVisible();
    assert.equal((await adminPage.goto(`${base}/en/workspace/new`)).status(),404);
    await adminPage.goto(editUrl);
    await expect(strip).toBeVisible();
    await expect(adminPage.getByRole('button',{name:'Publish',exact:true})).toHaveCount(0);
    await expect(adminPage.getByRole('button',{name:'Add a step',exact:true})).toHaveCount(0);
    await expect(adminPage.getByRole('button',{name:/^Remove step/})).toHaveCount(0);
    const audit=await new AxeBuilder({page:adminPage}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(audit.violations,[]);
    await adminPage.setViewportSize({width:320,height:800});
    assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'the strip fits a phone');
    await expect(adminPage.getByRole('button',{name:'Leave visit',exact:true})).toBeVisible();
    await adminPage.setViewportSize({width:1280,height:720});
    await adminPage.locator('.builder-zone').first().getByLabel('Step name',{exact:true}).fill('Main entrance (corrected)');
    await save(adminPage);
    await visitor.goto(`${base}${publicAddress}`);await expect(visitor.locator('.gg-title')).toBeVisible();
    await adminPage.getByRole('button',{name:'Take down',exact:true}).first().click();
    const ask=adminPage.getByRole('dialog',{name:'Take this guide down as a platform administrator?'});await expect(ask).toBeVisible();
    await ask.getByRole('button',{name:'Cancel',exact:true}).click();
    await visitor.goto(`${base}${publicAddress}`);await expect(visitor.locator('.gg-title')).toBeVisible();
    await adminPage.getByRole('button',{name:'Take down',exact:true}).first().click();
    await adminPage.getByRole('dialog',{name:'Take this guide down as a platform administrator?'}).getByRole('button',{name:'Take down as platform administrator',exact:true}).click();
    await expect(adminPage.locator('.status-message[role]')).toContainText('Taken down. The organisation can publish again when it is ready.');
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByRole('heading',{name:"This guide isn't available right now"})).toBeVisible();
    await adminPage.getByRole('button',{name:'Leave visit',exact:true}).first().click();
    await expect(adminPage).toHaveURL(/\/en\/admin\/accounts$/);
    await adminPage.goto(`${base}/en/workspace`);await expect(adminPage).toHaveURL(/\/en\/admin$/);
    await adminPage.goto(editUrl);await expect(adminPage).toHaveURL(/\/en\/admin$/);
    // The sidebar has its own way back, and signing out ends a visit too: the next sign-in finds none.
    await adminPage.goto(`${base}/en/admin/accounts`);
    await adminPage.getByLabel('Search by email',{exact:true}).fill('owner1@');
    await adminPage.getByRole('button',{name:'Search',exact:true}).click();
    await adminPage.getByRole('button',{name:'Visit Fixture museum 1 as a platform administrator',exact:true}).click();
    await expect(adminPage).toHaveURL(/\/en\/workspace\?org=[0-9a-f-]{36}$/);
    await adminPage.getByRole('complementary').getByRole('button',{name:'Back to administration',exact:true}).click();
    await expect(adminPage).toHaveURL(/\/en\/admin\/accounts$/);
    await adminPage.getByLabel('Search by email',{exact:true}).fill('owner1@');
    await adminPage.getByRole('button',{name:'Search',exact:true}).click();
    await adminPage.getByRole('button',{name:'Visit Fixture museum 1 as a platform administrator',exact:true}).click();
    await expect(strip).toBeVisible();
    await adminPage.getByRole('complementary').getByRole('button',{name:'Sign out',exact:true}).click();
    await adminPage.waitForURL('**/en/login');
    await login(adminPage,3);
    await adminPage.goto(`${base}/en/workspace`);await expect(adminPage).toHaveURL(/\/en\/admin$/);
    await page.goto(`${base}/en/workspace/log`);
    await expect(page.getByRole('heading',{name:'Change log',level:1})).toBeVisible();
    const entries=page.locator('.change-entry');
    await expect(entries.filter({hasText:'Took the guide down'})).toHaveCount(1);
    const edit=entries.filter({hasText:'Changed · Step text'});await expect(edit).toHaveCount(1);
    await expect(edit).toContainText('Title');await expect(edit).toContainText('Main entrance (corrected)');
    await expect(page.locator('.change-log')).toContainText('NERUMA support');
    await expect(page.locator('main')).not.toContainText('owner3@example.test');
    const logAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(logAudit.violations,[]);
    await page.goto(editUrl);await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await publishDialog.getByLabel('We have checked this guide and take responsibility for it.').check();
    await publishDialog.getByRole('button',{name:'Publish now',exact:true}).click();
    await expect(page.locator('.status-message[role]')).toContainText('Published.');
    await visitor.goto(`${base}${publicAddress}`);await expect(visitor.locator('.gg-title')).toBeVisible();
  });
  await check('Plan & billing: before payments start publishing is free; the owner pays on Stripe and comes back to an active plan',async()=>{
    await page.goto(`${base}/en/workspace`);
    await page.getByRole('complementary').getByRole('link',{name:'Plan & billing'}).click();
    await expect(page).toHaveURL(/\/en\/workspace\/billing$/);
    await expect(page.getByRole('heading',{name:'Plan & billing',level:1})).toBeVisible();
    await expect(page.getByText('Test mode: no real money is taken.',{exact:false})).toBeVisible();
    await expect(page.getByText('Publishing is free for now.',{exact:false})).toBeVisible();
    await expect(page.getByText('No plan yet.',{exact:true})).toBeVisible();
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    assert.deepEqual(result.violations.map(v=>v.id),[],'Plan & billing');
    // Stripe's pages are Stripe's: the test stands in for them.
    await page.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Stripe Checkout (test)</title><h1>Stripe Checkout (test)</h1>'}));
    await page.route('https://billing.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Stripe customer page (test)</title><h1>Stripe customer page (test)</h1>'}));
    await page.getByRole('button',{name:'Choose a plan',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Stripe Checkout (test)'})).toBeVisible();
    const sent=await fixture('stripe-last/checkout');
    assert.equal(sent.mode,'subscription');assert.equal(sent['line_items[0][price]'],'price_fixture');assert.equal(sent.locale,'en');
    assert.equal(sent['subscription_data[metadata][organization_id]'],'00000000-0000-4000-8000-000000000101');
    assert.equal(sent.customer_email,'owner1@example.test');assert.equal(sent['automatic_tax[enabled]'],'true');
    // Only Stripe's correctly signed event changes anything.
    assert.equal(await stripeEvent('active',{signature:'t=1,v1='+'0'.repeat(64)}),400);
    assert.equal(await stripeEvent('active'),200);
    await page.goto(sent.success_url);
    await expect(page.getByText('Thank you. Stripe is confirming the payment',{exact:false})).toBeVisible();
    await expect(page.getByText(/^Plan active\. It renews on \d+ \w+ \d{4}\.$/)).toBeVisible();
    await page.getByRole('button',{name:'Change payment details or cancel',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Stripe customer page (test)'})).toBeVisible();
    const portal=await fixture('stripe-last/portal');
    assert.equal(portal.customer,'cus_Fixture1');assert.match(portal.return_url,/\/en\/workspace\/billing\?org=00000000-0000-4000-8000-000000000101$/);
    await page.unrouteAll();
  });
  await check('once payments are on, a failed payment keeps the guide online for 30 days; then it is unavailable and Publish asks for a plan; paying brings it back',async()=>{
    await fixture('payments-required',{from:new Date(Date.now()-60000).toISOString()});
    assert.equal(await stripeEvent('past_due'),200);
    await page.goto(`${base}/en/workspace`);
    await expect(page.getByText(/The payment for the plan didn't go through\. Your guides stay online until \d+ \w+ \d{4}\./)).toBeVisible();
    await visitor.goto(`${base}${publicAddress}`);await expect(visitor.locator('.gg-title')).toBeVisible();
    await fixture('payments-grace-over',{});
    await visitor.goto(`${base}${publicAddress}`);
    await expect(visitor.getByRole('heading',{name:"This guide isn't available right now"})).toBeVisible();
    await visitor.goto(`${base}${qrPath}`);await expect(visitor).toHaveURL(/\/guide-unavailable$/);
    await page.goto(`${base}/en/workspace`);
    await expect(page.getByText('The plan has ended: your guides are not shown to visitors.',{exact:false})).toBeVisible();
    await page.goto(editUrl);await page.getByRole('button',{name:'Publish',exact:true}).first().click();
    await expect(publishDialog.getByRole('alert')).toContainText('Publishing needs an active plan.');
    await expect(publishDialog.getByRole('link',{name:'Choose one under Plan & billing, then publish.'})).toHaveAttribute('href','/en/workspace/billing?org=00000000-0000-4000-8000-000000000101');
    await expect(publishDialog.getByRole('button',{name:'Publish now',exact:true})).toBeDisabled();
    await publishDialog.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await stripeEvent('active'),200);
    await visitor.goto(`${base}${qrPath}`);
    await expect(visitor).toHaveURL(guideAddress());await expect(visitor.locator('.gg-title')).toBeVisible();
    await fixture('payments-required',{from:null});
  });
  await check('sign out clears access to the saved workspace and photo',async()=>{
    await page.goto(`${base}/en/account`);await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/en/login');
    assert.equal((await context.request.get(`${base}${photoPath}`)).status(),401);
    await page.goto(editUrl);await expect(page).toHaveURL(/\/en\/login$/);
  });
  await check('an owner reports a problem; only the platform administrator reads and closes it',async()=>{
    const ownerPage=await (await browser.newContext()).newPage();await login(ownerPage,1);
    await ownerPage.getByRole('complementary').getByRole('link',{name:'Report a problem',exact:true}).click();
    await expect(ownerPage).toHaveURL(/\/en\/workspace\/report$/);
    await expect(ownerPage.getByRole('heading',{name:'Report a problem or ask for help',level:1})).toBeVisible();
    await expect(ownerPage.getByRole('radiogroup',{name:'Which location is it about?'})).toBeVisible();
    const message='The photo upload stops at 90 percent.';
    await ownerPage.getByLabel('What happened?').fill(message);
    await ownerPage.getByRole('button',{name:'Send report',exact:true}).click();
    await expect(ownerPage.getByRole('status')).toContainText('Your report is saved');
    assert.equal((await ownerPage.goto(`${base}/en/admin/reports`)).status(),404);
    const adminPage=await (await browser.newContext()).newPage();await login(adminPage,3);
    await adminPage.goto(`${base}/en/admin/reports`);
    await expect(adminPage.getByRole('heading',{name:'Problem reports',level:1})).toBeVisible();
    await expect(adminPage.getByRole('heading',{name:'Fixture museum 1',level:2})).toBeVisible();
    await expect(adminPage.getByRole('link',{name:'owner1@example.test'})).toBeVisible();
    await expect(adminPage.getByText(message,{exact:true})).toBeVisible();
    await adminPage.getByRole('button',{name:'Mark as closed',exact:true}).click();
    await expect(adminPage.getByText('No open reports.')).toBeVisible();
    await adminPage.goto(`${base}/en/admin/reports?closed=1`);
    await expect(adminPage.getByText(message,{exact:true})).toBeVisible();
    await expect(adminPage.getByRole('button',{name:'Mark as closed'})).toHaveCount(0);
  });
  await check('missing evidence migration preserves approved workspaces',async()=>{
    await fetch('http://127.0.0.1:3012/__fixture/evidence-mode',{method:'POST',body:JSON.stringify({enabled:false})});
    try {
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
  }
  if(only('approval')) {
  const applicantContext=await browser.newContext({colorScheme:'dark'});const applicant=await applicantContext.newPage();
  const adminContext=await browser.newContext({colorScheme:'dark'});const adminPage=await adminContext.newPage();
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
    const steps=applicant.getByRole('list',{name:'Your first steps',exact:true});
    await expect(steps.getByRole('listitem')).toHaveText([/Email confirmed/,/Send your request/,/Wait for approval/]);
    await expect(steps.locator('[aria-current=step]')).toHaveText(/Send your request/);
    await expect(applicant.getByRole('link',{name:'Delete my account…'})).toHaveCount(0);await expect(applicant.getByRole('link',{name:'Open demo workspace'})).toHaveCount(0);
    await expect(applicant.getByText('Upload your mandate document to continue.',{exact:true})).toBeVisible();
    await expect(applicant.getByRole('button',{name:'Submit for manual review',exact:true})).toHaveAccessibleDescription('Upload your mandate document to continue.');
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
    await expect(applicant.getByRole('list',{name:'Your first steps',exact:true}).locator('[aria-current=step]')).toHaveText(/Wait for approval/);
    await expect(applicant.getByRole('link',{name:'Delete my account…'})).toBeVisible();
  });
  await check('mandate download is private, immutable and served as an attachment',async()=>{
    const owner=await applicantContext.request.get(base+mandatePath);assert.equal(owner.status(),200);assert.deepEqual(await owner.body(),pdf);assert.match(owner.headers()['content-disposition'],/^attachment;/);assert.equal(owner.headers()['cache-control'],'private, no-store');
    assert.equal((await browser.newContext({colorScheme:'dark'}).then(async c=>{try{return (await c.request.get(base+mandatePath)).status();}finally{await c.close();}})),401);
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
    for(const path of ['/en/admin','/en/admin/accounts','/en/admin/administrators']) assert.equal((await applicant.goto(base+path)).status(),404,path);
    await applicant.goto(`${base}/en/account`);await expect(applicant.getByRole('heading',{name:'Awaiting manual verification',exact:true})).toBeVisible();
  });
  await check('platform administrator sees pending request and manual evidence controls',async()=>{
    await login(adminPage,3);await expect(adminPage).toHaveURL(/\/en\/admin$/);await adminPage.goto(`${base}/en/admin/organisations`);
    await expect(adminPage.getByRole('heading',{name:'Verified fixture museum',exact:true})).toBeVisible();
    assert.equal((await adminContext.request.get(base+mandatePath)).status(),200);
    await expect(adminPage.getByLabel('I opened and checked this mandate document: mandate.pdf',{exact:true})).toHaveJSProperty('required',true);
    await expect(adminPage.getByLabel('Independent mandate confirmation (reference, contact, method and date)',{exact:true})).toHaveJSProperty('required',true);
    const audit=await new AxeBuilder({page:adminPage}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(audit.violations,[]);
    await adminPage.setViewportSize({width:320,height:800});await adminPage.addStyleTag({content:'html{font-size:200%}'});
    assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await adminPage.setViewportSize({width:1280,height:900});await adminPage.reload();
  });
  await check('the administration dashboard shows what waits, searches accounts, and adds and removes administrators',async()=>{
    await adminPage.goto(`${base}/en/admin`);
    await expect(adminPage.getByRole('heading',{name:'Administration',exact:true,level:1})).toBeVisible();
    await expect(adminPage.getByRole('link',{name:'Review organisation requests',exact:true}).first()).toBeVisible();
    await expect(adminPage.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
    await expect(adminPage.getByText(/^\d+ waiting$/)).toBeVisible();
    await expect(adminPage.getByText(/^\d+ administrators$/)).toBeVisible();
    const dashboardAudit=await new AxeBuilder({page:adminPage}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(dashboardAudit.violations,[]);
    for(const path of ['','/organisations','/reports','/deletions','/accounts','/administrators']) {
      await adminPage.goto(`${base}/en/admin${path}`);
      await expect(adminPage.locator('.admin-strip').getByText('Platform administration',{exact:true})).toBeVisible();
      await expect(adminPage.locator('.admin-strip')).toContainText('Signed in as owner3@example.test');
    }
    await adminPage.emulateMedia({reducedMotion:'reduce'});
    for(const [theme,tone] of [['dark','cool'],['light','cool'],['dark','warm'],['light','warm'],['contrast','cool']]) for(const path of ['','/administrators']) {
      await adminPage.goto(`${base}/en/admin${path}`);
      await adminPage.evaluate(([t,w])=>{document.documentElement.dataset.theme=t;document.documentElement.dataset.tone=w;},[theme,tone]);
      const themed=await new AxeBuilder({page:adminPage}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(themed.violations,[],`${theme}/${tone} ${path}`);
    }
    await adminPage.goto(`${base}/en/account`);
    await expect(adminPage.locator('.admin-strip')).toHaveCount(0);
    await adminPage.goto(`${base}/en/login`);
    await expect(adminPage).toHaveURL(/\/en\/admin$/);
    await adminPage.goto(`${base}/en/account`);
    await expect(adminPage.getByRole('link',{name:'Administration',exact:true})).toBeVisible();
    await expect(adminPage.getByRole('button',{name:'Submit for manual review',exact:true})).toHaveCount(0);
    await expect(adminPage.getByRole('heading',{name:'Your information can change someone’s experience.',exact:true})).toHaveCount(0);
    await adminPage.goto(`${base}/en/admin/accounts`);
    await adminPage.getByLabel('Search by email',{exact:true}).fill('owner1@');
    await adminPage.getByRole('button',{name:'Search',exact:true}).click();
    await expect(adminPage.getByRole('heading',{name:'owner1@example.test',exact:true})).toBeVisible();
    await expect(adminPage.getByRole('heading',{name:'owner3@example.test',exact:true})).toHaveCount(0);
    await expect(adminPage.getByText('1 found',{exact:true})).toBeVisible();
    await adminPage.goto(`${base}/en/admin/administrators`);
    await expect(adminPage.getByRole('heading',{name:'owner3@example.test (You)',exact:true})).toBeVisible();
    await expect(adminPage.getByRole('button',{name:'Remove',exact:true})).toHaveCount(0);
    await adminPage.getByLabel('Email',{exact:true}).fill('nobody@example.test');
    await adminPage.getByRole('button',{name:'Add administrator',exact:true}).click();
    await expect(adminPage.getByRole('alert').filter({hasText:'There is no confirmed account with that email.'})).toBeVisible();
    await adminPage.getByLabel('Email',{exact:true}).fill('owner1@example.test');
    await adminPage.getByRole('button',{name:'Add administrator',exact:true}).click();
    await expect(adminPage.getByRole('status').filter({hasText:'Added.'})).toBeVisible();
    await expect(adminPage.getByRole('heading',{name:'owner1@example.test',exact:true})).toBeVisible();
    await adminPage.getByRole('button',{name:'Remove',exact:true}).click();
    await adminPage.getByRole('dialog').getByRole('button',{name:'Remove',exact:true}).click();
    await expect(adminPage.getByRole('heading',{name:'owner1@example.test',exact:true})).toHaveCount(0);
    await adminPage.goto(`${base}/en/admin/organisations`);
  });
  await check('an account profile opens from the list, says who is viewing, is read only, and unknown ids are 404',async()=>{
    await adminPage.goto(`${base}/en/admin/accounts`);
    await adminPage.getByLabel('Search by email',{exact:true}).fill('owner1@');
    await adminPage.getByRole('button',{name:'Search',exact:true}).click();
    await adminPage.getByRole('link',{name:'owner1@example.test',exact:true}).click();
    await expect(adminPage).toHaveURL(/\/en\/admin\/accounts\/[0-9a-f-]{36}$/);
    await expect(adminPage.getByRole('heading',{name:'owner1@example.test',exact:true,level:1})).toBeVisible();
    await expect(adminPage.getByText('You are viewing this account as a platform administrator.',{exact:true})).toBeVisible();
    await expect(adminPage.locator('section[aria-labelledby="profile-organisations"]')).toContainText('Fixture museum 1');
    // One button was there before; the other is Visit, which carries the organisation's name for a screen reader. The Explore switch is counted apart.
    assert.equal(await adminPage.evaluate(()=>[...document.querySelectorAll('main button')].filter(button=>!button.closest('.explore-toggle')).length),2);
    await expect(adminPage.getByRole('button',{name:'Visit Fixture museum 1 as a platform administrator',exact:true})).toBeVisible();
    const profileAudit=await new AxeBuilder({page:adminPage}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(profileAudit.violations,[]);
    for(const bad of ['not-an-id','00000000-0000-4000-8000-000000000000']) assert.equal((await adminPage.goto(`${base}/en/admin/accounts/${bad}`)).status(),404,bad);
    assert.equal((await applicant.goto(`${base}/en/admin/accounts/00000000-0000-4000-8000-000000000000`)).status(),404);
    await adminPage.goto(`${base}/en/admin/organisations`);
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
  await check('signed-in owner and administrator pages pass automated checks in every theme and tone',async()=>{
    const combos=[['dark','cool'],['dark','warm'],['light','cool'],['light','warm'],['contrast','cool']];
    for(const [theme,tone] of combos) {
      for(const [who,paths] of [[1,['/en/workspace','/en/workspace/report']],[3,['/en/admin/organisations','/en/admin/reports']]]) {
        const context=await browser.newContext({colorScheme:'dark',reducedMotion:'reduce'});
        await context.addInitScript(([t,o])=>localStorage.setItem('vianorae:reading:v1',JSON.stringify({theme:t,tone:o,themeV:2})),[theme,tone]);
        const view=await context.newPage();await login(view,who);
        for(const path of paths) {
          await view.goto(`${base}${path}`);
          await expect(view.locator('html')).toHaveAttribute('data-theme',theme);
          const audit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
          assert.deepEqual(audit.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join(' | ')}`),[],`${path} in ${theme}/${tone}`);
        }
        await context.close();
      }
    }
  });
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
    await applicant.context().clearCookies({name:/^sb-/});
    await applicant.goto(`${base}/en/login`);await applicant.getByText("Didn't get the email?",{exact:true}).click();await applicant.getByLabel('Confirmation email address',{exact:true}).fill('limited@example.test');await applicant.getByRole('button',{name:'Resend confirmation email',exact:true}).click();await expect(applicant.locator('main').getByRole('alert')).toContainText('The email service is limiting requests.');
    await applicant.getByLabel('Confirmation email address',{exact:true}).fill('confirmed@example.test');await applicant.getByRole('button',{name:'Resend confirmation email',exact:true}).click();await expect(applicant.getByRole('status')).toContainText('The confirmation request was accepted.');
  });
  await check('missing evidence migration locks request submission',async()=>{
    await fetch('http://127.0.0.1:3012/__fixture/evidence-mode',{method:'POST',body:JSON.stringify({enabled:false})});
    try {
      await login(page,5);await expect(page.getByRole('button',{name:'Submit for manual review',exact:true})).toBeDisabled();
      await expect(page.getByText('Private document upload is being activated.',{exact:false})).toBeVisible();
    } finally {await fetch('http://127.0.0.1:3012/__fixture/evidence-mode',{method:'POST',body:JSON.stringify({enabled:true})});}
  });
  }
  if(only('two-factor')) {
  // Two-factor sign-in (brief docs/briefs/2026-10-13-two-factor-sign-in.md).
  const backupPattern=/^[a-z0-9]{4} [a-z0-9]{4} [a-z0-9]{4} [a-z0-9]{4}$/;let backupCodes=[];
  const deadline=from=>fetch('http://127.0.0.1:3012/__fixture/two-factor-deadline',{method:'POST',body:JSON.stringify({from})});
  await check('an owner without two-factor sees the date it becomes required',async()=>{
    const view=await (await browser.newContext({colorScheme:'dark'})).newPage();await login(view,1);await expect(view).toHaveURL(/\/en\/workspace$/);
    await expect(view.getByText('organisation owners and admins must use two-factor sign-in',{exact:false})).toBeVisible();
    await view.evaluate(()=>{document.querySelector('.app-shell').style.minHeight='3000px';window.scrollTo({top:1500,behavior:'instant'});});
    await expect(view.locator('.two-factor-banner')).toBeInViewport();
    assert.equal(Math.round((await view.locator('.two-factor-banner').boundingBox()).y),0);
    await view.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});});
    await view.getByRole('link',{name:'Set it up now',exact:true}).click();await expect(view).toHaveURL(/\/en\/account#two-factor-title$/);
    await expect(view.getByRole('heading',{name:'Two-factor sign-in',level:2})).toBeVisible();
    await view.context().close();
  });
  await check('an owner sets up two-factor; afterwards the workspace stays closed until the code is entered',async()=>{
    const view=await (await browser.newContext({colorScheme:'dark'})).newPage();await login(view,2);
    await view.goto(`${base}/en/account`);await view.getByRole('button',{name:'Set up two-factor sign-in',exact:true}).click();
    await expect(view.getByRole('img',{name:'QR code for your authenticator app'})).toBeVisible();
    const code=view.getByLabel('6-digit code from the app',{exact:true});await expect(code).toBeFocused();
    const secret=(await view.getByText(/^[A-Z2-7]{4}( [A-Z2-7]{1,4})+$/).textContent()).replace(/\s/g,'');
    const audit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],'two-factor setup');
    await code.fill('12345');await view.getByRole('button',{name:'Turn on two-factor sign-in',exact:true}).click();
    await expect(view.locator('main').getByRole('alert')).toContainText('Enter the 6 digits from the app.');
    const wrong=String((Number(totp(secret))+500000)%1000000).padStart(6,'0');
    await code.fill(wrong);await view.getByRole('button',{name:'Turn on two-factor sign-in',exact:true}).click();
    await expect(view.locator('main').getByRole('alert')).toContainText('That code didn’t work.');
    await code.fill(totp(secret));await view.getByRole('button',{name:'Turn on two-factor sign-in',exact:true}).click();
    await expect(view.getByText('Two-factor sign-in is on.',{exact:true})).toBeVisible();authenticators[2]=secret;
    await expect(view.getByRole('heading',{name:'Backup codes',level:3})).toBeFocused();
    backupCodes=(await view.getByText(backupPattern).allTextContents());assert.equal(backupCodes.length,10);
    const codesAudit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(codesAudit.violations.map(v=>v.id),[],'backup codes');
    await expect(view.getByRole('link',{name:'Download the codes',exact:true})).toHaveAttribute('download','neruma-backup-codes.txt');
    await view.getByRole('link',{name:'I’ve saved them, continue',exact:true}).click();await expect(view).toHaveURL(/\/en\/workspace$/);
    await view.getByRole('button',{name:'Sign out',exact:true}).click();await expect(view).toHaveURL(/\/en\/login$/);
    await signInWithPassword(view,2);await expect(view).toHaveURL(/\/en\/login\/verify$/);
    await expect(view.getByRole('heading',{name:'Enter your code',level:1})).toBeVisible();
    const verifyAudit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(verifyAudit.violations.map(v=>v.id),[],'two-factor code step');
    for(const path of ['/en/workspace','/en/account','/en/admin/organisations']) {await view.goto(base+path);await expect(view).toHaveURL(/\/en\/login\/verify$/);}
    await enterCode(view,wrong);await expect(view.locator('main').getByRole('alert')).toContainText('That code didn’t work.');
    await enterCode(view,totp(secret));await expect(view).toHaveURL(/\/en\/workspace$/);
    await expect(view.getByRole('complementary').getByText('Fixture museum 2',{exact:true})).toBeVisible();
    await expect(view.getByText('must use two-factor sign-in',{exact:false})).toHaveCount(0);
    await view.context().close();
  });
  await check('a backup code signs in once without the phone; a new set cancels the old codes',async()=>{
    const view=await (await browser.newContext({colorScheme:'dark'})).newPage();
    const useBackup=async code=>{
      await signInWithPassword(view,2);await expect(view).toHaveURL(/\/en\/login\/verify$/);
      await view.getByText('Use a backup code instead',{exact:true}).click();
      await view.getByLabel('Backup code',{exact:true}).fill(code);await view.getByRole('button',{name:'Use this backup code',exact:true}).click();
    };
    const refused=()=>expect(view.locator('main').getByRole('alert')).toContainText('That backup code didn’t work.');
    const signOut=()=>view.getByRole('button',{name:'Sign out',exact:true}).click();
    await useBackup('aaaa bbbb cccc dddd');await refused();
    await view.getByLabel('Backup code',{exact:true}).fill(backupCodes[0].toUpperCase().replace(/ /g,'-'));await view.getByRole('button',{name:'Use this backup code',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/workspace$/);await signOut();
    await useBackup(backupCodes[0]);await refused();
    await view.getByLabel('Backup code',{exact:true}).fill(backupCodes[1]);await view.getByRole('button',{name:'Use this backup code',exact:true}).click();await expect(view).toHaveURL(/\/en\/workspace$/);
    await view.goto(`${base}/en/account`);await expect(view.getByText('8 of 10 backup codes left.',{exact:true})).toBeVisible();
    const make=view.getByRole('button',{name:'Make new backup codes',exact:true});await make.click();
    const dialog=view.getByRole('dialog',{name:'Make new backup codes?'});await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await view.keyboard.press('Escape');await expect(dialog).toBeHidden();
    await make.click();await dialog.getByRole('button',{name:'Make new codes',exact:true}).click();
    await expect(view.getByRole('heading',{name:'Backup codes',level:3})).toBeFocused();
    const fresh=await view.getByText(backupPattern).allTextContents();assert.equal(fresh.length,10);assert.ok(!fresh.includes(backupCodes[2]));
    await signOut();await useBackup(backupCodes[2]);await refused();
    await view.getByLabel('Backup code',{exact:true}).fill(fresh[0]);await view.getByRole('button',{name:'Use this backup code',exact:true}).click();await expect(view).toHaveURL(/\/en\/workspace$/);
    await view.context().close();
  });
  await check('a remembered device skips the code on that browser only, for 30 days, until it is forgotten',async()=>{
    const view=await (await browser.newContext({colorScheme:'dark'})).newPage();
    await signInWithPassword(view,2);await expect(view).toHaveURL(/\/en\/login\/verify$/);
    const remember=view.getByRole('checkbox',{name:'Remember this device for 30 days'});await expect(remember).toBeVisible();
    const verifyAudit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(verifyAudit.violations.map(v=>v.id),[],'code step with remember');
    await remember.check();await enterCode(view,totp(authenticators[2]));await expect(view).toHaveURL(/\/en\/workspace$/);
    const cookie=(await view.context().cookies()).find(c=>c.name==='neruma_device');
    assert.ok(cookie && cookie.httpOnly && cookie.secure && cookie.sameSite==='Lax' && cookie.expires-Date.now()/1000>29*86400);
    await view.getByRole('button',{name:'Sign out',exact:true}).click();
    await signInWithPassword(view,2);await expect(view).toHaveURL(/\/en\/workspace$/);
    const other=await (await browser.newContext({colorScheme:'dark'})).newPage();
    await signInWithPassword(other,2);await expect(other).toHaveURL(/\/en\/login\/verify$/);await other.context().close();
    const admin=await (await browser.newContext({colorScheme:'dark'})).newPage();
    await signInWithPassword(admin,3);await expect(admin).toHaveURL(/\/en\/login\/verify$/);
    await expect(admin.getByRole('checkbox',{name:'Remember this device for 30 days'})).toHaveCount(0);await admin.context().close();
    await view.goto(`${base}/en/account`);await expect(view.getByRole('heading',{name:'Remembered devices',level:3})).toBeVisible();
    await expect(view.getByText('(this device)',{exact:false})).toBeVisible();
    await view.getByRole('button',{name:/^Forget: Remembered on /}).click();await expect(view).toHaveURL(/\/en\/login\/verify$/);
    assert.equal((await view.context().cookies()).some(c=>c.name==='neruma_device'),false);
    await signInWithPassword(view,2);await expect(view).toHaveURL(/\/en\/login\/verify$/);
    await view.context().close();
  });
  await check('after the deadline, an owner without two-factor is sent to setup and the workspace stays closed',async()=>{
    await deadline(new Date(Date.now()-60000).toISOString());
    try {
      const view=await (await browser.newContext({colorScheme:'dark'})).newPage();await login(view,1);await expect(view).toHaveURL(/\/en\/account$/);
      await expect(view.getByText('Your account must use two-factor sign-in. Set it up to continue.',{exact:true})).toBeVisible();
      await expect(view.getByRole('button',{name:'Submit for manual review',exact:true})).toHaveCount(0);
      await view.goto(`${base}/en/workspace`);await expect(view).toHaveURL(/\/en\/account$/);
      await view.context().close();
    } finally {await deadline(new Date(Date.now()+30*86400000).toISOString());}
  });
  // Edge cases and abuse. Nothing here is mocked beyond the Supabase HTTP layer the whole suite shares.
  await check('signed-out visitors are sent to sign-in from the code step and from the admin pages, and see no data',async()=>{
    const {context,view}=await newContext();
    for(const path of ['/en/login/verify','/en/admin/organisations','/en/admin/reports','/en/workspace','/en/account','/ro/login/verify','/de/admin/reports']) {
      await view.goto(base+path);await expect(view,path).toHaveURL(new RegExp(`/(en|ro|de)/login$`));
    }
    for(const path of ['/api/workspace/photos?key=x','/api/verification/documents?id=00000000-0000-4000-8000-000000000001']) assert.ok([401,403,404].includes((await context.request.get(base+path,{maxRedirects:0})).status()),path);
    await context.close();
  });
  await check('pages behind sign-in are never cached, and sign-in and sign-out leave no cookie behind',async()=>{
    const {context,view}=await newContext();
    assert.equal((await context.cookies()).length,0);
    await login(view,1);
    const names=(await context.cookies()).map(c=>c.name);assert.ok(names.length>0 && names.every(name=>/^sb-.*-auth-token(\.\d+)?$/.test(name)),`sign-in cookies: ${names}`);
    for(const path of ['/en/account','/en/workspace','/en/login']) {const response=await view.goto(base+path);assert.match(response.headers()['cache-control']||'',/no-store/,path);}
    await view.goto(base+'/en/workspace');await view.getByRole('button',{name:'Sign out',exact:true}).click();await expect(view).toHaveURL(/\/en\/login$/);
    assert.deepEqual((await context.cookies()).filter(c=>c.name.startsWith('sb-')),[]);
    await view.goto(base+'/en/workspace');await expect(view).toHaveURL(/\/en\/login$/);
    await view.goBack();await view.goBack().catch(()=>{});await expect(view).not.toHaveURL(/\/en\/workspace$/);
    await context.close();
  });
  await check('a forged or broken remembered-device cookie changes nothing and is thrown away',async()=>{
    for(const forged of ['garbage','0'.repeat(64),'f'.repeat(64),'a'.repeat(3500),'..%2F..%2Fetc%2Fpasswd','%3Cscript%3Ealert(1)%3C%2Fscript%3E','0'.repeat(63)+'g']) {
      const {context,view}=await newContext();
      await context.addCookies([{name:'neruma_device',value:forged,url:base}]);
      await signInWithPassword(view,2);await expect(view,forged.slice(0,12)).toHaveURL(/\/en\/login\/verify$/);
      await view.goto(base+'/en/workspace');await expect(view).toHaveURL(/\/en\/login\/verify$/);
      assert.equal((await context.cookies()).some(c=>c.name==='neruma_device' && c.value===forged),false,'a token that does not work is dropped');
      await context.close();
    }
  });
  await check('the code step stays closed for a wrong code, an empty one and one with letters, and never opens the workspace',async()=>{
    const {context,view}=await newContext();
    await signInWithPassword(view,2);await expect(view).toHaveURL(/\/en\/login\/verify$/);
    for(const attempt of ['000000','123456','12345a','１２３４５６','      ']) {
      await view.getByLabel('6-digit code from the app',{exact:true}).fill(attempt);await view.getByRole('button',{name:'Confirm',exact:true}).click();
      await expect(view.locator('main').getByRole('alert'),attempt).toBeVisible();await expect(view).toHaveURL(/\/en\/login\/verify$/);
    }
    await view.goto(base+'/en/workspace');await expect(view).toHaveURL(/\/en\/login\/verify$/);
    await context.close();
  });
  await check('a signed-in person who already passed is not sent round in circles from the code step or setup',async()=>{
    const {context,view}=await newContext();
    await login(view,2);await expect(view).toHaveURL(/\/en\/workspace$/);
    await view.goto(base+'/en/login/verify');await expect(view).toHaveURL(/\/en\/workspace$/);
    await view.goto(base+'/en/account');await expect(view.getByText('Two-factor sign-in is on.',{exact:true})).toBeVisible();
    await context.close();
  });
  await check('the code step and setup read and pass the checks in Romanian and German too',async()=>{
    const {context,view}=await newContext();
    await signInWithPassword(view,2);
    for(const [locale,heading,button] of [['ro','Introduceți codul','Confirmați'],['de','Code eingeben','Bestätigen']]) {
      await view.goto(`${base}/${locale}/login/verify`);
      await expect(view.getByRole('heading',{name:heading,level:1})).toBeVisible();await expect(view.getByRole('button',{name:button,exact:true})).toBeVisible();
      await expect(view.locator('html')).toHaveAttribute('lang',locale);
      const audit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],`${locale} code step`);
    }
    await view.goto(`${base}/en/login/verify`);await enterCode(view,totp(authenticators[2]));await expect(view).toHaveURL(/\/en\/workspace$/);
    for(const [locale,title] of [['ro','Autentificare în doi pași'],['de','Zwei-Faktor-Anmeldung']]) {
      await view.goto(`${base}/${locale}/account`);
      await expect(view.getByRole('heading',{name:title,level:2})).toBeVisible();
      const audit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],`${locale} account two-factor`);
    }
    await context.close();
  });
  await check('password limits are applied by the server, not only by the form',async()=>{
    const {context,view}=await newContext();
    const unlock=()=>view.getByLabel('Password',{exact:true}).evaluate(input=>{input.removeAttribute('minlength');input.removeAttribute('maxlength');});
    const fill=async(page,email,password)=>{
      await page.getByLabel('Organisation name',{exact:true}).fill('Edge fixture museum');await page.getByLabel('Responsible representative',{exact:true}).fill('Fixture director');
      await page.getByLabel('Official website (https://)',{exact:true}).fill('https://museum.example.test');await page.getByLabel('Country code (two letters)',{exact:true}).fill('DE');
      await page.getByLabel('Your role in the organisation',{exact:true}).fill('Director');
      await page.getByLabel('How can your authority to represent the organisation be confirmed?',{exact:true}).fill('The registered office can independently confirm the director’s written mandate.');
      for(const checkbox of await page.locator('.organisation-form').getByRole('checkbox').all()) await checkbox.check();
      await page.getByLabel('Work email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
    };
    for(const [label,password] of [['11 characters','a'.repeat(11)],['129 characters','a'.repeat(129)],['empty','']]) {
      await view.goto(base+'/en/register');await view.waitForLoadState('networkidle');await unlock();await view.getByLabel('Password',{exact:true}).evaluate(input=>{input.removeAttribute('required');});
      await fill(view,'edge@example.test',password);
      await view.getByRole('button',{name:'Request organisation access',exact:true}).click();
      await expect(view.locator('main').getByRole('alert'),label).toContainText('Complete the required fields');
      await expect(view.getByText('If this address is eligible',{exact:false}),label).toHaveCount(0);
    }
    await view.goto(base+'/en/register');await view.waitForLoadState('networkidle');await fill(view,'edge@example.test','a'.repeat(12));
    await view.getByRole('button',{name:'Request organisation access',exact:true}).click();
    await expect(view.getByText('confirm your email',{exact:false}).first()).toBeVisible();
    await view.goto(base+'/en/login');await view.waitForLoadState('networkidle');await unlock();await view.getByLabel('Work email',{exact:true}).fill('owner1@example.test');await view.getByLabel('Password',{exact:true}).fill('a'.repeat(129));
    await view.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(view.locator('main').getByRole('alert'),'a 129-character password at sign-in').toBeVisible();await expect(view).toHaveURL(/\/en\/login$/);
    for(const email of ['not-an-email','a@b','@example.test','a b@example.test','x'.repeat(250)+'@example.test','']) {
      await view.goto(base+'/en/login');await view.waitForLoadState('networkidle');
      await view.getByLabel('Work email',{exact:true}).fill(email);await view.getByLabel('Password',{exact:true}).fill('Fixture-only-passphrase-123');
      // The browser's own checks are switched off so that the server's are what answers.
      await view.getByRole('form',{name:'Sign in'}).evaluate(form=>{form.querySelectorAll('input').forEach(input=>{input.removeAttribute('maxlength');input.removeAttribute('required');if(input.type==='email') input.type='text';});});
      await view.getByRole('button',{name:'Sign in',exact:true}).click();
      await expect(view.locator('main').getByRole('alert'),`an email address like “${email.slice(0,20)}”`).toBeVisible();
      await expect(view).toHaveURL(/\/en\/login$/);
    }
    await context.close();
  });
  await check('a wrong password and an unknown email give the same answer',async()=>{
    const {context,view}=await newContext();
    const attempt=async(email,password)=>{
      await view.goto(base+'/en/login');await view.waitForLoadState('networkidle');await view.getByLabel('Work email',{exact:true}).fill(email);await view.getByLabel('Password',{exact:true}).fill(password);
      await view.getByRole('button',{name:'Sign in',exact:true}).click();const alert=view.locator('main').getByRole('alert');await expect(alert).toBeVisible();return (await alert.textContent()).trim();
    };
    const wrongPassword=await attempt('owner1@example.test','not-the-right-password');
    const unknownEmail=await attempt('nobody-here@example.test','not-the-right-password');
    assert.equal(wrongPassword,unknownEmail);assert.ok(!/owner1|nobody|exist|no account|not found/i.test(wrongPassword));
    await context.close();
  });
  }
  if(only('accounts')) {
  // Deleting an account (docs/briefs/2026-10-13-delete-account.md). Last, because it removes owner1 for good.
  const day30=new Date(Date.now()+30*86400000).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Berlin'});
  const fixtureUrl=link=>link.replace('https://vianorae-fixture.supabase.co','http://127.0.0.1:3012');
  const unzip=bytes=>{const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const end=bytes.length-22;assert.equal(view.getUint32(end,true),0x06054b50);
    const files={};let at=view.getUint32(end+16,true);
    for(let i=0;i<view.getUint16(end+10,true);i++){const size=view.getUint32(at+20,true);const nameLength=view.getUint16(at+28,true);const local=view.getUint32(at+42,true);
      const name=Buffer.from(bytes.slice(at+46,at+46+nameLength)).toString();const start=local+30+view.getUint16(local+26,true);files[name]=Buffer.from(bytes.slice(start,start+size));at+=46+nameLength;}
    return files;};
  // Password reset (docs/briefs/2026-10-18-password-reset.md): the fixture's Auth service issues one-time recovery tokens like Supabase's.
  const axeClean=async(target,label)=>{const result=await new AxeBuilder({page:target}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(result.violations.map(v=>v.id),[],label);};
  // The eye sits in the middle of its box: every password box on the page, the box and the button share one centre line.
  const eyeCentred=async(target,label)=>{const offsets=await target.locator('.password-box').evaluateAll(boxes=>boxes.map(box=>{const a=box.querySelector('input').getBoundingClientRect(),b=box.querySelector('button').getBoundingClientRect(),c=box.querySelector('svg').getBoundingClientRect();return Math.max(Math.abs(a.top+a.height/2-b.top-b.height/2),Math.abs(a.top+a.height/2-c.top-c.height/2));}));assert.ok(offsets.length>0,label+': no password box');assert.ok(offsets.every(o=>o<=1),label+': the eye is off centre by '+offsets.join(', ')+'px');};
  const resetLink=async(email,locale='en')=>{const {token_hash:token}=await fixture(`last-recovery?email=${email}`);assert.ok(token,`a recovery token for ${email}`);return `${base}/${locale}/login/reset/continue?token_hash=${token}`;};
  // Warnings on forms (docs/briefs/2026-10-18-form-warnings.md): the screen still jumps to the first field that needs attention, every such field says what to do,
  // the warning goes when the field is right, and nothing is checked while typing or left showing after Back.
  await check('registration and sign-in mark each field that needs filling or checking, in words, and the warning goes away when the field is right',async()=>{
    const {context,view}=await newContext();
    await view.goto(`${base}/en/register`);await view.waitForLoadState('networkidle');
    const send=()=>view.getByRole('button',{name:'Request organisation access',exact:true}).click();
    // Nothing is checked while typing or leaving a field.
    await view.getByLabel('Organisation name',{exact:true}).focus();await view.getByLabel('Responsible representative',{exact:true}).focus();
    await expect(view.locator('main').getByText('Fill in “',{exact:false})).toHaveCount(0);
    await send();
    const organisation=view.getByLabel('Organisation name',{exact:true});
    await expect(organisation).toBeFocused();
    await expect(organisation).toHaveAttribute('aria-invalid','true');
    await expect(organisation).toHaveAccessibleDescription('Fill in “Organisation name”.');
    for(const label of ['Responsible representative','Your role in the organisation','Official website (https://)','Country code (two letters)','How can your authority to represent the organisation be confirmed?','Work email','Password']) {
      await expect(view.getByLabel(label,{exact:true}),label).toHaveAttribute('aria-invalid','true');
      await expect(view.getByLabel(label,{exact:true}),label).toHaveAccessibleDescription(new RegExp(`Fill in “${label.replace(/[()?]/g,'\\$&')}”\\.$`));
    }
    await expect(view.getByRole('checkbox').first()).toHaveAccessibleDescription('Tick this box to continue.');
    await axeClean(view,'the registration form with every warning showing');
    // Fixing one field removes its warning at once; the others stay.
    await organisation.fill('Verified fixture museum');
    await expect(organisation).not.toHaveAttribute('aria-invalid','true');
    await expect(view.getByText('Fill in “Organisation name”.',{exact:true})).toHaveCount(0);
    await expect(view.getByLabel('Responsible representative',{exact:true})).toHaveAttribute('aria-invalid','true');
    // A wrong format says what the format is, and a field still wrong keeps its warning while it is being fixed.
    await view.getByLabel('Official website (https://)',{exact:true}).fill('museum.example');await view.getByLabel('Work email',{exact:true}).fill('not-an-email');await view.getByLabel('Password',{exact:true}).fill('short');
    await send();
    await expect(view.getByLabel('Official website (https://)',{exact:true})).toHaveAccessibleDescription('Enter the website address starting with https://.');
    await expect(view.getByLabel('Work email',{exact:true})).toHaveAccessibleDescription('Enter an email address like name@example.org.');
    await expect(view.getByLabel('Password',{exact:true})).toHaveAccessibleDescription(/Use at least 12 characters\.$/);
    await view.getByLabel('Password',{exact:true}).fill('a-long-enough-passphrase');
    await expect(view.getByLabel('Password',{exact:true})).not.toHaveAttribute('aria-invalid','true');
    // The eye button shows what was typed and hides it again; it is a pressed/not-pressed button with one name.
    const eye=view.getByRole('button',{name:'Show password',exact:true});
    await expect(view.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
    await expect(eye).toHaveAttribute('aria-pressed','false');
    await eyeCentred(view,'registration');
    await eye.click();
    await expect(view.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
    await expect(view.getByLabel('Password',{exact:true})).toHaveValue('a-long-enough-passphrase');
    await expect(eye).toHaveAttribute('aria-pressed','true');
    await eye.click();
    await expect(view.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
    // Back and Forward leave no warning behind, and what was typed is still there.
    await view.goto(`${base}/en/login`);await view.goBack();
    await expect(view.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(view.getByLabel('Organisation name',{exact:true})).toHaveValue('Verified fixture museum');
    // Sign-in: the same.
    await view.goto(`${base}/en/login`);await view.waitForLoadState('networkidle');
    await view.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(view.getByLabel('Work email',{exact:true})).toBeFocused();
    await expect(view.getByLabel('Work email',{exact:true})).toHaveAccessibleDescription('Fill in “Work email”.');
    await expect(view.getByLabel('Password',{exact:true})).toHaveAccessibleDescription('Fill in “Password”.');
    await view.getByLabel('Work email',{exact:true}).fill('owner1@example.test');
    await expect(view.getByText('Fill in “Work email”.',{exact:true})).toHaveCount(0);
    // A refusal from the server keeps what was typed.
    await view.getByLabel('Password',{exact:true}).fill('not-the-right-password');
    await view.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(view.locator('main').getByRole('alert')).toBeVisible();
    await expect(view.getByLabel('Work email',{exact:true})).toHaveValue('owner1@example.test');
    // Romanian and German read in their own language.
    for(const [locale,button,missing] of [['ro','Autentificare','Completează „Email profesional”.'],['de','Anmelden','Füllen Sie „Geschäftliche E-Mail“ aus.']]) {
      await view.goto(`${base}/${locale}/login`);await view.waitForLoadState('networkidle');
      await view.getByRole('button',{name:button,exact:true}).click();
      await expect(view.locator('main').getByText(missing,{exact:true}),locale).toBeVisible();
      await axeClean(view,`the sign-in warnings in ${locale}`);
    }
    await context.close();
  });
  await check('the password forms mark each field that needs filling or checking, in words, in every language',async()=>{
    const {context,view}=await newContext();
    await view.goto(`${base}/en/login/reset`);await view.waitForLoadState('networkidle');
    const email=view.getByLabel('Email address',{exact:true});
    await view.getByRole('button',{name:'Send the link',exact:true}).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('aria-invalid','true');
    await expect(email).toHaveAccessibleDescription('Fill in “Email address”.');
    await email.fill('not-an-email');await view.getByRole('button',{name:'Send the link',exact:true}).click();
    await expect(email).toHaveAccessibleDescription('Enter an email address like name@example.org.');
    await axeClean(view,'the reset request with a warning');
    await email.fill('nobody@example.test');
    await expect(email).not.toHaveAttribute('aria-invalid','true');
    for(const [locale,warning] of [['ro',/^Completează „.+”\.$/],['de',/^Füllen Sie „.+“ aus\.$/]]) {
      await view.goto(`${base}/${locale}/login/reset`);await view.waitForLoadState('networkidle');
      await view.locator('form button[type=submit]').click();
      await expect(view.locator('main .field-warning'),locale).toHaveText(warning);
    }
    // The change-password form on the account page.
    await login(view,4);await view.goto(`${base}/en/account`);await view.waitForLoadState('networkidle');
    const box=view.getByRole('region',{name:'Change your password'});
    await eyeCentred(box,'change password');
    await box.getByRole('button',{name:'Save new password',exact:true}).click();
    await expect(box.getByLabel('Current password',{exact:true})).toBeFocused();
    await expect(box.getByLabel('Current password',{exact:true})).toHaveAccessibleDescription('Fill in “Current password”.');
    await expect(box.getByLabel('New password',{exact:true})).toHaveAccessibleDescription(/Fill in “New password”\.$/);
    await expect(box.getByLabel('Repeat the new password',{exact:true})).toHaveAccessibleDescription('Fill in “Repeat the new password”.');
    await box.getByLabel('New password',{exact:true}).fill('short');await box.getByRole('button',{name:'Save new password',exact:true}).click();
    await expect(box.getByLabel('New password',{exact:true})).toHaveAccessibleDescription(/Use at least 12 characters\.$/);
    await axeClean(view,'the change-password form with warnings');
    await box.getByLabel('Current password',{exact:true}).fill('typed');
    await expect(box.getByText('Fill in “Current password”.',{exact:true})).toHaveCount(0);
    await context.close();
  });
  await check('a forgotten password is reset through an emailed link: the answer never says who has an account, the link is used by its button, and the old password stops working',async()=>{
    const {context,view}=await newContext();
    await view.goto(`${base}/en/login`);
    await view.getByRole('link',{name:'Forgot your password?',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/login\/reset$/);
    await expect(view.getByRole('heading',{name:'Reset your password',level:1})).toBeVisible();
    await axeClean(view,'the request page');
    const ask=async email=>{
      await view.goto(`${base}/en/login/reset`);
      await view.getByLabel('Email address',{exact:true}).fill(email);
      await view.getByRole('button',{name:'Send the link',exact:true}).click();
      const note=view.getByRole('status').filter({hasText:'If there is an account for that address'});
      await expect(note).toBeVisible();return note.textContent();
    };
    const known=await ask('owner4@example.test');const unknown=await ask('nobody@example.test');
    assert.equal(known,unknown,'the same answer for an address with an account and one without');
    assert.equal((await fixture('last-recovery?email=nobody@example.test')).token_hash,null,'nothing is sent to an unknown address');
    await view.goto(`${base}/en/login/reset`);await view.getByLabel('Email address',{exact:true}).fill('limited@example.test');
    await view.getByRole('button',{name:'Send the link',exact:true}).click();await expect(view.getByRole('alert').filter({hasText:'Too many requests.'})).toBeVisible();
    // Opening the link doesn't use it up (a mail program may open it to check it): only the button does.
    const link=await resetLink('owner4@example.test');
    assert.equal((await context.request.get(link)).status(),200);assert.equal((await context.request.get(link)).status(),200);
    for(const locale of ['en','ro','de']) {await view.goto(link.replace('/en/',`/${locale}/`));await axeClean(view,`the link page in ${locale}`);}
    await view.goto(link);
    await expect(view.getByRole('heading',{name:'Choose a new password',level:1})).toBeVisible();
    // Without a reset link the new-password page isn't there: a signed-out visit goes to sign-in.
    await view.goto(`${base}/en/account/password`);await expect(view).toHaveURL(/\/en\/login$/);
    await view.goto(link);await view.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/account\/password$/);
    await expect(view.getByRole('heading',{name:'Choose a new password',level:1})).toBeVisible();
    await axeClean(view,'the new-password page');
    // The server checks what the form checks.
    await view.locator('form').first().evaluate(form=>{form.querySelectorAll('input').forEach(input=>{input.removeAttribute('required');input.removeAttribute('minlength');});});
    const submit=async(first,second)=>{await view.getByLabel('New password',{exact:true}).fill(first);await view.getByLabel('Repeat the new password',{exact:true}).fill(second);await view.getByRole('button',{name:'Save new password',exact:true}).click();};
    await submit('short','short');await expect(view.getByRole('alert').filter({hasText:'The password needs at least 12 characters.'})).toBeVisible();
    await submit('Reset-passphrase-4821','Reset-passphrase-4822');await expect(view.getByRole('alert').filter({hasText:'The two passwords are not the same.'})).toBeVisible();
    await submit('Fixture-only-passphrase-123','Fixture-only-passphrase-123');await expect(view.getByRole('alert').filter({hasText:'Choose a password you did not use before'})).toBeVisible();
    await submit('Reset-passphrase-4821','Reset-passphrase-4821');
    await expect(view).toHaveURL(/\/en\/login\?password=changed$/);
    await expect(view.getByRole('status').filter({hasText:'Your password was changed. Sign in with the new password.'})).toBeVisible();
    // The old password no longer works, the new one does, and the used link is refused.
    await signInWithPasswordExpectingRefusal(view,4);
    await view.goto(`${base}/en/login`);await view.getByLabel('Work email',{exact:true}).fill('owner4@example.test');
    await view.getByLabel('Password',{exact:true}).fill('Reset-passphrase-4821');await view.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/account$/);
    // Signed in normally, the new-password page is not available (it needs the reset link's cookie): the account page is.
    await view.goto(`${base}/en/account/password`);await expect(view).toHaveURL(/\/en\/account$/);await expect(view.getByRole('heading',{name:'Choose a new password'})).toHaveCount(0);
    await view.goto(link);await view.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/login\/reset\?link=expired$/);
    await expect(view.getByRole('alert').filter({hasText:'That link has expired or was already used.'})).toBeVisible();
    await view.goto(`${base}/en/login/reset/continue?token_hash=../../etc/passwd`);await expect(view.getByRole('heading',{name:'Choose a new password'})).toHaveCount(0);
    await fixture('reset-passwords',{});await context.close();
  });
  await check('a reset needs the two-factor code for an account that has it, and the reset pages read in Romanian and German',async()=>{
    const {context,view}=await newContext();
    const link=await (async()=>{await view.goto(`${base}/en/login/reset`);await view.getByLabel('Email address',{exact:true}).fill('owner3@example.test');await view.getByRole('button',{name:'Send the link',exact:true}).click();await expect(view.getByRole('status')).toBeVisible();return resetLink('owner3@example.test');})();
    await view.goto(link);await view.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/account\/password$/);
    await expect(view.getByText('This account uses two-factor sign-in.',{exact:false})).toBeVisible();
    await axeClean(view,'the new-password page with a code field');
    await view.locator('form').first().evaluate(form=>{form.querySelectorAll('input').forEach(input=>{input.removeAttribute('required');input.removeAttribute('minlength');});});
    const submit=async(code)=>{await view.getByLabel('6-digit code from the app',{exact:true}).fill(code);await view.getByLabel('New password',{exact:true}).fill('Admin-reset-passphrase-77');await view.getByLabel('Repeat the new password',{exact:true}).fill('Admin-reset-passphrase-77');await view.getByRole('button',{name:'Save new password',exact:true}).click();};
    await submit('');await expect(view.getByRole('alert').filter({hasText:'That code is not right.'})).toBeVisible();
    await submit('000000');await expect(view.getByRole('alert').filter({hasText:'That code is not right.'})).toBeVisible();
    await submit(totp(authenticators[3]));
    await expect(view).toHaveURL(/\/en\/login\?password=changed$/);
    await fixture('reset-passwords',{});
    // The other languages: the pages read, and pass the checks, in Romanian and German.
    for(const [locale,forgot,title,sent] of [['ro','Ai uitat parola?','Resetează parola','Dacă există un cont pentru această adresă'],['de','Passwort vergessen?','Passwort zurücksetzen','Falls es für diese Adresse ein Konto gibt']]) {
      await view.goto(`${base}/${locale}/login`);await view.getByRole('link',{name:forgot,exact:true}).click();
      await expect(view.getByRole('heading',{name:title,level:1})).toBeVisible();await axeClean(view,`the request page in ${locale}`);
      await view.getByRole('textbox').fill('nobody@example.test');await view.locator('form button[type=submit]').click();
      await expect(view.getByRole('status').filter({hasText:sent})).toBeVisible();
    }
    await context.close();
  });
  await check('a signed-in person changes their password on the account page: the current password is checked, they stay signed in, other devices are signed out, and an account with two-factor gives its code',async()=>{
    const {context,view}=await newContext();const other=await newContext();
    await login(view,4);await login(other.view,4);
    await view.goto(`${base}/en/account`);
    const box=view.getByRole('region',{name:'Change your password'});
    await expect(box.getByRole('heading',{name:'Change your password',level:2})).toBeVisible();
    await view.waitForLoadState('networkidle');await axeClean(view,'the account page with the change-password form');
    await box.locator('form').evaluate(form=>{form.querySelectorAll('input').forEach(input=>{input.removeAttribute('required');input.removeAttribute('minlength');});});
    const submit=async(current,first,second)=>{await box.getByLabel('Current password',{exact:true}).fill(current);await box.getByLabel('New password',{exact:true}).fill(first);await box.getByLabel('Repeat the new password',{exact:true}).fill(second);await box.getByRole('button',{name:'Save new password',exact:true}).click();};
    await submit('Fixture-only-passphrase-123','short','short');await expect(box.getByRole('alert').filter({hasText:'The password needs at least 12 characters.'})).toBeVisible();
    await submit('Fixture-only-passphrase-123','Changed-passphrase-5521','Changed-passphrase-5522');await expect(box.getByRole('alert').filter({hasText:'The two passwords are not the same.'})).toBeVisible();
    await submit('not-my-password','Changed-passphrase-5521','Changed-passphrase-5521');await expect(box.getByRole('alert').filter({hasText:'That is not your current password.'})).toBeVisible();
    await submit('Fixture-only-passphrase-123','Fixture-only-passphrase-123','Fixture-only-passphrase-123');await expect(box.getByRole('alert').filter({hasText:'Choose a password you did not use before'})).toBeVisible();
    await submit('Fixture-only-passphrase-123','Changed-passphrase-5521','Changed-passphrase-5521');
    await expect(box.getByRole('status').filter({hasText:'Your password was changed. Every other device was signed out.'})).toBeVisible();
    // Still signed in here; the other device is signed out.
    await view.goto(`${base}/en/account`);await expect(view).toHaveURL(/\/en\/account$/);
    await other.view.goto(`${base}/en/account`);await expect(other.view).toHaveURL(/\/en\/login$/);
    // The old password is refused and the new one works.
    await view.context().clearCookies({name:/^sb-/});await signInWithPasswordExpectingRefusal(view,4);
    await view.goto(`${base}/en/login`);await view.getByLabel('Work email',{exact:true}).fill('owner4@example.test');
    await view.getByLabel('Password',{exact:true}).fill('Changed-passphrase-5521');await view.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(view).toHaveURL(/\/en\/account$/);
    await fixture('reset-passwords',{});await other.context.close();await context.close();
    // Two-factor: the code is asked for, a missing or wrong one changes nothing.
    const admin=await newContext();await login(admin.view,3);await admin.view.goto(`${base}/en/account`);
    const adminBox=admin.view.getByRole('region',{name:'Change your password'});
    await adminBox.locator('form').evaluate(form=>{form.querySelectorAll('input').forEach(input=>{input.removeAttribute('required');input.removeAttribute('minlength');});});
    const adminSubmit=async code=>{await adminBox.getByLabel('Current password',{exact:true}).fill('Fixture-only-passphrase-123');await adminBox.getByLabel('6-digit code from the app',{exact:true}).fill(code);await adminBox.getByLabel('New password',{exact:true}).fill('Admin-changed-passphrase-88');await adminBox.getByLabel('Repeat the new password',{exact:true}).fill('Admin-changed-passphrase-88');await adminBox.getByRole('button',{name:'Save new password',exact:true}).click();};
    await adminSubmit('');await expect(adminBox.getByRole('alert').filter({hasText:'That code is not right.'})).toBeVisible();
    await adminSubmit('000000');await expect(adminBox.getByRole('alert').filter({hasText:'That code is not right.'})).toBeVisible();
    await adminSubmit(totp(authenticators[3]));await expect(adminBox.getByRole('status').filter({hasText:'Your password was changed.'})).toBeVisible();
    await fixture('reset-passwords',{});
    for(const [locale,title] of [['ro','Schimbă parola'],['de','Passwort ändern']]) {await admin.view.goto(`${base}/${locale}/account`);await expect(admin.view.getByRole('heading',{name:title,level:2})).toBeVisible();await axeClean(admin.view,`the change-password form in ${locale}`);}
    await admin.context.close();
  });
  await check('a person deletes their own account: the date is named first, a wrong password changes nothing, then it is locked and their data is ready',async()=>{
    const {context,view}=await newContext();await login(view,1);
    await view.goto(`${base}/en/account`);await expect(view.getByRole('heading',{name:'Delete my account',level:2})).toBeVisible();
    await view.getByRole('link',{name:'Delete my account…',exact:true}).click();await expect(view).toHaveURL(/\/en\/account\/delete$/);
    await expect(view.getByRole('heading',{name:'Delete my account',level:1})).toBeVisible();
    await expect(view.getByText(`deleted completely: your account`,{exact:false})).toContainText(day30);
    await expect(view.getByText('“Fixture museum 1” has no other owner',{exact:false})).toBeVisible();
    const audit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],'delete page');
    await view.waitForLoadState('networkidle');
    await view.getByLabel('Your password',{exact:true}).fill('not-the-right-password');
    await view.getByRole('checkbox',{name:`I understand that my account will be deleted completely on ${day30}.`}).check();
    await view.getByRole('button',{name:'Delete my account',exact:true}).click();
    await expect(view.locator('main').getByRole('alert')).toContainText('That password is not right. Nothing was deleted.');
    await view.goto(`${base}/en/workspace`);await expect(view).toHaveURL(/\/en\/workspace$/);
    await view.goto(`${base}/en/account/delete`);await view.waitForLoadState('networkidle');
    await view.getByLabel('Your password',{exact:true}).fill('Fixture-only-passphrase-123');
    await view.getByRole('checkbox',{name:`I understand that my account will be deleted completely on ${day30}.`}).check();
    await view.getByRole('button',{name:'Delete my account',exact:true}).click();
    await expect(view.getByRole('heading',{name:'Your account is locked',level:2})).toBeFocused({timeout:20000});
    await expect(view.getByText(`It will be deleted completely on ${day30}.`,{exact:true})).toBeVisible();
    const link=await view.getByRole('link',{name:'Download your data',exact:true}).getAttribute('href');
    const files=unzip(new Uint8Array(await (await fetch(fixtureUrl(link))).arrayBuffer()));
    assert.ok(files['README.txt'].toString().includes(day30),'the letter names the date');
    const data=JSON.parse(files['data.json'].toString());assert.equal(data.account.email,'owner1@example.test');
    assert.ok(data.memberships.some(m=>m.organisation==='Fixture museum 1'));assert.equal(data.organisations_you_own_alone[0].organisation,'Fixture museum 1');
    // Every photo the data lists is in the archive, as a file of its own.
    const listed=data.organisations_you_own_alone.flatMap(org=>org.places.flatMap(place=>place.photos.map(photo=>photo.file.split('/').at(-1))));
    for(const file of listed) assert.ok(Object.keys(files).some(name=>name.startsWith('photos/') && name.endsWith(file)),`photo ${file} is in the archive`);
    assert.ok(!JSON.stringify(data).includes('owner2@example.test'),'nothing about anyone else');
    // Anywhere they go now, they are told the account is locked, and can sign out.
    await view.goto(`${base}/en/workspace`);await expect(view).toHaveURL(/\/en\/account$/);
    await expect(view.getByRole('heading',{name:'Your account is locked',level:2})).toBeVisible();
    await view.getByRole('button',{name:'Sign out',exact:true}).click();await expect(view).toHaveURL(/\/en\/login$/);
    await context.close();
    const again=await newContext();await signInWithPasswordExpectingRefusal(again.view,1);
    await expect(again.view.locator('main').getByRole('alert')).toContainText('This account is being deleted.');
    await again.context.close();
  });
  await check('an administrator sees the deletion and restores it within the 30 days; the person signs in again',async()=>{
    const {context,view}=await newContext();await login(view,3);
    await view.goto(`${base}/en/admin/deletions`);await expect(view.getByRole('heading',{name:'Account deletions',level:1})).toBeVisible();
    const entry=view.getByRole('listitem').filter({has:view.getByRole('heading',{name:'owner1@example.test',level:3})});
    await expect(entry.getByText('Started by the person',{exact:false})).toBeVisible();
    await expect(entry.getByText(`Can be erased from ${day30}`,{exact:true})).toBeVisible();
    await expect(view.getByRole('heading',{name:'Fixture museum 1',level:3})).toBeVisible();
    const audit=await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],'admin deletions');
    await entry.getByRole('button',{name:'Restore',exact:true}).click();
    const dialog=view.getByRole('dialog',{name:'Restore this account?'});await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
    await dialog.getByRole('button',{name:'Restore',exact:true}).click();
    await expect(view.getByText('No deletion in progress.',{exact:true})).toBeVisible();
    await context.close();
    const person=await newContext();await login(person.view,1);await expect(person.view).toHaveURL(/\/en\/workspace$/);await person.context.close();
  });
  await check('an administrator starts a deletion for someone who wrote in, downloads their data, and erases account and organisation after the 30 days',async()=>{
    // This organisation still pays through Stripe: an active plan, set here so this group does not rely on the billing checks.
    assert.equal(await stripeEvent('active'),200);
    const {context,view}=await newContext();await login(view,3);
    await view.goto(`${base}/en/admin/deletions`);await view.waitForLoadState('networkidle');
    await view.getByLabel('Email of the account',{exact:true}).fill('owner1@example.test');
    await view.getByRole('button',{name:'Start deletion',exact:true}).click();
    await view.getByRole('dialog',{name:'Start deleting this account?'}).getByRole('button',{name:'Start deletion',exact:true}).click();
    await expect(view.getByRole('status').filter({hasText:'Deletion started.'})).toBeVisible();
    await view.reload();
    const entry=view.getByRole('listitem').filter({has:view.getByRole('heading',{name:'owner1@example.test',level:3})});
    await expect(entry.getByText('Started by an administrator',{exact:false})).toBeVisible();
    const download=await context.request.get(base+await entry.getByRole('link',{name:'Download their data',exact:true}).getAttribute('href'));
    assert.equal(download.status(),200);assert.equal(JSON.parse(unzip(new Uint8Array(await download.body()))['data.json'].toString()).account.email,'owner1@example.test');
    const outsider=await newContext();await login(outsider.view,2);
    assert.equal((await outsider.context.request.get(base+await entry.getByRole('link',{name:'Download their data',exact:true}).getAttribute('href'),{maxRedirects:0})).status(),403,'nobody else can download it');
    await outsider.context.close();
    await fetch('http://127.0.0.1:3012/__fixture/deletions-due',{method:'POST'});await view.reload();
    await expect(entry.getByText('Due: can be erased now',{exact:true})).toBeVisible();
    // Nothing is erased until the subscription is cancelled on Stripe.
    await expect(entry.getByRole('button',{name:'Erase now',exact:true})).toHaveAttribute('aria-disabled','true');
    await expect(entry.getByRole('button',{name:'Erase now',exact:true})).toHaveAccessibleDescription(/A Stripe subscription is still running/);
    await entry.getByRole('button',{name:'Erase now',exact:true}).hover();
    await expect(entry.getByRole('tooltip')).toBeVisible();
    await expect(entry.getByRole('tooltip')).toContainText('Cancel it in Stripe first');
    await view.mouse.move(0,0);
    await expect(entry.getByRole('tooltip')).toBeHidden();
    const stillPaying=view.getByRole('listitem').filter({has:view.getByRole('heading',{name:'Fixture museum 1',level:3})});
    await stillPaying.getByRole('button',{name:'Erase organisation',exact:true}).focus();
    await expect(stillPaying.getByRole('tooltip')).toBeVisible();
    await expect(stillPaying.getByRole('button',{name:'Erase organisation',exact:true})).toHaveAttribute('aria-disabled','true');
    assert.equal(await stripeEvent('canceled'),200);await view.reload();
    await expect(entry.getByText('A Stripe subscription is still running',{exact:false})).toHaveCount(0);
    await expect(entry.getByRole('button',{name:'Erase now',exact:true})).not.toHaveAttribute('aria-disabled','true');
    await entry.getByRole('button',{name:'Erase now',exact:true}).click();
    await view.getByRole('dialog',{name:'Erase this account for good?'}).getByRole('button',{name:'Erase now',exact:true}).click();
    await expect(view.getByText('No deletion in progress.',{exact:true})).toBeVisible();
    const hold=view.getByRole('listitem').filter({has:view.getByRole('heading',{name:'Fixture museum 1',level:3})});
    await hold.getByRole('button',{name:'Erase organisation',exact:true}).click();
    await view.getByRole('dialog',{name:'Erase this organisation for good?'}).getByRole('button',{name:'Erase organisation',exact:true}).click();
    await expect(view.getByRole('listitem').filter({hasText:'Erased on'})).toHaveCount(1);
    await context.close();
    const gone=await newContext();await signInWithPasswordExpectingRefusal(gone.view,1);
    await expect(gone.view.locator('main').getByRole('alert')).not.toContainText('being deleted');await gone.context.close();
  });
  }
  console.log(`${checks} online workspace checks passed (real migrations; simulated Auth/Storage HTTP).`);
} finally {
  if(browser) await browser.close();for(const child of children) if(child.exitCode===null) child.kill('SIGTERM');
}
