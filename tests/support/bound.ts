import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The only way a test finds an element by its test id. The id and the words a person sees or hears are checked in the same
 * step, so a control can't pass because its id is on the page while its label is missing, empty, wrong, or left in the
 * wrong language. A test that needs an element asks for it with the words it must carry:
 *
 *   const confirm = await button(page, 'code-confirm', 'Confirm');
 *   const code = await field(page, 'code-input', '6-digit code from the app');
 *
 * tests/unit/test-conventions.test.ts fails the build if a test uses getByTestId (or a data-testid selector) anywhere else.
 */
type Words = string | RegExp;

async function found(page: Page, testId: string): Promise<Locator> {
  const locator = page.getByTestId(testId);
  await expect(locator, `the control "${testId}" is on the page`).toHaveCount(1);
  await expect(locator, `the control "${testId}" is visible`).toBeVisible();
  return locator;
}

/** A button or link: its visible text and its accessible name are both the words given, so they agree (WCAG 2.5.3). */
export async function button(page: Page, testId: string, text: Words): Promise<Locator> {
  const locator = await found(page, testId);
  await expect(locator, `"${testId}" shows the text`).toHaveText(text);
  await expect(locator, `"${testId}" is announced with the same words`).toHaveAccessibleName(text);
  return locator;
}

/** A form field, checkbox or any control named by a label: its accessible name is the label given. */
export async function field(page: Page, testId: string, label: Words): Promise<Locator> {
  const locator = await found(page, testId);
  await expect(locator, `"${testId}" has the label`).toHaveAccessibleName(label);
  return locator;
}

/** A message or heading: its text is the words given. */
export async function message(page: Page, testId: string, text: Words): Promise<Locator> {
  const locator = await found(page, testId);
  await expect(locator, `"${testId}" says`).toHaveText(text);
  return locator;
}
