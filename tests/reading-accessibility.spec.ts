import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const copy={
  en:{settings:'Reading settings',close:'Close reading settings',size:'Text size',theme:'Appearance',full:'Complete guide in text',heading:'Your complete visit guide',steps:'Step by step',sound:'You can use this site without sound.',options:'Guide options'},
  ro:{settings:'Setări de lectură',close:'Închide setările de lectură',size:'Mărimea textului',theme:'Aspect',full:'Ghid complet în text',heading:'Ghidul complet al vizitei',steps:'Pas cu pas',sound:'Poți folosi acest site fără sunet.',options:'Opțiuni pentru ghid'},
  de:{settings:'Leseeinstellungen',close:'Leseeinstellungen schließen',size:'Textgröße',theme:'Darstellung',full:'Vollständiger Guide als Text',heading:'Ihr vollständiger Besuchs-Guide',steps:'Schritt für Schritt',sound:'Sie können diese Website ohne Ton nutzen.',options:'Guide-Optionen'},
};
for(const locale of ['en','ro','de'] as const) {
  const t=copy[locale];
  test(`${locale}: a single floating popup focuses its controls and closes with Escape`,async({page})=>{
    await page.goto(`/${locale}`);const trigger=page.locator('.floating-reading');
    await expect(trigger).toHaveAccessibleName(t.settings);await trigger.focus();await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:t.settings,exact:true});await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(t.size,{exact:true})).toBeFocused();
    await expect(page.getByRole('button',{name:t.settings,exact:true})).toHaveCount(1);
    await page.keyboard.press('Tab');expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
    expect(await page.locator('body').evaluate(node=>node.style.overflow)).not.toBe('hidden');
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
    await page.goto(`/${locale}/contact`);await page.locator('.floating-reading').click();await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:t.close,exact:true}).click();await expect(page.locator('.floating-reading')).toBeFocused();
  });
  test(`${locale}: complete text guide contains all steps and remains usable without audio or images`,async({page})=>{
    await page.goto(`/${locale}/example-guide`);await expect(page.locator('main').getByText(t.sound,{exact:false})).toBeVisible();
    const description=await page.locator('.gg-desc').first().innerText();
    await page.getByRole('button',{name:t.options,exact:true}).click();
    await page.getByRole('button',{name:t.full,exact:true}).focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('heading',{name:t.heading,exact:true})).toBeFocused();
    await expect(page.locator('.guide-text-steps>li')).toHaveCount(5);await expect(page.locator('.guide-text-view')).toContainText(description);
    await expect(page.locator('.guide-text-view dl')).toHaveCount(5);await expect(page.locator('.guide-text-view h4')).toHaveCount(10);
    await expect(page.locator('.guide-info-text')).toHaveCount(3);await expect(page.locator('main audio,main video,main iframe')).toHaveCount(0);
    await expect(page.locator('.guide-text-view img')).toHaveCount(0);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);
    await page.setViewportSize({width:320,height:800});await page.evaluate(()=>document.documentElement.style.fontSize='32px');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByRole('button',{name:t.options,exact:true}).click();
    await page.getByRole('button',{name:t.steps,exact:true}).click();await expect(page.locator('.gg-title')).toBeFocused();await expect(page.locator('.gg-photo img')).toBeVisible();
  });
}
test('reading panel repositions on resize and reflows with enlarged text',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/de');await page.locator('.floating-reading').click();
  const dialog=page.getByRole('dialog',{name:copy.de.settings,exact:true});
  await page.setViewportSize({width:320,height:800});await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  await expect.poll(async()=>dialog.evaluate(node=>{const rect=node.getBoundingClientRect();return rect.left>=0 && rect.right<=window.innerWidth && node.scrollWidth<=node.clientWidth;})).toBe(true);
  await dialog.getByLabel(copy.de.theme,{exact:true}).selectOption('dark');
  const result=await new AxeBuilder({page}).withTags(['wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);
  await dialog.getByRole('button',{name:copy.de.close,exact:true}).click();
});
test('text guide uses the saved local draft and retains the current step when switching views',async({page})=>{
  await page.goto('/en/dashboard/builder');await page.getByLabel('Zone title',{exact:true}).first().fill('Saved text entrance');await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await page.goto('/en/dashboard/preview');await page.getByRole('button',{name:'Next step',exact:true}).click();
  await page.getByRole('button',{name:copy.en.full,exact:true}).click();await expect(page.locator('.guide-text-view')).toContainText('Saved text entrance');
  await page.getByRole('button',{name:copy.en.steps,exact:true}).click();await expect(page.getByRole('heading',{name:'Reception & the foyer',exact:true})).toBeFocused();
});
test('reading controls are visible before the footer and screenshots document the new views',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/ro');await page.locator('.floating-reading').click();
  await page.screenshot({path:'docs/verification/screenshots/reading-panel-preview.png'});await page.keyboard.press('Escape');
  await page.goto('/ro/example-guide');await page.getByRole('button',{name:copy.ro.options,exact:true}).click();await page.getByRole('button',{name:copy.ro.full,exact:true}).click();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'docs/verification/screenshots/text-guide-preview.png',fullPage:true});
});

