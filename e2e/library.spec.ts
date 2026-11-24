import { expect, test } from '@playwright/test';
import { editorText, expectEditorToContain, newBoard, userPage } from './helpers';

test('new board picker: Enter makes an empty board; Escape cancels; samples link', async ({
  browser,
}) => {
  const page = await userPage(browser, 'Template Picker');
  const picker = page.getByTestId('new-board');

  // Escape closes the picker without creating anything.
  await page.getByRole('button', { name: 'New diagram' }).first().click();
  await expect(picker.locator('[data-template]')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);

  // The samples link swaps the picker for the full samples gallery.
  await page.getByRole('button', { name: 'New diagram' }).first().click();
  await page
    .getByRole('dialog', { name: 'Create a new board' })
    .getByRole('button', { name: 'Browse all samples' })
    .click();
  const gallery = page.getByRole('dialog', { name: 'New diagram from a sample' });
  await expect(gallery).toBeVisible();
  // The four starting points come first, as "Most used".
  await expect(gallery.getByTestId('most-used').locator('[data-template]')).toHaveText([
    'Empty',
    'Mermaid',
    'C4 architecture',
    'BPMN process',
  ]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tour=board-card]')).toHaveCount(0);

  // Empty is first and focused: Enter makes a blank board.
  await page.getByRole('button', { name: 'New diagram' }).first().click();
  await expect(picker.locator('[data-template=empty]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/d\//);
  await expectEditorToContain(page, 'Start writing your diagram here');
  expect(await editorText(page)).not.toContain('Christmas');
});

test('new board picker: C4 and BPMN templates render', async ({ browser }) => {
  const page = await userPage(browser, 'Template Maker');
  await newBoard(page, 'c4');
  await expect(page.getByTestId('title-input')).toHaveValue('System context');
  await expect(page.locator('[data-testid=diagram] svg')).toContainText('Online store');

  await page.goto('/');
  await newBoard(page, 'bpmn');
  await expect(page.getByTestId('title-input')).toHaveValue('Order process');
  await expect(page.locator('[data-testid=diagram] svg')).toContainText('In stock?');
  await expect(page.locator('[data-testid=diagram] svg')).toContainText('Courier');
});

test('the version badge opens the release notes and clears its “new” dot', async ({ browser }) => {
  const page = await userPage(browser, 'Release Reader');
  const badge = page.getByTestId('version-badge');
  await expect(badge).toHaveText(/Gramify v\d+\.\d+\.\d+/);
  await expect(badge.getByLabel('New')).toHaveCount(1);
  await badge.click();
  const notes = page.getByRole('dialog', { name: 'What’s new in Gramify' });
  await expect(notes.getByTestId('changelog')).toContainText('First release');
  await page.keyboard.press('Escape');
  await expect(badge.getByLabel('New')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('version-badge').getByLabel('New')).toHaveCount(0);
});
