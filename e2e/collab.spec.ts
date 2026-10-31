import { expect, test } from '@playwright/test';
import { editorText, expectEditorToContain, typeAtEnd, userPage } from './helpers';

test('two people edit the same diagram together', async ({ browser }) => {
  const ada = await userPage(browser, 'Ada Lovelace');
  const grace = await userPage(browser, 'Grace Hopper');

  await ada.getByRole('button', { name: 'New diagram' }).first().click();
  await ada.waitForURL(/\/d\//);
  await expect(ada.locator('[data-testid=diagram] svg')).toBeVisible();
  await grace.goto(ada.url());
  await expect(grace.locator('[data-testid=diagram] svg')).toBeVisible();

  // Presence
  await expect(ada.getByRole('button', { name: 'Follow Grace Hopper' })).toBeVisible();
  await expect(grace.getByRole('button', { name: 'Follow Ada Lovelace' })).toBeVisible();

  // Live text + preview
  await typeAtEnd(ada, '\n    F --> G[Shared edit]');
  await expectEditorToContain(grace, 'G[Shared edit]');
  await expect(grace.locator('[data-testid=diagram] svg')).toContainText('Shared edit');

  // Remote caret with name tag, and live pointer on the canvas
  await expect(grace.locator('.yRemoteSelectionHead')).toHaveCount(1);
  const box = (await ada.locator('[data-testid=diagram]').boundingBox())!;
  await ada.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ada.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 + 15);
  await expect(grace.getByTestId('remote-pointer')).toBeVisible();

  // Live title
  await grace.getByTestId('title-input').fill('Shared architecture');
  await grace.getByTestId('title-input').press('Enter');
  await expect(ada.getByTestId('title-input')).toHaveValue('Shared architecture');

  // Undo only affects your own edits
  await typeAtEnd(grace, '\n    G --> H[Grace]');
  await expectEditorToContain(ada, 'H[Grace]');
  await ada.locator('[data-testid=code-editor] .view-lines').click();
  await ada.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => editorText(ada)).not.toContain('G[Shared edit]');
  expect(await editorText(ada)).toContain('H[Grace]');

  // Follow mode
  await grace.getByRole('button', { name: 'Follow Ada Lovelace' }).click();
  await expect(grace.getByText('Following Ada Lovelace')).toBeVisible();
  await grace.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(grace.getByText('Following Ada Lovelace')).toHaveCount(0);
});

test('save, preview and restore a version', async ({ browser }) => {
  const ada = await userPage(browser, 'Ada Lovelace');
  const grace = await userPage(browser, 'Grace Hopper');
  await ada.getByRole('button', { name: 'New diagram' }).first().click();
  await ada.waitForURL(/\/d\//);
  await grace.goto(ada.url());
  await expect(grace.locator('[data-testid=diagram] svg')).toBeVisible();

  await ada.getByRole('button', { name: /History/ }).click();
  await ada.getByRole('button', { name: 'Save version' }).click();
  await ada.getByLabel('Version name').fill('Before cleanup');
  await ada.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(ada.getByTestId('version-item').filter({ hasText: 'Before cleanup' })).toBeVisible();

  await ada.locator('[data-testid=code-editor] .view-lines').click();
  await ada.keyboard.press('ControlOrMeta+a');
  await ada.keyboard.type('pie title After\n    "a" : 1');
  await expectEditorToContain(grace, 'pie title After');

  await ada.getByTestId('version-item').filter({ hasText: 'Before cleanup' }).click();
  await expect(ada.getByText(/Previewing/)).toBeVisible();
  await ada.getByRole('button', { name: 'Restore this version' }).last().click();
  await ada.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
  await expectEditorToContain(grace, 'Christmas');
  await expect(
    ada.getByTestId('version-item').filter({ hasText: 'Before restoring' }),
  ).toBeVisible();
});

test('library: folders, star, search and trash', async ({ browser }) => {
  const page = await userPage(browser, 'Linus Torvalds');
  const title = `Kernel map ${Date.now()}`;
  await page.getByRole('button', { name: 'New diagram' }).first().click();
  await page.waitForURL(/\/d\//);
  await page.getByTestId('title-input').fill(title);
  await page.getByTestId('title-input').press('Enter');
  await expect(page.getByTestId('status')).toHaveText(/Saved/);
  await page.waitForTimeout(2500); // debounced persistence
  await page.goto('/');

  await page.getByLabel('Search diagrams').fill(title);
  const card = page.getByTestId('diagram-card').filter({ hasText: title });
  await expect(card).toHaveCount(1);

  await card.getByRole('button', { name: 'Star' }).click();
  await page.getByRole('button', { name: 'Starred' }).click();
  await page.getByLabel('Search diagrams').fill(title);
  await expect(page.getByTestId('diagram-card').filter({ hasText: title })).toHaveCount(1);

  // Folder + move
  const folder = `Folder ${Date.now()}`;
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Folder name').fill(folder);
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'All diagrams' }).click();
  await page.getByLabel('Search diagrams').fill(title);
  await page
    .getByTestId('diagram-card')
    .filter({ hasText: title })
    .getByRole('button', { name: `Actions for ${title}` })
    .click();
  await page.getByRole('menuitem', { name: 'Move to folder…' }).click();
  await page.getByRole('dialog').getByLabel('Folder').selectOption({ label: folder });
  await page.getByRole('dialog').getByRole('button', { name: 'Move' }).click();
  await page.getByRole('button', { name: folder, exact: true }).click();
  await expect(page.getByTestId('diagram-card').filter({ hasText: title })).toHaveCount(1);

  // Trash and restore
  await page
    .getByTestId('diagram-card')
    .filter({ hasText: title })
    .getByRole('button', { name: `Actions for ${title}` })
    .click();
  await page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await page.getByRole('button', { name: 'Trash' }).click();
  await page.getByLabel('Search diagrams').fill(title);
  await page
    .getByTestId('diagram-card')
    .filter({ hasText: title })
    .getByRole('button', { name: `Actions for ${title}` })
    .click();
  await page.getByRole('menuitem', { name: 'Restore' }).click();
  await expect(page.getByTestId('diagram-card').filter({ hasText: title })).toHaveCount(0);
});