test('popup can be moved by drag, keyboard and single-click controls, with viewport bounds and reset',async({page})=>{
  await page.setViewportSize({width:1440,height:1400});await page.goto('/en');await page.locator('.floating-reading').click();
  const panel=page.getByRole('dialog');const handle=panel.getByRole('button',{name:'Move reading panel',exact:true});const initial=await panel.boundingBox();
  await handle.focus();await page.keyboard.press('ArrowLeft');expect((await panel.boundingBox())!.x).toBeCloseTo(initial!.x-24,0);
  await page.keyboard.press('Home');expect((await panel.boundingBox())!.x).toBeCloseTo(initial!.x,0);
  await handle.click();await panel.getByRole('button',{name:'Move left',exact:true}).click();expect((await panel.boundingBox())!.x).toBeCloseTo(initial!.x-24,0);
  await panel.getByRole('button',{name:'Reset panel position',exact:true}).click();
  const before=await panel.boundingBox();const grip=await handle.boundingBox();
  await page.mouse.move(grip!.x+grip!.width/2,grip!.y+grip!.height/2);await page.mouse.down();await page.mouse.move(grip!.x+grip!.width/2+60,grip!.y+grip!.height/2+50,{steps:5});await page.mouse.up();
  const moved=await panel.boundingBox();expect(moved!.x).toBeCloseTo(before!.x+60,0);expect(moved!.y).toBeCloseTo(Math.min(before!.y+50,1400-before!.height-16),0);
  await page.setViewportSize({width:320,height:700});await expect.poll(async()=>panel.evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=16 && r.top>=16 && r.right<=window.innerWidth-16 && r.bottom<=window.innerHeight-16;})).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('.floating-reading')).toBeFocused();
});

test('nonmodal popup permits background keyboard access and outside clicks without stealing focus',async({page})=>{
  await page.goto('/en/contact');const launcher=page.locator('.floating-reading');await launcher.click();const panel=page.getByRole('dialog');
  await panel.locator('.reading-audio-details summary').click();const speed=panel.getByLabel('Reading speed',{exact:true});await speed.focus();await page.keyboard.press('Tab');
  expect(await panel.evaluate(node=>node.contains(document.activeElement))).toBe(false);await expect(panel).toBeVisible();
  const email=page.getByLabel('Email *',{exact:true});await email.click();await expect(panel).not.toBeVisible();await expect(email).toBeFocused();
  await launcher.click();await page.getByRole('link',{name:'NERUMA',exact:true}).first().focus();await page.keyboard.press('Escape');await expect(panel).not.toBeVisible();await expect(launcher).toBeFocused();
});
