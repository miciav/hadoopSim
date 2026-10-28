import { test, expect } from './fixtures.js';

test('published pages load under a project prefix without external requests', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const failed = [];
  page.on('response', (response) => {
    if (response.status() >= 400)
      failed.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => failed.push(request.url()));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://localhost:5173') return route.abort();
    if (url.pathname.startsWith('/hadoopSim/')) {
      url.pathname = url.pathname.slice('/hadoopSim'.length);
      const response = await page.request.get(url.toString());
      return route.fulfill({ response });
    }
    failed.push(`Request outside project prefix: ${url.pathname}`);
    return route.abort();
  });
  for (const file of [
    'index.html',
    'hadoop-ecosystem-simulator.html',
    'hadoop_full.html',
    'hdfs_interactive.html',
    'yarn_interactive.html',
    'hadoop-map-side-pipeline-dual_nodes.html',
    'hadoopsim-teaching.html',
    'hadoop-map-side-pipeline.html',
    'hadoop-map-side-pipeline-dual.html'
  ]) {
    const response = await page.goto(`/hadoopSim/${file}`);
    expect(response.status(), file).toBe(200);
    if (file === 'hadoop-ecosystem-simulator.html')
      await expect(
        page.getByRole('button', { name: /Upload 256 MB/i })
      ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${file}.png`),
      fullPage: true
    });
  }
  expect(failed).toEqual([]);
});

test('distribution includes runtime licenses', async ({ request }) => {
  for (const name of [
    'react',
    'react-dom',
    'scheduler',
    'xstate',
    'loose-envify',
    'js-tokens'
  ]) {
    const response = await request.get(`/licenses/${name}.txt`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Permission');
  }
});
