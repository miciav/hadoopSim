import { test, expect } from '@playwright/test';

test('Map-side pipeline page renders initial log', async ({ page }) => {
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  await expect(page.locator('#consoleLog')).toContainText('Cluster Daemon Started');
});
