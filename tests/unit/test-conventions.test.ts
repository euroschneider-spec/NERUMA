// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// How tests find things (docs/guides/TESTING.md, "Finding elements"): by the words a person sees (role and name, label), or
// by a test id that is always checked together with those words. The only code allowed to use a test id is the helper that
// does both; everything else goes through it.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name).replaceAll('\\', '/');
    return statSync(path).isDirectory() ? (name === 'node_modules' ? [] : walk(path)) : /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
const testFiles = [...walk('tests'), ...walk('scripts')];
const allowed = new Set(['tests/support/bound.ts', 'tests/bound-locators.spec.ts', 'tests/unit/test-conventions.test.ts']);
const read = (path: string) => readFileSync(path, 'utf8');

describe('test conventions', () => {
  it('no test finds an element by test id except through the bound helpers', () => {
    const offenders = testFiles.filter((path) => !allowed.has(path) && /getByTestId\s*\(|data-testid|testIdAttribute/.test(read(path)));
    expect(offenders, 'use button(), field() or message() from tests/support/bound.ts, which check the words too').toEqual([]);
  });

  it('the helper checks the words in the same step as it finds the element', () => {
    const helper = read('tests/support/bound.ts');
    expect(helper).toMatch(/getByTestId\(testId\)/);
    expect(helper).toMatch(/toHaveText\(text(, \{ timeout \})?\)/);
    expect(helper).toMatch(/toHaveAccessibleName\(text(, \{ timeout \})?\)/);
    expect(helper).toMatch(/toHaveAccessibleName\(label(, \{ timeout \})?\)/);
    // There is no exported function that returns an element without having checked its words.
    const exported = [...helper.matchAll(/^export async function (\w+)/gm)].map((match) => match[1]);
    expect(exported.sort()).toEqual(['button', 'field', 'message']);
  });

  it('the test id attribute is the default, so an id in the markup means one thing everywhere', () => {
    expect(read('playwright.config.ts')).not.toMatch(/testIdAttribute/);
  });
});
