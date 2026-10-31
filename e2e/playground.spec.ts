import { expect, test } from '@playwright/test';
import { typeAtEnd } from './helpers';

test('renders, reports syntax errors and keeps state in the URL', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('[data-testid=diagram] svg')).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#pako:/);

  await typeAtEnd(page, '\n    X --> {{{');
  await expect(page.getByTestId('error-bar')).toContainText('Parse error');
  await expect(page.locator('.squiggly-error')).toHaveCount(1);
});

test('every sample diagram renders', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/play');
  await page.getByRole('button', { name: 'Sample diagrams' }).click();
  const buttons = page.locator('[data-testid=samples] > div > div > button:first-child');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(30);
  for (let i = 0; i < count; i++) {
    const name = await buttons.nth(i).textContent();
    await buttons.nth(i).click();
    await expect(page.getByTestId('error-bar'), `sample ${name}`).toHaveCount(0);
    await expect(page.locator('[data-testid=diagram].opacity-50'), `sample ${name}`).toHaveCount(
      0,
      { timeout: 15_000 },
    );
  }
});

test('exports PNG and SVG', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('[data-testid=diagram] svg')).toBeVisible();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG' }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const [svg] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'SVG' }).click(),
  ]);
  expect(svg.suggestedFilename()).toMatch(/\.svg$/);
});
