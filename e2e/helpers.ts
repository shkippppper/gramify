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
/** A signed-in page for a fresh user (dev login). The email is stored on the page for sharing. */
export async function userPage(browser: Browser, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${Date.now()}.${n++}@example.com`;
  await page.goto('/login');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
  emails.set(page, email);
  return page;
}

const emails = new WeakMap<Page, string>();
export const emailOf = (page: Page) => emails.get(page)!;

/** Owner adds someone to the open board through the Share dialog. */
export async function shareWith(
  owner: Page,
  other: Page,
  role: 'Can edit' | 'Can view' = 'Can edit',
) {
  await expect(owner.locator('[data-testid=diagram] svg')).toBeVisible();
  await owner.getByRole('button', { name: /Share/ }).click();
  await owner.getByRole('menuitem', { name: 'People with access…' }).click();
  const dialog = owner.getByRole('dialog');
  await dialog.getByLabel('Email address').fill(emailOf(other));
  await dialog.getByLabel('Access', { exact: true }).selectOption({ label: role });
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog.getByTestId('member').filter({ hasText: emailOf(other) })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
}
