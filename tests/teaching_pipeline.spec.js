import { test, expect } from './fixtures.js';

test('reset does not allow a previous teaching step to advance', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  const result = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    sim.init();
    const step = sim.nextStep();
    sim.reset();
    await step;
    return sim.getCurrentStepInfo();
  });
  expect(result.index).toBe(0);
});

test('reset and restart cancels animations from an old mapper step', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  const result = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    sim.init();
    await sim.nextStep();
    const step = sim.nextStep();
    sim.reset();
    sim.init();
    await step;
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      index: sim.getCurrentStepInfo().index,
      records: document.getElementById('mRecords')?.textContent,
      buffers: sim.getState().mappers.map(mapper => mapper.buffer.length)
    };
  });
  expect(result.index).toBe(0);
  expect(result.buffers).toEqual([0, 0]);
  expect(Number(result.records)).toBe(0);
});

test('guided pipeline conserves input counts by key', async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript({ content: `const originalTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 2), ...args);` });
  await page.goto('/hadoopsim-teaching.html');
  const result = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    sim.init();
    while (!sim.isComplete()) await sim.nextStep();
    return Object.fromEntries(Object.values(sim.getState().reduceOutput).flat().map(record => [record.k, record.count]));
  });
  expect(result).toEqual({ ant: 7, arm: 2, car: 5, cat: 1, cup: 3, day: 3, dog: 2, dot: 1 });
});

test('guided mapper batches respect input split boundaries', async ({ page }) => {
  await page.addInitScript({ content: `const originalTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 2), ...args);` });
  await page.goto('/hadoopsim-teaching.html');
  const result = await page.evaluate(() => {
    document.getElementById('splitSizeInput').value = '3';
    const sim = window.teachingSimulation;
    sim.init();
    return sim.getState().inputSplits.map(splits => splits.map(split => split.length));
  });
  expect(result).toEqual([[3, 3, 3, 3], [3, 3, 3, 3]]);
  const steps = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    const sizes = [];
    while (!sim.isComplete()) {
      const info = sim.getCurrentStepInfo();
      if (info.step?.type === 'MAP_BATCH') sizes.push(info.step.batches.map(batch => batch.length));
      await sim.nextStep();
    }
    return {
      sizes,
      spills: sim.getState().mappers.map(mapper => mapper.spills.length),
      output: Object.fromEntries(Object.values(sim.getState().reduceOutput).flat().map(record => [record.k, record.count]))
    };
  });
  expect(steps.sizes).toEqual([[3, 3], [3, 3], [3, 3], [3, 3]]);
  expect(steps.spills).toEqual([4, 4]);
  expect(steps.output).toEqual({ ant: 7, arm: 2, car: 5, cat: 1, cup: 3, day: 3, dog: 2, dot: 1 });
});

test('pause stops automatic playback after the current step', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  await page.getByRole('button', { name: 'Play' }).click({ timeout: 1000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => !window.teachingSimulation.isBusy());
  const index = await page.evaluate(() => window.teachingSimulation.getCurrentStepInfo().index);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.teachingSimulation.getCurrentStepInfo().index)).toBe(index);
});

test('a failed teaching step reports the error and leaves reset usable', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  await page.evaluate(() => { window.teachingSimulation.nextStep = async () => { throw new Error('test failure'); }; });
  await page.getByRole('button', { name: 'Next Step' }).click();
  await expect(page.locator('#stepError')).toContainText('test failure', { timeout: 1500 });
  await expect(page.getByRole('button', { name: 'Reset' })).toBeEnabled();
});

test('guided view respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/hadoopsim-teaching.html');
  const duration = await page.evaluate(() => {
    const record = document.createElement('div');
    record.className = 'kv-record flying-record';
    document.body.appendChild(record);
    const result = getComputedStyle(record).transitionDuration;
    record.remove();
    return result;
  });
  expect(duration.split(',').every(value => parseFloat(value) === 0)).toBe(true);
});

test('two concurrent next requests execute only one step', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  const index = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    sim.init();
    await Promise.all([sim.nextStep(), sim.nextStep()]);
    return sim.getCurrentStepInfo().index;
  });
  expect(index).toBe(1);
});

test('play can restart immediately after reset', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => window.teachingSimulation.getCurrentStepInfo().index >= 1);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => !window.teachingSimulation.isBusy());
  expect(await page.evaluate(() => window.teachingSimulation.getCurrentStepInfo().index)).toBeGreaterThanOrEqual(1);
});

test('empty split input restores the previous valid value on reset', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  const split = page.locator('#splitSizeInput');
  await split.fill('');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(split).toHaveValue('10');
  const sizes = await page.evaluate(() => window.teachingSimulation.getState().inputSplits.map(splits => splits.flat().length));
  expect(sizes).toEqual([12, 12]);
});

test('reset in a completion callback preserves the new step cursor', async ({ page }) => {
  await page.goto('/hadoopsim-teaching.html');
  const index = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    sim.init();
    sim.onStepComplete(() => { sim.reset(); sim.init(); });
    await sim.nextStep();
    return sim.getCurrentStepInfo().index;
  });
  expect(index).toBe(0);
});

test('every guided phase can reset immediately without leaving overlays', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => original(fn, Math.min(ms, 2), ...args);
  });
  await page.goto('/hadoopsim-teaching.html');
  const phases = await page.evaluate(async () => {
    const sim = window.teachingSimulation;
    const checked = [];
    for (const type of ['INPUT_INIT', 'MAP_BATCH', 'SPILL_SORT', 'COMBINE', 'MERGE', 'SHUFFLE', 'REDUCE_MERGE', 'REDUCE', 'OUTPUT', 'FINISH']) {
      sim.reset();
      sim.init();
      while (sim.getCurrentStepInfo().step?.type !== type && !sim.isComplete()) await sim.nextStep();
      if (sim.isComplete()) throw new Error(`Missing phase ${type}`);
      const pending = sim.nextStep();
      sim.reset();
      await pending;
      if (sim.getCurrentStepInfo().index !== 0 || document.querySelector('.flying-record, .combine-sweep')) throw new Error(`Stale step or overlay after ${type}`);
      checked.push(type);
    }
    return checked.length;
  });
  expect(phases).toBe(10);
});
