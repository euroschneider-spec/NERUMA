import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const paths=['','for-organisations','methodology','places/willow-museum/guide','explore','contact','login','register','account','privacy','terms','accessibility','demo','demo/d0000000-0000-4000-8000-0000000000a1','demo/d0000000-0000-4000-8000-0000000000a1/preview','demo/d0000000-0000-4000-8000-0000000000a2'];
for(const locale of ['en','ro','de']) {
 test(`${locale}: routes and document language`,async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));for(const path of paths){const response=await page.goto(`/${locale}/${path}`);expect(response?.status(),path).toBe(200);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.locator('main h1')).toBeVisible();}expect(errors).toEqual([]);});
}
for(const path of ['/en','/en/places/willow-museum/guide','/en/contact','/en/demo','/en/demo/d0000000-0000-4000-8000-0000000000a1','/en/demo/d0000000-0000-4000-8000-0000000000a1/preview','/ro','/de']) {
 test(`WCAG A/AA checks ${path}`,async({page})=>{await page.goto(path);const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();expect(results.violations).toEqual([]);});
}
test('guide navigation, skip and completion work by keyboard',async({page})=>{await page.goto('/en/places/willow-museum/guide');await expect(page.getByRole('heading',{name:'The main entrance',exact:true})).toBeVisible();const next=page.getByRole('button',{name:'Next step',exact:true});await next.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Reception & the foyer',exact:true})).toBeFocused();await page.getByRole('button',{name:'Guide options',exact:true}).click();await page.getByRole('button',{name:'The quiet room',exact:false}).click();await expect(page.getByRole('heading',{name:'The quiet room',exact:true})).toBeVisible();await page.getByRole('button',{name:'Finish the guide'}).click();await expect(page.getByRole('heading',{name:'You have explored the guide.'})).toBeFocused();await page.getByRole('button',{name:'Start again'}).click();await expect(page.getByRole('heading',{name:'The main entrance',exact:true})).toBeVisible();});
test('catalog filters distinguish museum from unavailable categories',async({page})=>{await page.goto('/en/explore');await page.getByLabel('Category',{exact:true}).selectOption('theatre');await expect(page.getByRole('status')).toHaveText('No guide matches these filters.');await page.getByLabel('Category',{exact:true}).selectOption('museum');await expect(page.getByRole('link',{name:'Open guide',exact:true})).toBeVisible();});
test('QR API and stable redirects',async({request})=>{const svg=await request.get('/api/qr/willow-museum?locale=ro&download=1');expect(svg.status()).toBe(200);expect(svg.headers()['content-type']).toContain('image/svg+xml');expect(svg.headers()['content-disposition']).toContain('attachment');expect(await svg.text()).toContain('<svg');const redirect=await request.get('/q/willow-museum?locale=de',{maxRedirects:0});expect(redirect.status()).toBe(307);expect(redirect.headers().location).toContain('/de/places/willow-museum/guide');expect((await request.get('/q/unknown')).status()).toBe(404);expect((await request.get('/api/qr/unknown')).status()).toBe(404);const unsafe=await request.get('/q/willow-museum?locale=https://evil.example',{maxRedirects:0});expect(unsafe.headers().location).toContain('/en/places/');});
test('language switch preserves the current route',async({page})=>{await page.goto('/en/methodology');await page.locator('.language-switch summary').click();await page.getByRole('link',{name:'Română',exact:true}).click();await expect(page).toHaveURL(/\/ro\/methodology$/);await expect(page.locator('html')).toHaveAttribute('lang','ro');});
test('contact prepares an enquiry without sending it',async({page})=>{await page.goto('/en/contact');let posted=false;page.on('request',r=>{if(r.method()==='POST')posted=true;});await page.getByLabel('Your name').fill('Demo person');await page.getByLabel('Email').fill('demo@example.invalid');await page.getByLabel('Your message').fill('I would like to discuss the pilot.');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.enquiry-output')).toContainText('I would like to discuss the pilot.');expect(posted).toBe(false);});
// Reduced motion switches off the 0.15s colour fade, so the contrast check never samples a half-faded colour.
test('reading preferences persist and contrast themes pass automated checks',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en');await page.locator('.topbar-reading').click();await page.getByLabel('Text size',{exact:true}).selectOption('larger');await page.getByLabel('Appearance',{exact:true}).selectOption('dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('html')).toHaveAttribute('data-text-size','larger');let result=await new AxeBuilder({page}).withTags(['wcag2aa']).analyze();expect(result.violations).toEqual([]);await page.locator('.topbar-reading').click();await page.getByLabel('Appearance',{exact:true}).selectOption('contrast');result=await new AxeBuilder({page}).withTags(['wcag2aa']).analyze();expect(result.violations).toEqual([]);});
test('mobile reflow and menu',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/en');await page.getByRole('button',{name:'Open menu'}).click();await expect(page.getByRole('link',{name:'How it works',exact:true})).toBeVisible();await page.getByRole('link',{name:'How it works',exact:true}).click();await expect(page).toHaveURL(/\/en#how-it-works$/);await expect(page.locator('#how-it-works')).toBeInViewport();for(const path of ['/en','/en/places/willow-museum/guide','/en/demo/d0000000-0000-4000-8000-0000000000a1']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBe(true);}await page.goto('/en');await page.screenshot({path:'docs/verification/screenshots/mobile-preview.png',fullPage:true});});
test('320px reflow with 200% text and extra spacing',async({page})=>{await page.setViewportSize({width:320,height:800});for(const path of ['/en','/de','/en/places/willow-museum/guide','/en/demo','/en/register','/de/register']){await page.goto(path);await page.evaluate(()=>{document.documentElement.style.fontSize='32px';document.documentElement.dataset.spacing='true';});const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth,elements:Array.from(document.querySelectorAll('*')).map(element=>({tag:element.tagName,classes:element.className,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right,scroll:element.scrollWidth,client:element.clientWidth,text:element.textContent?.slice(0,60)})).filter(element=>element.right>window.innerWidth+1||element.scroll>element.client+3)}));expect(overflow.width<=overflow.viewport,path+' '+JSON.stringify(overflow)).toBe(true);}});
test('desktop visual evidence',async({page})=>{await page.setViewportSize({width:1440,height:1000});await page.goto('/en');await page.screenshot({path:'docs/verification/screenshots/home-preview.png',fullPage:true});await page.goto('/en/places/willow-museum/guide');await page.screenshot({path:'docs/verification/screenshots/guide-preview.png',fullPage:true});await page.goto('/en/demo');await page.screenshot({path:'docs/verification/screenshots/workspace-preview.png',fullPage:true});});

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

