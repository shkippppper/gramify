import { expect, type Browser, type Page } from '@playwright/test';

/** Text of the Monaco editor (Monaco renders spaces as non-breaking spaces). */
export async function editorText(page: Page) {
  const t = await page.locator('[data-testid=code-editor] .view-lines').textContent();
  return (t ?? '').replace(/ /g, ' ');
}

export async function expectEditorToContain(page: Page, text: string) {
  await expect.poll(() => editorText(page)).toContain(text);
}

export async function typeAtEnd(page: Page, text: string) {
  await page.locator('[data-testid=code-editor] .view-lines').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

let n = 0;
/** A signed-in page for a fresh user (dev login). */
export async function userPage(browser: Browser, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${Date.now()}.${n++}@example.com`;
  await page.goto('/login');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
  return page;
}
