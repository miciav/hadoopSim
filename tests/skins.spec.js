import { test, expect } from './fixtures.js';

const skins = ['hadoop', 'classroom', 'focus', 'topology'];
const pages = [
  'index.html',
  'hadoop-ecosystem-simulator.html',
  'hadoop_full.html',
  'hdfs_interactive.html',
  'yarn_interactive.html',
  'hadoop-map-side-pipeline-dual_nodes.html',
  'hadoopsim-teaching.html',
  'hadoop-map-side-pipeline.html',
  'hadoop-map-side-pipeline-dual.html'
];

test('homepage skin selection persists across navigation and reload', async ({
  page
}) => {
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'hadoop');
  const select = page.getByLabel('Skin', { exact: true });
  await select.selectOption('classroom');
  await page.reload();
  await expect(select).toHaveValue('classroom');
  await page.getByRole('link', { name: 'Open HDFS demo →' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'classroom');
  await expect(page.locator('[data-skin-select]')).toHaveCount(0);
});

for (const failure of ['invalid', 'read', 'write', 'getter']) {
  test(`skin handles ${failure} storage`, async ({ page }) => {
    await page.addInitScript((mode) => {
      if (mode === 'invalid') localStorage.setItem('hadoopSim.skin', 'unknown');
      else if (mode === 'getter')
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new Error('denied');
          }
        });
      else
        Object.defineProperty(
          Storage.prototype,
          mode === 'read' ? 'getItem' : 'setItem',
          {
            value() {
              throw new Error('denied');
            }
          }
        );
    }, failure);
    await page.goto('/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'hadoop');
    await page.getByLabel('Skin', { exact: true }).selectOption('focus');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'focus');
  });
}

for (const skin of skins) {
  test(`${skin} covers every page with local styles and no simulator selector`, async ({
    page
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    const failed = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(r.url());
    });
    for (const file of pages) {
      await page.goto(`/${file}`);
      await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
      await expect(page.locator('[data-skin-select]')).toHaveCount(
        file === 'index.html' ? 1 : 0
      );
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--sim-surface')
            .trim()
        )
      ).not.toBe('');
      await expect(page.locator('body')).toBeVisible();
    }
    expect(failed).toEqual([]);
  });
}

test('an open simulation ignores preference changes from the homepage', async ({
  page,
  context
}) => {
  await page.goto('/hadoop_full.html');
  await page.getByRole('button', { name: /Upload File/i }).click();
  await page.evaluate(() => {
    window.originalSimulation = window.simulation;
  });
  const home = await context.newPage();
  await home.goto('/index.html');
  await home.getByLabel('Skin', { exact: true }).selectOption('topology');
  await page.bringToFront();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'hadoop');
  expect(
    await page.evaluate(() => window.originalSimulation === window.simulation)
  ).toBe(true);
  expect(await page.evaluate(() => window.cluster.files.length)).toBe(1);
  await home.close();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'topology');
});

