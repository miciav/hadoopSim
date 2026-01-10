import { test, expect } from '@playwright/test';
import { getNumberFromText, getPercent } from './helpers.js';

test('YARN allocates resources and keeps usage bounded', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 1337;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  });

  await page.goto('/yarn_interactive.html');

  await expect(page.locator('#totalNodes')).toHaveText('6');
  await expect(page.locator('#queuedJobs')).toHaveText('0');

  await page.evaluate(() => submitJob());
  await page.evaluate(() => submitJob());

  const activeApps = await getNumberFromText(page, '#activeApps');
  const cpuUsage = await getPercent(page, '#cpuUsage');
  const memUsage = await getPercent(page, '#memoryUsage');

  expect(activeApps).toBeGreaterThan(0);
  expect(cpuUsage).toBeGreaterThanOrEqual(0);
  expect(cpuUsage).toBeLessThanOrEqual(100);
  expect(memUsage).toBeGreaterThanOrEqual(0);
  expect(memUsage).toBeLessThanOrEqual(100);

  await page.evaluate(() => resetCluster());
  await expect(page.locator('#activeApps')).toHaveText('0');
  await expect(page.locator('#queuedJobs')).toHaveText('0');
});
