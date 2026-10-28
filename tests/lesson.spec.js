import { test, expect } from './fixtures.js';

test('cluster lesson: upload, execute, fail a node and reset', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/hadoop_full.html');
  const upload = page.getByRole('button', { name: /Upload File/i });
  await upload.focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.cluster.files.length)).toBe(1);
  await page.getByRole('button', { name: /Run MapReduce Job/i }).click();
  expect(await page.evaluate(() => window.cluster.mapReduceJobs.length)).toBe(1);
  await page.getByRole('button', { name: /Simulate Failure/i }).click();
  expect(await page.evaluate(() => window.cluster.nodes.filter(node => node.failed).length)).toBe(1);
  await page.getByRole('button', { name: /Reset Cluster/i }).click();
  const result = await page.evaluate(() => ({
    files: window.cluster.files.length,
    jobs: window.cluster.mapReduceJobs.length,
    failed: window.cluster.nodes.filter(node => node.failed).length
  }));
  expect(result).toEqual({ files: 0, jobs: 0, failed: 0 });
});