for (const skin of skins) {
  test(`${skin} keeps controls reachable on narrow screens`, async ({
    page
  }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    for (const file of pages) {
      await page.goto(`/${file}`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        ),
        file
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${file}.png`),
        fullPage: true,
        animations: 'disabled'
      });
    }
  });
}

for (const skin of skins) {
  test(`${skin} pipeline results preserve teaching semantics`, async ({
    page
  }) => {
    test.setTimeout(60000);
    await page.addInitScript((value) => {
      localStorage.setItem('hadoopSim.skin', value);
      const timeout = window.setTimeout;
      window.setTimeout = (fn, ms, ...args) =>
        timeout(fn, Math.min(ms, 2), ...args);
    }, skin);
    for (const file of [
      'hadoop-map-side-pipeline-dual_nodes.html',
      'hadoopsim-teaching.html'
    ]) {
      await page.goto(`/${file}`);
      const output = await page.evaluate(async () => {
        const sim = window.pipelineSimulation || window.teachingSimulation;
        if (window.pipelineSimulation) await sim.run();
        else {
          sim.init();
          while (!sim.isComplete()) await sim.nextStep();
        }
        return Object.fromEntries(
          Object.values(sim.getState().reduceOutput)
            .flat()
            .map((r) => [r.k, r.count])
        );
      });
      expect(output).toEqual({
        ant: 7,
        arm: 2,
        car: 5,
        cat: 1,
        cup: 3,
        day: 3,
        dog: 2,
        dot: 1
      });
    }
  });
}

test('homepage selector supports keyboard selection', async ({ page }) => {
  await page.goto('/index.html');
  const select = page.getByLabel('Skin', { exact: true });
  await select.focus();
  await expect(select).toBeFocused();
  await page.keyboard.press('c');
  await page.keyboard.press('Tab');
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'classroom');
});

for (const skin of skins) {
  test(`${skin} is independent of other skin stylesheets`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    await page.goto('/index.html');
    await page.locator('link[href*="/skins/"]').evaluateAll((links, chosen) => {
      links.forEach((link) => {
        if (!link.href.endsWith(`/${chosen}.css`)) link.remove();
      });
    }, skin);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    ).not.toBe('rgba(0, 0, 0, 0)');
    await expect(page.getByLabel('Skin', { exact: true })).toBeVisible();
  });
}

test('healthy status badge has readable text', async ({ page }) => {
  await page.goto('/hdfs_interactive.html');
  const badge = page.locator('.node-status-badge.healthy').first();
  await expect(badge).toContainText(/healthy/i);
  const colors = await badge.evaluate((el) => {
    const css = getComputedStyle(el);
    return { text: css.color, background: css.backgroundColor };
  });
  expect(colors.text).not.toBe(colors.background);
});

test('pipeline active node remains visually distinguished', async ({
  page
}) => {
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  const node = page.locator('#node01');
  const border = await node.evaluate((el) => getComputedStyle(el).borderColor);
  await node.evaluate((el) => el.classList.add('active-node'));
  await expect
    .poll(() => node.evaluate((el) => getComputedStyle(el).borderColor))
    .not.toBe(border);
});

test('narrow pipeline scrolls its diagram while keeping log and controls readable', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  expect(
    await page
      .locator('.app')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
  ).toBe(true);
  expect(
    await page.locator('.log-content').evaluate((el) => el.clientWidth)
  ).toBeGreaterThan(250);
  const diagram = page.getByRole('region', { name: 'Simulation diagram' });
  await expect(diagram).toHaveAttribute('tabindex', '0');
});

test('pipeline skins adapt the scene and explanation hierarchy', async ({
  page
}) => {
  const layouts = [];
  for (const skin of ['hadoop', 'classroom', 'focus']) {
    await page.goto('/index.html');
    await page.getByLabel('Skin', { exact: true }).selectOption(skin);
    await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
    layouts.push(
      await page
        .locator('.layout')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    );
  }
  expect(new Set(layouts).size).toBe(3);
});

test('pipeline completes after resizing during an active transfer', async ({
  page
}) => {
  await page.addInitScript(() => {
    const timer = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) =>
      timer(fn, Math.min(ms, 40), ...args);
  });
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  await page.evaluate(() => {
    window.activeRun = window.pipelineSimulation.run();
  });
  await page.locator('.flying-record').first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const result = await page.evaluate(async () => {
    await window.activeRun;
    return Object.fromEntries(
      Object.values(window.pipelineSimulation.getState().reduceOutput)
        .flat()
        .map((record) => [record.k, record.count])
    );
  });
  expect(result).toEqual({
    ant: 7,
    arm: 2,
    car: 5,
    cat: 1,
    cup: 3,
    day: 3,
    dog: 2,
    dot: 1
  });
  await expect(page.locator('.flying-record')).toHaveCount(0);
});

test('pipeline history text contrasts with its entry surface', async ({
  page
}) => {
  await page.goto('/hadoop-map-side-pipeline-dual_nodes.html');
  const colors = await page
    .locator('.log-entry')
    .first()
    .evaluate((el) => {
      const css = getComputedStyle(el);
      return { text: css.color, background: css.backgroundColor };
    });
  expect(colors.text).not.toBe(colors.background);
});
