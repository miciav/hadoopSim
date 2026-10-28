import { test, expect } from './fixtures.js';

for (const [path, action] of [
  ['/hadoop_full.html', 'uploadFile'],
  ['/hdfs_interactive.html', 'uploadFile'],
  ['/yarn_interactive.html', 'submitJob']
]) {
  test(`reset clears old notifications on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate((name) => {
      window[name]();
      window.resetCluster();
    }, action);
    await expect(page.locator('.notification')).toHaveCount(1);
    await expect(page.locator('.notification')).toContainText(/reset/i);
  });
}
