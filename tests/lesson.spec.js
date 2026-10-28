import { test, expect } from './fixtures.js';

test('cluster lesson: upload, execute, fail a node and reset', async ({
  page
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/hadoop_full.html');
  const upload = page.getByRole('button', { name: /Upload File/i });
  await upload.focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.cluster.files.length)).toBe(1);
  await page.getByRole('button', { name: /Run MapReduce Job/i }).click();
  expect(await page.evaluate(() => window.cluster.mapReduceJobs.length)).toBe(
    1
  );
  await page.getByRole('button', { name: /Simulate Failure/i }).click();
  expect(
    await page.evaluate(
      () => window.cluster.nodes.filter((node) => node.failed).length
    )
  ).toBe(1);
  await page.getByRole('button', { name: /Reset Cluster/i }).click();
  const result = await page.evaluate(() => ({
    files: window.cluster.files.length,
    jobs: window.cluster.mapReduceJobs.length,
    failed: window.cluster.nodes.filter((node) => node.failed).length
  }));
  expect(result).toEqual({ files: 0, jobs: 0, failed: 0 });
});

test('cluster lesson: a queued job starts when capacity is released', async ({
  page
}) => {
  await page.addInitScript(() => {
    const interval = window.setInterval;
    window.setInterval = (fn, ms, ...args) =>
      interval(fn, Math.min(ms, 20), ...args);
  });
  await page.goto('/hadoop_full.html');
  await page.getByRole('button', { name: /Upload File/i }).click();
  await page.evaluate(() => {
    const sim = window.simulation;
    sim.state.nodes.forEach((node) =>
      sim.actions.submitYarnJob({
        name: `blocker-${node.id}`,
        cpu: node.cpuTotal,
        memoryMb: 1,
        preferredNodeIds: [node.id]
      })
    );
  });
  await page.getByRole('button', { name: /Run MapReduce Job/i }).click();
  await expect(page.locator('#mapReduceJobs')).toContainText('Queued');
  await page.evaluate(() =>
    window.simulation.yarn.releaseContainer('blocker-1')
  );
  await expect(page.locator('#mapReduceJobs')).toContainText('Completed');
});

test('cluster lesson: mapper recovery and explicit input data loss', async ({
  page
}) => {
  await page.addInitScript(() => {
    const interval = window.setInterval;
    window.setInterval = (fn, ms, ...args) =>
      interval(fn, Math.min(ms, 20), ...args);
  });
  await page.goto('/hadoop_full.html');
  await page.getByRole('button', { name: /Upload File/i }).click();
  await page.evaluate(() => {
    const sim = window.simulation;
    const job = sim.actions.submitMapReduce({});
    const mapper = job.mappers.find(
      (entry) => entry.nodeId !== job.appMasterNodeId
    );
    if (!mapper) throw new Error('Fixture requires a remote ApplicationMaster');
    sim.actions.failNode(mapper.nodeId);
  });
  await expect(page.locator('#mapReduceJobs')).toContainText('Completed');
  await page.getByRole('button', { name: /Reset Cluster/i }).click();
  await page.getByRole('button', { name: /Upload File/i }).click();
  await page.evaluate(() => {
    const sim = window.simulation;
    const blockId = sim.state.files[0].blocks[0].id;
    const replicas = sim.state.nodes.filter((node) =>
      node.blocks.some((block) => block.id === blockId)
    );
    replicas.forEach((node) => sim.actions.failNode(node.id));
  });
  await page.getByRole('button', { name: /Run MapReduce Job/i }).click();
  await expect(page.locator('#mapReduceJobs')).toContainText('Failed');
  await expect(page.locator('#mapReduceJobs')).toContainText('replica');
});

test('pipeline controls have accessible labels at laptop width', async ({
  page
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  await expect(page.getByLabel('Speed')).toBeVisible();
  await expect(page.getByLabel('Split Size')).toBeVisible();
  await page.goto('/hadoopsim-teaching.html');
  await expect(page.getByLabel('Split Size')).toBeVisible();
  await page.getByRole('button', { name: 'Next Step' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Next Step' })).toBeEnabled();
  expect(
    await page.evaluate(
      () => window.teachingSimulation.getCurrentStepInfo().index
    )
  ).toBe(1);
});
