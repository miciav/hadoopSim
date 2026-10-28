import { test, expect } from './fixtures.js';

test('Ecosystem simulator renders core controls', async ({ page }) => {
  await page.goto('/hadoop-ecosystem-simulator.html');

  await expect(
    page.getByRole('button', { name: /Upload 256 MB/i })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /MapReduce Jobs/i })
  ).toBeVisible();
});

test('Ecosystem supports upload, job and reset', async ({ page }) => {
  await page.goto('/hadoop-ecosystem-simulator.html');
  await page.getByRole('button', { name: /Upload 256 MB/i }).click();
  await page.getByRole('button', { name: /Run on file-1.dat/i }).click();
  await expect(page.locator('.jobs-container')).toContainText('MapReduce-1');
  await page.getByRole('button', { name: /Reset Cluster/i }).click();
  await expect(page.locator('.jobs-container')).toContainText(
    'No MapReduce jobs yet'
  );
  await expect(
    page.getByRole('button', { name: /Run on file-1.dat/i })
  ).toHaveCount(0);
});

test('reset removes notifications from the previous cluster', async ({
  page
}) => {
  await page.goto('/hadoop-ecosystem-simulator.html');
  await page.getByRole('button', { name: /Upload 256 MB/i }).click();
  await expect(page.locator('.notification')).toContainText(['uploaded']);
  await page.getByRole('button', { name: /Reset Cluster/i }).click();
  await expect(page.locator('.notification')).toHaveCount(1);
  await expect(page.locator('.notification')).toContainText('reset');
});

test('ecosystem announces notifications through a persistent live region', async ({
  page
}) => {
  await page.goto('/hadoop-ecosystem-simulator.html');
  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await page.getByRole('button', { name: /Upload 256 MB/i }).click();
  await expect(status).toContainText('uploaded');
});
