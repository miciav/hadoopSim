import { test, expect } from './fixtures.js';

test('legacy Ecosystem URL opens the shared cluster with its original scenario', async ({
  page
}) => {
  await page.goto('/hadoop-ecosystem-simulator.html');
  await expect(page).toHaveURL(/hadoop_full\.html\?scenario=replicated/);
  await expect(page.locator('#clusterScenario')).toHaveValue('replicated');
  await expect(page.locator('#scenarioSummary')).toContainText('128 MB blocks');
  await expect(page.locator('#scenarioSummary')).toContainText('3 replicas');
});

test('shared cluster retains file selection and resets allocated containers', async ({
  page
}) => {
  await page.goto('/hadoop-ecosystem-simulator.html');
  await expect(page.locator('#mapReduceHint')).toBeVisible();
  await page.getByRole('button', { name: 'Upload File', exact: true }).click();
  await expect(page.locator('#mapReduceHint')).toBeHidden();
  await page.getByRole('button', { name: 'Upload 1 GB', exact: true }).click();
  await page.locator('#mapReduceFile').selectOption('file-2.dat');
  await page.locator('#mapReduceBtn').click();
  await expect(page.locator('#mapReduceJobs')).toContainText('file-2.dat');
  await expect(page.locator('.container-chip.appmaster')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Reset Cluster', exact: true })
    .click();
  await expect(page.locator('.container-chip')).toHaveCount(0);
  await expect(page.locator('#mapReduceBtn')).toBeDisabled();
  await expect(page.locator('#mapReduceFile option')).toHaveCount(0);
  await expect(page.locator('#mapReduceHint')).toBeVisible();
});
