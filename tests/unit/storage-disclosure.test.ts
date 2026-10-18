// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getContent } from '@/lib/content';
import { locales } from '@/lib/i18n';

// TECH-TASKS §3: anything stored on a visitor's device must be listed on the privacy page, and adding analytics, maps,
// videos or any third-party script means re-checking consent first. This test makes both a failing build, not a memory.

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
const files = sourceFiles('src').map((path) => path.replaceAll('\\', '/'));
const source = (path: string) => readFileSync(path, 'utf8');
const using = (pattern: RegExp) => files.filter((path) => pattern.test(source(path))).sort();

describe('everything stored on the device is on the privacy page', () => {
  // Files that may store things, with the privacy-page text that discloses each. A new file in any list fails the test.
  it('browser storage is used only by the files that are disclosed', () => {
    expect(using(/\b(localStorage|sessionStorage)\b/).filter((path) => path !== 'src/lib/content.ts')).toEqual([
      'src/app/[locale]/layout.tsx', // restores reading settings before first paint
      'src/components/org-sidebar.tsx', // sidebar collapsed
      'src/components/reading-settings.tsx',
      'src/lib/demo-workspace.ts',
      'src/lib/reading-prefs.ts',
    ]);
    expect(using(/\bindexedDB\b/)).toEqual(['src/lib/local-photos.ts']);
  });

  it('cookies are set only by the files that are disclosed', () => {
    expect(using(/document\.cookie/)).toEqual([]);
    expect(using(/cookies\(\)\)\.set|cookieStore\.set|\bstore\.set\(|\bcookies\.set\(/)).toEqual([
      'src/lib/password-reset-server.ts', // "neruma_reset"
      'src/lib/supabase/server.ts', // sign-in cookies (chunked, "sb-…-auth-token")
      'src/lib/two-factor-server.ts', // "neruma_device"
      'src/proxy.ts', // refreshes the same sign-in cookies
    ]);
  });

  it('no analytics, tracking or third-party script is loaded', () => {
    const forbidden = /googletagmanager|google-analytics|gtag\(|plausible|matomo|segment\.com|hotjar|fullstory|facebook\.net|clarity\.ms|posthog|mixpanel|sentry\.io|maps\.googleapis|youtube\.com\/embed|player\.vimeo/i;
    expect(using(forbidden).filter((path) => !path.startsWith('src/lib/content.ts'))).toEqual([]);
    expect(using(/<Script\b|next\/script/)).toEqual([]);
  });

  it.each(locales)('the %s privacy page names every storage key and cookie', (locale) => {
    const page = getContent(locale, 'privacy')!;
    const text = JSON.stringify(page);
    for (const name of ['neruma_device', 'neruma_reset', 'vianorae:reading:v1', 'neruma:sidebar-collapsed', 'neruma:demo:v1:', 'vianorae-demo-media-v1', 'sb-', '-auth-token', '400', '30']) {
      expect(text, `${locale}: ${name}`).toContain(name);
    }
  });

  it('the storage names in the privacy page match the code', () => {
    const all = files.map(source).join('\n');
    for (const name of ['vianorae:reading:v1', 'neruma:sidebar-collapsed', 'neruma:demo:v1:', 'vianorae-demo-media-v1', "'neruma_device'", "'neruma_reset'"]) {
      expect(all, name).toContain(name);
    }
    expect(source('src/lib/two-factor-server.ts')).toContain('thirtyDays = 30 * 24 * 60 * 60');
  });
});
