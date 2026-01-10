import { test, expect } from '@playwright/test';

test('Ecosystem simulator renders core controls', async ({ page }) => {
  await page.goto('/hadoop-ecosystem-simulator.html');

  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByRole('button', { name: /Upload 256 MB/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /MapReduce/i })).toBeVisible();
});
