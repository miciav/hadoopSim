import { test, expect } from './fixtures.js';

test('Map-side pipeline page renders initial log', async ({ page }) => {
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  await expect(page.locator('#consoleLog')).toContainText(
    'Cluster Daemon Started'
  );
});

test('reset and restart does not continue the old automatic run', async ({
  page
}) => {
  test.setTimeout(30000);
  await page.addInitScript({
    content: `const originalTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 10), ...args);`
  });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  const result = await page.evaluate(async () => {
    const sim = window.pipelineSimulation;
    const first = sim.run();
    sim.reset();
    const second = sim.run();
    await Promise.all([first, second]);
    return {
      records: Number(document.getElementById('mRecords').textContent),
      final: sim
        .getState()
        .mappers.map((mapper) =>
          mapper.final.reduce((sum, rec) => sum + (rec.count || 1), 0)
        ),
      output: Object.fromEntries(
        Object.values(sim.getState().reduceOutput)
          .flat()
          .map((record) => [record.k, record.count])
      )
    };
  });
  expect(result.records).toBe(24);
  expect(result.final).toEqual([12, 12]);
  expect(result.output).toEqual({
    ant: 7,
    arm: 2,
    car: 5,
    cat: 1,
    cup: 3,
    day: 3,
    dog: 2,
    dot: 1
  });
});

test('reset during mapping does not corrupt the restarted run', async ({
  page
}) => {
  test.setTimeout(30000);
  await page.addInitScript({
    content: `const originalTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 10), ...args);`
  });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  const result = await page.evaluate(async () => {
    const sim = window.pipelineSimulation;
    const first = sim.run();
    while (Number(document.getElementById('mRecords').textContent) === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    sim.reset();
    const second = sim.run();
    await Promise.all([first, second]);
    return {
      records: Number(document.getElementById('mRecords').textContent),
      final: sim
        .getState()
        .mappers.map((mapper) =>
          mapper.final.reduce((sum, rec) => sum + (rec.count || 1), 0)
        ),
      output: Object.fromEntries(
        Object.values(sim.getState().reduceOutput)
          .flat()
          .map((record) => [record.k, record.count])
      )
    };
  });
  expect(result.records).toBe(24);
  expect(result.final).toEqual([12, 12]);
  expect(result.output).toEqual({
    ant: 7,
    arm: 2,
    car: 5,
    cat: 1,
    cup: 3,
    day: 3,
    dog: 2,
    dot: 1
  });
});

test('reset during shuffle leaves no old packets in the cleared interface', async ({
  page
}) => {
  test.setTimeout(30000);
  await page.addInitScript({
    content: `const originalTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 10), ...args);`
  });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  const result = await page.evaluate(async () => {
    const sim = window.pipelineSimulation;
    const run = sim.run();
    while (Number(document.getElementById('mNet').textContent) === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    sim.reset();
    await run;
    return {
      packets: Number(document.getElementById('mNet').textContent),
      records: document.querySelectorAll(
        '#red0 .kv-record, #red1 .kv-record, #red2 .kv-record'
      ).length
    };
  });
  expect(result).toEqual({ packets: 0, records: 0 });
});

test('reset during folding leaves the new interface unfolded', async ({
  page
}) => {
  test.setTimeout(30000);
  await page.addInitScript({
    content: `const originalTimeout = window.setTimeout; window.realTimeout = originalTimeout; window.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 15), ...args);`
  });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  const count = await page.evaluate(async () => {
    const sim = window.pipelineSimulation;
    document.getElementById('teachingMode').checked = false;
    const run = sim.run();
    while (!sim.getState().shuffleComplete)
      await new Promise((resolve) => setTimeout(resolve, 1));
    sim.reset();
    await run;
    await new Promise((resolve) => window.realTimeout(resolve, 150));
    return document.querySelectorAll('.node-row.folded, .box-content.folded')
      .length;
  });
  expect(count).toBe(0);
});
