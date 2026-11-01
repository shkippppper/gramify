import { expect, test } from '@playwright/test';
import { userPage } from './helpers';

const tourCard = (page: import('@playwright/test').Page) =>
  page.getByTestId('tour').getByRole('dialog');

test('first visit shows the tour; “Don’t show this again” keeps it away', async ({ browser }) => {
  const page = await userPage(browser, 'Tour Taker', { tour: true });
  const card = tourCard(page);
  await expect(card).toContainText('Welcome to Gramify');
  await card.getByRole('button', { name: 'Next' }).click();
  await expect(card).toContainText('Create a board');
  await page.keyboard.press('ArrowRight');
  await expect(card).toContainText('Find your boards');
  await page.keyboard.press('ArrowLeft');
  await expect(card).toContainText('Create a board');

  await card.getByLabel('Don’t show this again').check();
  await card.getByRole('button', { name: 'Close tour' }).click();
  await expect(page.getByTestId('tour')).toHaveCount(0);

  // Not on reload, not in a new session, and not for the editor either.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('tour')).toHaveCount(0);

  // It can still be replayed from the account menu.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  await expect(card).toContainText('Welcome to Gramify');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tour')).toHaveCount(0);
});

test('skipping brings the tour back next session; finishing the editor tour ends it', async ({
  browser,
}) => {
  const page = await userPage(browser, 'Tour Skipper', { tour: true });
  await expect(tourCard(page)).toContainText('Welcome to Gramify');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tour')).toHaveCount(0);

  // Same session: stays away. New session: back again.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(tourCard(page)).toContainText('Welcome to Gramify');
  await page.keyboard.press('Escape');

  // The first board opens the editor tour; step through to the end.
  await page.getByRole('button', { name: 'New diagram' }).first().click();
  await page.waitForURL(/\/d\//);
  const card = tourCard(page);
  await expect(card).toContainText('Write Mermaid code');
  for (let i = 0; i < 20; i++) {
    const done = card.getByRole('button', { name: 'Done' });
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await card.getByRole('button', { name: 'Next' }).click();
  }
  await expect(page.getByTestId('tour')).toHaveCount(0);

  // Finished means finished, even in a new session.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.locator('[data-testid=diagram] svg')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('tour')).toHaveCount(0);
});
