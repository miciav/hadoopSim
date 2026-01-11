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
    expect(node.memoryUsedMb).toBeGreaterThanOrEqual(0);
    expect(node.memoryUsedMb).toBeLessThanOrEqual(node.memoryTotalMb);
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
      node.memoryTotalMb = 4096;
    });
    renderCluster();

    for (let i = 0; i < 15; i++) {
      submitJob();
    }
  });

  const initialQueue = await page.evaluate(() => cluster.yarnQueue.length);
  expect(initialQueue).toBeGreaterThan(0);

  await page.waitForFunction(
    () => cluster.yarnQueue.length === 0 && document.getElementById('activeApps')?.textContent === '0',
    null,
    { timeout: 2000 }
  );

  const finalQueue = await page.evaluate(() => cluster.yarnQueue.length);
  expect(finalQueue).toBe(0);
});
