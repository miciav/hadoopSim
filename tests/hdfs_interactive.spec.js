import { test, expect } from '@playwright/test';
import { getNumberFromText, getPercent } from './helpers.js';

test('HDFS basic flows and invariants', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  });

  await page.goto('/hdfs_interactive.html');

  await expect(page.locator('#totalNodes')).toHaveText('4');
  await expect(page.locator('#activeNodes')).toHaveText('4');
  await expect(page.locator('#totalFiles')).toHaveText('0');
  await expect(page.locator('#totalBlocks')).toHaveText('0');
  await expect(page.locator('#replicationFactor')).toHaveText('3');

  await page.evaluate(() => uploadFile());

  const totalFiles = await getNumberFromText(page, '#totalFiles');
  const totalBlocks = await getNumberFromText(page, '#totalBlocks');
  const storageUsage = await getPercent(page, '#storageUsage');

  expect(totalFiles).toBeGreaterThan(0);
  expect(totalBlocks).toBeGreaterThan(0);
  expect(storageUsage).toBeGreaterThan(0);

  const blockCount = await page.locator('.block').count();
  expect(blockCount).toBe(totalBlocks);

  await page.evaluate(() => simulateNodeFailure());
  await expect(page.locator('#activeNodes')).toHaveText('3');

  await page.evaluate(() => resetCluster());
  await expect(page.locator('#totalFiles')).toHaveText('0');
  await expect(page.locator('#totalBlocks')).toHaveText('0');
});
