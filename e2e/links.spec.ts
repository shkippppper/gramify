import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { emailOf, expectEditorToContain, userPage } from './helpers';

const SOURCE = `sequenceDiagram
  participant API
  participant Worker
  API->>Worker: enqueue payment
  Worker-->>API: done
`;

async function createBoard(page: Page, title: string, code: string): Promise<string> {
  const res = await page.request.post('/api/diagrams', { data: { title, code } });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

const workerShape = (page: Page) =>
  page.locator('[data-testid=diagram] svg text', { hasText: /^Worker$/ }).first();

test('link a shape to another board; click opens it; backlinks list the link', async ({
  browser,
}) => {
  const page = await userPage(browser, 'Ada Linker');
  const target = await createBoard(page, 'Payment worker', 'flowchart LR\n  Q --> P\n');
  const source = await createBoard(page, 'Checkout', SOURCE);
  await page.goto(`/d/${source}`);
  await expect(workerShape(page)).toBeVisible();

  // Right-click the participant → Link to board… → pick it.
  await workerShape(page).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Link to board…' }).click();
  await page.getByLabel('Search boards').fill('Payment');
  await page
    .getByTestId('link-picker')
    .getByRole('button', { name: /Payment worker/ })
    .click();

  // Both Worker boxes (top and bottom) are linked, and the code has the line.
  await expect(page.locator('[data-testid=diagram] [data-tp-link]')).toHaveCount(2);
  await expectEditorToContain(page, '%% link Worker -> Payment worker /d/');

  // Hover shows the board; a click opens it in a new tab.
  await workerShape(page).hover();
  await expect(page.getByTestId('link-card')).toContainText('Payment worker');
  const [tab] = await Promise.all([page.context().waitForEvent('page'), workerShape(page).click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toContain(`/d/${target}`);
  await tab.close();

  // Exported SVGs keep the link.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'SVG', exact: true }).click(),
  ]);
  const svg = readFileSync((await download.path())!, 'utf8');
  expect(svg).toMatch(new RegExp(`<a [^>]*href="[^"]*/d/${target}"`));

  // The linked board lists Checkout under "Linked from".
  await page.goto(`/d/${target}`);
  await page.getByRole('button', { name: 'Links' }).click();
  await expect(page.getByRole('menuitem', { name: 'Checkout' })).toBeVisible();
});

test('teammates without access see a hint; the owner can share in one click', async ({
  browser,
}) => {
  const ada = await userPage(browser, 'Ada Owner');
  const grace = await userPage(browser, 'Grace Teammate');
  const target = await createBoard(ada, 'Payment worker', 'flowchart LR\n  Q --> P\n');
  const source = await createBoard(
    ada,
    'Checkout',
    `${SOURCE}%% link Worker -> Payment worker /d/${target}\n`,
  );
  const share = await ada.request.post(`/api/diagrams/${source}/members`, {
    data: { email: emailOf(grace), role: 'editor' },
  });
  expect(share.ok()).toBe(true);

  // Grace can open Checkout but not the linked board.
  await grace.goto(`/d/${source}`);
  await workerShape(grace).hover();
  await expect(grace.getByTestId('link-card')).toContainText('You can’t open this board');

  // Ada (owner of the linked board) is told and shares it from the card.
  await ada.goto(`/d/${source}`);
  await workerShape(ada).hover();
  const card = ada.getByTestId('link-card');
  await expect(card).toContainText('can see this board but not the linked one');
  await card.getByRole('button', { name: /Share with/ }).click();
  await expect(ada.getByText('Shared with 1 person')).toBeVisible();

  // Now Grace can open it.
  await grace.reload();
  await workerShape(grace).hover();
  await expect(grace.getByTestId('link-card')).toContainText('Payment worker');
  await expect(grace.getByTestId('link-card')).toContainText('Open in new tab');
});
