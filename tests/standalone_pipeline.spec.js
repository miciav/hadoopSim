import { test, expect } from './fixtures.js';

for (const skin of [
  'hadoop',
  'classroom',
  'focus',
  'topology',
  'lecture',
  'lecture-dark'
]) {
  for (const file of [
    'hadoop-map-side-pipeline.html',
    'hadoop-map-side-pipeline-dual.html'
  ]) {
    test(`${file} runs and resets with initial ${skin} skin`, async ({
      page
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('hadoopSim.skin', value);
        const timer = window.setTimeout.bind(window);
        let time = 0;
        window.requestAnimationFrame = (callback) =>
          timer(() => callback((time += 500)), 0);
        window.cancelAnimationFrame = (id) => clearTimeout(id);
      }, skin);
      await page.goto(`/${file}`);
      await expect(page.locator('[data-skin-select]')).toHaveCount(0);
      await page.locator('#startBtn').click();
      await expect(page.locator('#logCurrent')).toContainText(
        'Simulation Complete',
        {
          timeout: 15000
        }
      );
      await expect(page.locator('#hdfs0')).not.toBeEmpty();
      await page.locator('#resetBtn').click();
      await expect(page.locator('#recordsProcessed')).toHaveText('0');
      await expect(page.locator('#startBtn')).toBeEnabled();
      await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
    });
  }
}
