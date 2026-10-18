import { test, expect } from '@playwright/test';
import { button, field, message } from './support/bound';

// The helper has to refuse what it exists to refuse. Each case is a control a lazier test would have accepted.
// These pages never change, so a refusal is certain at once; a short timeout saves the default 5 s per refusal.
const REFUSED_AT = 500;
const page = (html: string) => `<!doctype html><html lang="en"><body><main>${html}</main></body></html>`;

test.describe('bound locators', () => {
  test('accept a control whose id, text and accessible name agree', async ({ page: p }) => {
    await p.setContent(page(`<button data-testid="go">Confirm</button><label>6-digit code <input data-testid="code"></label><p data-testid="note" role="status">Saved</p>`));
    await button(p, 'go', 'Confirm');
    await field(p, 'code', '6-digit code');
    await message(p, 'note', 'Saved');
  });

  test('refuse a button that has its id but the wrong words', async ({ page: p }) => {
    await p.setContent(page(`<button data-testid="go">Cancel</button>`));
    await expect(button(p, 'go', 'Confirm', REFUSED_AT)).rejects.toThrow();
  });

  test('refuse a button that has its id but no words at all', async ({ page: p }) => {
    await p.setContent(page(`<button data-testid="go"></button>`));
    await expect(button(p, 'go', 'Confirm', REFUSED_AT)).rejects.toThrow();
  });

  test('refuse a button announced differently from what it shows', async ({ page: p }) => {
    await p.setContent(page(`<button data-testid="go" aria-label="Submit">Confirm</button>`));
    await expect(button(p, 'go', 'Confirm', REFUSED_AT)).rejects.toThrow();
  });

  test('refuse a field with no label, or the label of another language', async ({ page: p }) => {
    await p.setContent(page(`<input data-testid="code"><label>Code din aplicație <input data-testid="ro"></label>`));
    await expect(field(p, 'code', '6-digit code', REFUSED_AT)).rejects.toThrow();
    await expect(field(p, 'ro', '6-digit code', REFUSED_AT)).rejects.toThrow();
  });

  test('refuse an id that is missing, repeated or hidden', async ({ page: p }) => {
    await p.setContent(page(`<button data-testid="twice">Confirm</button><button data-testid="twice">Confirm</button><button data-testid="hidden" hidden>Confirm</button>`));
    await expect(button(p, 'nothing', 'Confirm', REFUSED_AT)).rejects.toThrow();
    await expect(button(p, 'twice', 'Confirm', REFUSED_AT)).rejects.toThrow();
    await expect(button(p, 'hidden', 'Confirm', REFUSED_AT)).rejects.toThrow();
  });

  test('can ask for the words in a pattern when part of them changes', async ({ page: p }) => {
    await p.setContent(page(`<p data-testid="left" role="status">8 of 10 backup codes left.</p>`));
    await message(p, 'left', /^\d+ of 10 backup codes left\.$/);
    await expect(message(p, 'left', /^\d+ of 12 /, REFUSED_AT)).rejects.toThrow();
  });
});