// Language, light or dark, and the reading button share one height, however the page is sized.
test('the controls above the menu are all the same height',async({page})=>{
 for(const size of [{width:1280,height:800},{width:390,height:844},{width:320,height:700}]) {
  await page.setViewportSize(size);await page.goto('/en/methodology');
  const heights=await page.evaluate(()=>[...document.querySelectorAll('.topbar .language-switch summary, .topbar .theme-toggle, .topbar .topbar-reading')].map(el=>Math.round(el.getBoundingClientRect().height)));
  expect(heights.length).toBe(3);
  expect(new Set(heights).size,JSON.stringify(heights)).toBe(1);
 }
});

// The Register page reads as one balanced column: shared edges, one rhythm, one label style.
test('Register blocks share both edges, one 24px rhythm and one label size',async({page})=>{
 for(const size of [{width:1280,height:800},{width:390,height:844}]) {
  await page.setViewportSize(size);await page.goto('/en/register');
  const m=await page.evaluate(()=>{
   const box=(sel:string)=>{const r=document.querySelector(sel)!.getBoundingClientRect();return {left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom)};};
   const labels=[...document.querySelectorAll('.organisation-form label.form-field, .organisation-form .form-field > label')].map(el=>getComputedStyle(el).fontSize);
   return {notice:box('.responsibility-notice'),gate:box('.organisation-form .notice'),form:box('.organisation-form fieldset'),labels,innerGaps:[...document.querySelectorAll('.responsibility-notice > * + *')].map(el=>Math.round(el.getBoundingClientRect().top-el.previousElementSibling!.getBoundingClientRect().bottom))};
  });
  expect(m.gate.left,JSON.stringify(m)).toBe(m.notice.left);expect(m.form.left).toBe(m.notice.left);
  expect(m.gate.right).toBe(m.notice.right);expect(m.form.right).toBe(m.notice.right);
  expect(m.gate.top-m.notice.bottom).toBe(24);expect(m.form.top-m.gate.bottom).toBe(24);
  expect(new Set(m.labels).size,JSON.stringify(m.labels)).toBe(1);
  expect(new Set(m.innerGaps).size,JSON.stringify(m.innerGaps)).toBe(1);
 }
});

