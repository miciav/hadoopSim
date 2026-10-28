import { test, expect } from './fixtures.js';
import { getClusterSnapshot, seedPage } from './helpers.js';

test('YARN resource usage stays within node capacity', async ({ page }) => {
  await seedPage(page, 99);
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
    window.setTimeout = (fn, ms, ...args) =>
      nativeSetTimeout(fn, Math.min(ms, 20), ...args);
  });

  await page.goto('/yarn_interactive.html');

  const initialQueue = await page.evaluate(() => {
    cluster.nodes.forEach((node) => {
      node.cpuTotal = 2;
      node.memoryTotalMb = 4096;
    });
    renderCluster();

    for (let i = 0; i < 15; i++) {
      submitJob();
    }
    return cluster.yarnQueue.length;
  });
  expect(initialQueue).toBeGreaterThan(0);

  await page.waitForFunction(
    () =>
      cluster.yarnQueue.length === 0 &&
      document.getElementById('activeApps')?.textContent === '0',
    null,
    { timeout: 2000 }
  );

  const finalQueue = await page.evaluate(() => cluster.yarnQueue.length);
  expect(finalQueue).toBe(0);
});
