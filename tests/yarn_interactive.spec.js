import { test, expect } from '@playwright/test';
import { getClusterSnapshot } from './helpers.js';

const seedRandom = (seedValue) => () => {
  let seed = seedValue;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
};

test('YARN resource usage stays within node capacity', async ({ page }) => {
  await page.addInitScript(seedRandom(99));
  await page.goto('/yarn_interactive.html');

  await page.evaluate(() => {
    submitJob();
    submitJob();
    submitBigJob();
    submitJob();
  });

  const snapshot = await getClusterSnapshot(page);
  snapshot.nodes.forEach((node) => {
    expect(node.cpuUsed).toBeGreaterThanOrEqual(0);
    expect(node.cpuUsed).toBeLessThanOrEqual(node.cpuTotal);
    expect(node.memoryUsed).toBeGreaterThanOrEqual(0);
    expect(node.memoryUsed).toBeLessThanOrEqual(node.memoryTotal);
  });
});

test('YARN queue drains when resources free up', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.1;
    const nativeSetTimeout = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => nativeSetTimeout(fn, Math.min(ms, 20), ...args);
  });

  await page.goto('/yarn_interactive.html');

  await page.evaluate(() => {
    cluster.nodes.forEach((node) => {
      node.cpuTotal = 2;
      node.memoryTotal = 4;
    });
    renderCluster();

    for (let i = 0; i < 15; i++) {
      submitJob();
    }
  });

  const initialQueue = await page.evaluate(() => cluster.jobQueue.length);
  expect(initialQueue).toBeGreaterThan(0);

  await page.waitForTimeout(300);

  const finalQueue = await page.evaluate(() => cluster.jobQueue.length);
  expect(finalQueue).toBe(0);

  await expect(page.locator('#activeApps')).toHaveText('0');
});
