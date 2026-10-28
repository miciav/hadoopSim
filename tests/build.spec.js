import { test, expect } from './fixtures.js';

test('published pages load under a project prefix without external requests', async ({ page }) => {
  const failed = [];
  page.on('requestfailed', request => failed.push(request.url()));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://localhost:5173') return route.abort();
    if (url.pathname.startsWith('/hadoopSim/')) {
      url.pathname = url.pathname.slice('/hadoopSim'.length);
      const response = await page.request.get(url.toString());
      return route.fulfill({ response });
    }
    return route.continue();
  });
  for (const file of ['index.html', 'hadoop-ecosystem-simulator.html', 'hadoop_full.html', 'hdfs_interactive.html', 'yarn_interactive.html', 'hadoop-map-side-pipeline-dual_nodes.html', 'hadoopsim-teaching.html', 'hadoop-map-side-pipeline.html', 'hadoop-map-side-pipeline-dual.html']) {
    const response = await page.goto(`/hadoopSim/${file}`);
    expect(response.status(), file).toBe(200);
    if (file === 'hadoop-ecosystem-simulator.html') await expect(page.getByRole('button', { name: /Upload 256 MB/i })).toBeVisible();
  }
  expect(failed).toEqual([]);
});
