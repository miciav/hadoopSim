import { test, expect } from '@playwright/test';
import { getNumberFromText, getPercent } from './helpers.js';

test('Full simulator keeps HDFS/YARN/MapReduce invariants', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 7;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  });

  await page.goto('/hadoop_full.html');

  await expect(page.locator('#totalNodes')).toHaveText('6');
  await expect(page.locator('#totalFiles')).toHaveText('0');

  await page.evaluate(() => uploadFile());
  await page.evaluate(() => submitYarnJob());
  await page.evaluate(() => runMapReduce());

  const totalFiles = await getNumberFromText(page, '#totalFiles');
  const totalBlocks = await getNumberFromText(page, '#totalBlocks');
  const activeJobs = await getNumberFromText(page, '#activeJobs');
  const mapReduceJobs = await getNumberFromText(page, '#mapReduceJobsCount');

  expect(totalFiles).toBeGreaterThan(0);
  expect(totalBlocks).toBeGreaterThan(0);
  expect(activeJobs).toBeGreaterThanOrEqual(0);
  expect(mapReduceJobs).toBeGreaterThanOrEqual(0);

  const storagePercent = await getPercent(page, '#storageUsage');
  expect(storagePercent).toBeGreaterThanOrEqual(0);
  expect(storagePercent).toBeLessThanOrEqual(100);

  const jobCards = await page.locator('.mapreduce-job').count();
  expect(jobCards).toBeGreaterThan(0);

  await page.evaluate(() => resetCluster());
  await expect(page.locator('#totalFiles')).toHaveText('0');
  await expect(page.locator('#mapReduceJobsCount')).toHaveText('0');
});
