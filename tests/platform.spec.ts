import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const paths=['','for-organisations','methodology','example-guide','explore','contact','login','register','account','privacy','terms','accessibility','dashboard','dashboard/builder','dashboard/preview','dashboard/team','dashboard/settings','dashboard/share','dashboard/locations'];
for(const locale of ['en','ro','de']) {
 test(`${locale}: routes and document language`,async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));for(const path of paths){const response=await page.goto(`/${locale}/${path}`);expect(response?.status(),path).toBe(200);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.locator('main h1')).toBeVisible();}expect(errors).toEqual([]);});
}
for(const path of ['/en','/en/example-guide','/en/contact','/en/dashboard/builder','/ro','/de']) {
 test(`WCAG A/AA checks ${path}`,async({page})=>{await page.goto(path);const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();expect(results.violations).toEqual([]);});
}
test('guide navigation, skip and completion work by keyboard',async({page})=>{await page.goto('/en/example-guide');await expect(page.getByRole('heading',{name:'The main entrance',exact:true})).toBeVisible();const next=page.getByRole('button',{name:'Next step',exact:true});await next.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Reception & the foyer',exact:true})).toBeFocused();await page.getByRole('button',{name:'Guide options',exact:true}).click();await page.getByRole('button',{name:'The quiet room',exact:false}).click();await expect(page.getByRole('heading',{name:'The quiet room',exact:true})).toBeVisible();await page.getByRole('button',{name:'Finish the guide'}).click();await expect(page.getByRole('heading',{name:'You have explored the guide.'})).toBeFocused();await page.getByRole('button',{name:'Start again'}).click();await expect(page.getByRole('heading',{name:'The main entrance',exact:true})).toBeVisible();});
test('local draft persists into preview and public example remains fictional',async({page})=>{await page.goto('/en/dashboard/builder');await page.getByLabel('Zone title',{exact:true}).first().fill('My entrance draft');await page.getByRole('button',{name:'Save draft'}).click();await expect(page.getByRole('status')).toHaveText('Draft saved in this browser.');await page.reload();await expect(page.getByLabel('Zone title',{exact:true}).first()).toHaveValue('My entrance draft');await page.getByRole('link',{name:'Preview your draft',exact:true}).last().click();await expect(page.getByRole('heading',{name:'My entrance draft'})).toBeVisible();await page.goto('/en/example-guide');await expect(page.getByRole('heading',{name:'The main entrance',exact:true})).toBeVisible();await page.goto('/ro/dashboard/builder');await expect(page.getByLabel('Titlul zonei',{exact:true}).first()).toHaveValue('Intrarea principală');});
test('corrupt local draft falls back safely',async({page})=>{await page.goto('/en/dashboard/builder');await page.evaluate(()=>localStorage.setItem('vianorae:demo-draft:v1:en','{"schemaVersion":1,"zones":null}'));await page.reload();await expect(page.getByLabel('Zone title',{exact:true}).first()).toHaveValue('The main entrance');});
test('catalog filters distinguish museum from unavailable categories',async({page})=>{await page.goto('/en/explore');await page.getByLabel('Category',{exact:true}).selectOption('theatre');await expect(page.getByRole('status')).toHaveText('No guide matches these filters.');await page.getByLabel('Category',{exact:true}).selectOption('museum');await expect(page.getByRole('link',{name:'Open guide',exact:true})).toBeVisible();});
test('QR API and stable redirects',async({request})=>{const svg=await request.get('/api/qr/willow-museum?locale=ro&download=1');expect(svg.status()).toBe(200);expect(svg.headers()['content-type']).toContain('image/svg+xml');expect(svg.headers()['content-disposition']).toContain('attachment');expect(await svg.text()).toContain('<svg');const redirect=await request.get('/q/willow-museum?locale=de',{maxRedirects:0});expect(redirect.status()).toBe(307);expect(redirect.headers().location).toContain('/de/places/willow-museum/guide');expect((await request.get('/q/unknown')).status()).toBe(404);expect((await request.get('/api/qr/unknown')).status()).toBe(404);const unsafe=await request.get('/q/willow-museum?locale=https://evil.example',{maxRedirects:0});expect(unsafe.headers().location).toContain('/en/places/');});
test('language switch preserves the current route',async({page})=>{await page.goto('/en/methodology');await page.locator('.language-switch summary').click();await page.getByRole('link',{name:'Română',exact:true}).click();await expect(page).toHaveURL(/\/ro\/methodology$/);await expect(page.locator('html')).toHaveAttribute('lang','ro');});
test('contact prepares an enquiry without sending it',async({page})=>{await page.goto('/en/contact');let posted=false;page.on('request',r=>{if(r.method()==='POST')posted=true;});await page.getByLabel('Your name').fill('Demo person');await page.getByLabel('Email').fill('demo@example.invalid');await page.getByLabel('Your message').fill('I would like to discuss the pilot.');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.enquiry-output')).toContainText('I would like to discuss the pilot.');expect(posted).toBe(false);});
test('reading preferences persist and contrast themes pass automated checks',async({page})=>{await page.goto('/en');await page.locator('.floating-reading').click();await page.getByLabel('Text size',{exact:true}).selectOption('larger');await page.getByLabel('Appearance',{exact:true}).selectOption('dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('html')).toHaveAttribute('data-text-size','larger');let result=await new AxeBuilder({page}).withTags(['wcag2aa']).analyze();expect(result.violations).toEqual([]);await page.locator('.floating-reading').click();await page.getByLabel('Appearance',{exact:true}).selectOption('contrast');result=await new AxeBuilder({page}).withTags(['wcag2aa']).analyze();expect(result.violations).toEqual([]);});
test('mobile reflow and menu',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/en');await page.getByRole('button',{name:'Open menu'}).click();await expect(page.getByRole('link',{name:'How it works',exact:true})).toBeVisible();await page.getByRole('link',{name:'How it works',exact:true}).click();await expect(page).toHaveURL(/\/en#how-it-works$/);await expect(page.locator('#how-it-works')).toBeInViewport();for(const path of ['/en','/en/example-guide','/en/dashboard/builder']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBe(true);}await page.goto('/en');await page.screenshot({path:'docs/verification/screenshots/mobile-preview.png',fullPage:true});});
test('320px reflow with 200% text and extra spacing',async({page})=>{await page.setViewportSize({width:320,height:800});for(const path of ['/en','/de','/en/example-guide','/en/dashboard/builder','/en/register','/de/register']){await page.goto(path);await page.evaluate(()=>{document.documentElement.style.fontSize='32px';document.documentElement.dataset.spacing='true';});const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth,elements:Array.from(document.querySelectorAll('*')).map(element=>({tag:element.tagName,classes:element.className,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right,scroll:element.scrollWidth,client:element.clientWidth,text:element.textContent?.slice(0,60)})).filter(element=>element.right>window.innerWidth+1||element.scroll>element.client+3)}));expect(overflow.width<=overflow.viewport,path+' '+JSON.stringify(overflow)).toBe(true);}});
test('desktop visual evidence',async({page})=>{await page.setViewportSize({width:1440,height:1000});await page.goto('/en');await page.screenshot({path:'docs/verification/screenshots/home-preview.png',fullPage:true});await page.goto('/en/example-guide');await page.screenshot({path:'docs/verification/screenshots/guide-preview.png',fullPage:true});await page.goto('/en/dashboard');await page.screenshot({path:'docs/verification/screenshots/workspace-preview.png',fullPage:true});});

test('photo upload persists with accessible metadata into the local preview only',async({page})=>{
 await page.goto('/en/dashboard/builder');
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#356050';ctx.fillRect(0,0,160,100);return canvas.toDataURL('image/png').split(',')[1];});
 const photo=page.locator('.photo-editor').first();
 await photo.getByLabel('Upload a zone photograph',{exact:true}).setInputFiles({name:'entrance.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(photo.getByText('Photograph added locally. Complete its details and save the draft.')).toBeVisible();
 await photo.getByLabel('Image description (alternative text)').fill('A wide entrance with glass doors and a bench.');
 await photo.getByLabel('Image rights / credit',{exact:true}).fill('Our organisation — own photograph');
 await photo.getByLabel('Date photographed',{exact:true}).fill(new Date().toISOString().slice(0,10));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/verification/screenshots/builder-photo-preview.png',fullPage:true});
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await expect(page.locator('.status-message').first()).toHaveText('Draft saved in this browser.');
 expect(await page.evaluate(()=>localStorage.getItem('vianorae:demo-draft:v1:en'))).not.toContain('base64');
 await page.reload();
 await expect(page.getByLabel('Image description (alternative text)')).toHaveValue('A wide entrance with glass doors and a bench.');
 await page.goto('/en/dashboard/preview');
 await expect(page.getByRole('img',{name:'A wide entrance with glass doors and a bench.',exact:true})).toHaveAttribute('src',/^blob:/);
 await page.goto('/en/example-guide');
 await expect(page.locator('.gg-photo img')).toHaveAttribute('src',/illustrations/);
 await page.goto('/ro/dashboard/builder');
 await expect(page.getByLabel('Descrierea imaginii (text alternativ)')).toHaveCount(0);
 await page.goto('/en/dashboard/builder');
 await page.getByRole('button',{name:'Remove photograph from draft'}).click();
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await page.goto('/en/dashboard/preview');
 await expect(page.locator('.guide-image')).toHaveAttribute('src',/illustrations/);
});

test('photo validation rejects SVG, oversized files and a forged raster MIME',async({page})=>{
 await page.goto('/en/dashboard/builder');const photo=page.locator('.photo-editor').first();const input=photo.getByLabel('Upload a zone photograph',{exact:true});
 for(const file of [{name:'script.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"></svg>')},{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')},{name:'huge.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(5*1024*1024+1)}]){
  await input.setInputFiles(file);await expect(photo.getByRole('alert')).toHaveText('Choose a valid JPEG, PNG or WebP image of no more than 5 MB.');
 }
 await expect(photo.getByLabel('Image description (alternative text)')).toHaveCount(0);
});

test('publication review requires a saved version and explicit acknowledgements; edits invalidate it',async({page})=>{
 await page.goto('/en/dashboard/builder');const form=page.getByRole('form',{name:'Review before publication'});
 await form.getByLabel('Responsible representative',{exact:true}).fill('Demo editor');await form.getByLabel('Content checked on',{exact:true}).fill(new Date().toISOString().slice(0,10));
 await form.getByRole('button').click();await expect(form.getByRole('status')).toHaveCount(0);
 for(const checkbox of await form.getByRole('checkbox').all())await checkbox.check();
 await form.getByRole('button').click();await expect(form.getByRole('status')).toHaveText('Save this version of the draft before recording the review.');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await form.getByRole('button').click();
 await expect(form.getByRole('status')).toContainText('It has not been published. Any edit requires a new review.');
 const review=await page.evaluate(()=>JSON.parse(localStorage.getItem('vianorae:demo-review:v1:en')!));expect(review.representative).toBe('Demo editor');expect(review.responsibilityVersion).toBe('2026-10-07-v1');expect(review.isDemo).toBe(true);
 await page.getByLabel('Zone title',{exact:true}).first().fill('Changed entrance');await expect(form.getByRole('status')).toHaveCount(0);await expect(form.getByRole('checkbox').first()).not.toBeChecked();
});

test('registration is discoverable and inactive without the separate auth configuration',async({page})=>{
 const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
 await page.goto('/ro');await page.locator('.site-footer').getByRole('link',{name:'Pentru instituții',exact:true}).click();await expect(page).toHaveURL(/\/ro\/for-organisations$/);
 await page.getByRole('main').getByRole('link',{name:'Solicită acces pentru organizație',exact:true}).click();await expect(page).toHaveURL(/\/ro\/register$/);
 await expect(page.getByRole('heading',{name:'Solicită acces pentru organizație'})).toBeVisible();
 await expect(page.getByText('Organizația ta își asumă întreaga responsabilitate',{exact:false})).toBeVisible();
 await expect(page.getByLabel('Tipul organizației')).toContainText('Hotel');
 await expect(page.getByLabel('Parolă',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Solicită acces pentru organizație'})).toBeDisabled();await page.screenshot({path:'docs/verification/screenshots/registration-preview.png',fullPage:true});
 await page.goto('/ro/login');await expect(page.getByRole('button',{name:'Autentificare',exact:true})).toBeDisabled();
 expect(posts).toEqual([]);
});

test('auth callbacks cannot redirect to an external next parameter without configuration',async({request})=>{
 const response=await request.get('/auth/callback?code=invalid&locale=https://evil.example&next=https://evil.example',{maxRedirects:0});expect(response.status()).toBe(307);expect(response.headers().location).toContain('/en/login?confirmation=failed');expect(response.headers().location).not.toContain('evil.example');
});

for(const path of ['/en/register','/ro/register','/de/register','/en/login']){
 test(`organisation WCAG A/AA checks ${path}`,async({page})=>{await page.goto(path);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);});
}


// How it works is a section of the home page; the menu jumps to it from anywhere and the old address redirects.
test('the menu jumps to the home sections from other pages and the old how-it-works address redirects',async({page,request})=>{
 await page.goto('/en/explore');
 const menu=page.locator('.site-header');
 for(const [name,id] of [['How it works','how-it-works'],['Who it’s for','who'],['Sources','sources']]) {
  await page.goto('/en/explore');
  await menu.getByRole('link',{name,exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/en#${id}$`));
  await expect(page.locator(`#${id}`)).toBeInViewport();
 }
 await expect(menu.getByRole('link',{name:'Explore',exact:true})).toBeVisible();
 await expect(menu.getByRole('link',{name:'Example guide',exact:true})).toBeVisible();
 await expect(menu.getByRole('link',{name:'For organisations',exact:true})).toBeVisible();
 await expect(menu.getByRole('link',{name:'Methodology',exact:true})).toHaveCount(0);
 const old=await request.get('/en/how-it-works',{maxRedirects:0});
 expect(old.status()).toBe(308);expect(old.headers().location).toBe('/en#how-it-works');
 await page.goto('/en');
 await page.locator('#sources').getByRole('link',{name:'How we decide'}).click();
 await expect(page).toHaveURL(/\/en\/methodology$/);
});

test('the header stays in view while the page scrolls, on desktop and on a phone',async({page})=>{
 for(const size of [{width:1280,height:800},{width:390,height:844}]) {
  await page.setViewportSize(size);await page.goto('/en');
  await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
  const header=page.locator('.site-header');
  await expect(header).toBeInViewport();
  expect((await header.boundingBox())!.y).toBe(0);
  await page.goto('/en#who');
  await expect(page.locator('#who h2')).toBeInViewport();
  expect((await page.locator('#who h2').boundingBox())!.y).toBeGreaterThan(60);
 }
});

// Returning organisations should not have to scroll to sign in, whatever the screen.
test('Sign in and Request access are on screen when the organisations page opens',async({page})=>{
 for(const size of [{width:1280,height:800},{width:390,height:844},{width:320,height:700}]) {
  await page.setViewportSize(size);
  for(const [locale,signIn,request] of [['en','Sign in','Request organisation access'],['ro','Autentificare','Solicită acces pentru organizație'],['de','Anmelden','Zugang für eine Organisation beantragen']]) {
   await page.goto(`/${locale}/for-organisations`);
   await expect(page.getByRole('main').getByRole('link',{name:signIn,exact:true})).toBeInViewport();
   await expect(page.getByRole('main').getByRole('link',{name:request,exact:true})).toBeInViewport();
  }
 }
});

// Language, tone, reading width and appearance share one height, however the page is sized.
test('the controls above the menu are all the same height',async({page})=>{
 for(const size of [{width:1280,height:800},{width:390,height:844},{width:320,height:700}]) {
  await page.setViewportSize(size);await page.goto('/en/methodology');
  const heights=await page.evaluate(()=>[...document.querySelectorAll('.topbar .language-switch summary, .topbar .density-switch button, .topbar .tone-switch button, .topbar .theme-toggle')].map(el=>Math.round(el.getBoundingClientRect().height)));
  expect(heights.length).toBe(6);
  expect(new Set(heights).size,JSON.stringify(heights)).toBe(1);
 }
});

// One door for organisations: the menu and the footer each carry a single For organisations link,
// and registering, signing in and the demo workspace sit behind that page. One sign-in serves every
// tier (landingPath() routes administrators, members and everyone else after authentication).
test('the menu has one organisations link on a narrow viewport and sign-in sits behind it',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto('/ro');
 const organisations=page.locator('.site-header').getByRole('link',{name:'Pentru instituții',exact:true});
 await expect(organisations).toBeHidden();
 const burger=page.locator('.menu-toggle');
 const burgerBounds=await burger.boundingBox();
 expect(burgerBounds).not.toBeNull();expect(burgerBounds!.x+burgerBounds!.width).toBeGreaterThan(320-40);
 await burger.click();
 await expect(organisations).toBeVisible();
 const bounds=await organisations.boundingBox();
 expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(320);
 for(const name of ['Autentificare organizație','Solicită acces pentru organizație','Spațiu demo','Administrare platformă']) {
  await expect(page.locator('.site-header').getByRole('link',{name})).toHaveCount(0);
  await expect(page.locator('.site-footer').getByRole('link',{name})).toHaveCount(0);
 }
 await organisations.click();await expect(page).toHaveURL(/\/ro\/for-organisations$/);
 await page.getByRole('main').getByRole('link',{name:'Autentificare',exact:true}).click();await expect(page).toHaveURL(/\/ro\/login$/);
 await page.setViewportSize({width:1280,height:800});await page.goto('/en');
 await expect(page.locator('.site-header').getByRole('link',{name:'For organisations',exact:true})).toBeVisible();
});

// Warm is a reader's alternative palette, so it has to clear the same contrast sweep as the default.
for(const theme of ['dark','light']) {
 test(`warm tone in ${theme} persists and passes automated checks`,async({page})=>{
  await page.goto('/en');
  const tone=page.getByRole('group',{name:'Colour tone',exact:true});
  await tone.getByRole('button',{name:'Warm',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-tone','warm');
  await page.evaluate(t=>{const k='vianorae:reading:v1';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)||'{}'),theme:t}));},theme);
  for(const path of ['/en','/en/example-guide','/en/for-organisations']) {
   await page.goto(path);
   await expect(page.locator('html')).toHaveAttribute('data-tone','warm');
   await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
   const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
   expect(results.violations).toEqual([]);
  }
 });
}
test('the saved tone is highlighted before hydration, so a refresh does not flash Cool',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('vianorae:reading:v1',JSON.stringify({tone:'warm'})));
  await page.route('**/_next/static/**/*.js',route=>route.abort());
  await page.goto('/en');
  const tone=page.getByRole('group',{name:'Colour tone',exact:true});
  const accent=await tone.getByRole('button',{name:'Warm',exact:true}).evaluate(el=>getComputedStyle(el).fontWeight);
  const cool=await tone.getByRole('button',{name:'Cool',exact:true}).evaluate(el=>getComputedStyle(el).fontWeight);
  expect(Number(accent)).toBeGreaterThan(Number(cool));
});
test('the tone control steps aside in high contrast and Cool restores the default',async({page})=>{
 const store=(theme:string)=>page.evaluate(t=>localStorage.setItem('vianorae:reading:v1',JSON.stringify({theme:t,tone:'warm'})),theme);
 await page.goto('/en');
 await store('contrast');await page.reload();
 await expect(page.getByRole('group',{name:'Colour tone',exact:true})).toHaveCount(0);
 await store('dark');await page.reload();
 const tone=page.getByRole('group',{name:'Colour tone',exact:true});
 await tone.getByRole('button',{name:'Cool',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-tone','cool');
});