// Fields sit on shared rows whatever the language: a long label must not push its field lower than its neighbours.
test('Register fields share rows in every language',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 for(const locale of ['en','ro','de']) {
  await page.goto(`/${locale}/register`);
  const m=await page.evaluate(()=>{
   const top=(sel:string)=>Math.round(document.querySelector(sel)!.getBoundingClientRect().top);
      return {
    pair2:[top('input[name=representative]'),top('input[name=representativeRole]')],
    thirds:[top('input[name=website]'),top('input[name=country]'),top('input[name=registry]')],
    pair3:[top('input[name=email]'),top('input[name=password]')],
   };
  });
  for(const row of [m.pair2,m.thirds,m.pair3]) expect(new Set(row).size,`${locale} ${JSON.stringify(m)}`).toBe(1);
 }
});

// Every dropdown draws its own arrow with room to the right, not the browser's arrow against the border.
test('every dropdown keeps its arrow 16px in from the edge',async({page})=>{
 const check=async(where:string)=>{
  const styles=await page.evaluate(()=>[...document.querySelectorAll('select')].map(el=>{const c=getComputedStyle(el);return {appearance:c.appearance,padding:c.paddingRight,position:c.backgroundPosition};}));
  expect(styles.length,where).toBeGreaterThan(0);
  for(const style of styles) {
   expect(style.appearance,where).toBe('none');
   expect(style.padding,where).toBe('40px');
   expect(style.position,where).toContain('100% - 16px');
  }
 };
 await page.goto('/en/explore');await check('/en/explore');
 await page.goto('/en');await page.locator('.topbar-reading').click();await check('reading panel');
});

// Organisation and admin forms use visible choices, never dropdowns.
test('organisation forms use visible choices instead of dropdowns',async({page})=>{
 await page.goto('/en/register');
 await expect(page.locator('main select')).toHaveCount(0);
 const type=page.getByRole('radiogroup',{name:'Organisation type',exact:true});
 await expect(type.getByRole('radio')).toHaveCount(6);
 await expect(type.getByLabel('Institution',{exact:true})).toBeChecked();
 await page.goto('/en/demo/d0000000-0000-4000-8000-0000000000a1');
 await expect(page.locator('main select')).toHaveCount(0);
 const sound=page.getByRole('radiogroup',{name:'Sound',exact:true}).first();
 await expect(sound.getByRole('radio')).toHaveCount(5);
 await sound.getByText('Low',{exact:true}).click();
 await sound.getByLabel('Low',{exact:true}).press('ArrowRight');
 await expect(sound.getByLabel('Moderate',{exact:true})).toBeChecked();
 await expect(sound.getByLabel('Low',{exact:true})).not.toBeChecked();
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
const openPanel=async(page:import('@playwright/test').Page)=>{await page.locator('.topbar-reading').click();return page.getByRole('dialog');};
for(const theme of ['dark','light']) {
 test(`green accent in ${theme} persists and passes automated checks`,async({page})=>{
  await page.goto('/en');
  const panel=await openPanel(page);
  await panel.getByLabel('Accent colour',{exact:true}).selectOption('warm');
  await expect(page.locator('html')).toHaveAttribute('data-tone','warm');
  await page.evaluate(t=>{const k='vianorae:reading:v1';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)||'{}'),theme:t,themeV:2}));},theme);
  for(const path of ['/en','/en/places/willow-museum/guide','/en/for-organisations']) {
   await page.goto(path);
   await expect(page.locator('html')).toHaveAttribute('data-tone','warm');
   await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
   const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
   expect(results.violations).toEqual([]);
  }
 });
}
test('the saved accent colour is applied before the page scripts load, so a refresh does not flash blue',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('vianorae:reading:v1',JSON.stringify({tone:'warm'})));
  await page.route('**/_next/static/**/*.js',route=>route.abort());
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('data-tone','warm');
});
test('the accent colour steps aside in high contrast and Blue restores the default',async({page})=>{
 const store=(theme:string)=>page.evaluate(t=>localStorage.setItem('vianorae:reading:v1',JSON.stringify({theme:t,themeV:2,tone:'warm'})),theme);
 await page.goto('/en');
 await store('contrast');await page.reload();
 let panel=await openPanel(page);
 await expect(panel.getByLabel('Accent colour',{exact:true})).toHaveCount(0);
 await store('dark');await page.reload();
 panel=await openPanel(page);
 await panel.getByLabel('Accent colour',{exact:true}).selectOption('cool');
 await expect(page.locator('html')).toHaveAttribute('data-tone','cool');
});
