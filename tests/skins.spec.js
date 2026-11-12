import { test, expect } from './fixtures.js';

const pages = [
  'index.html',
  'hadoop_full.html',
  'hadoop-ecosystem-simulator.html',
  'hdfs_interactive.html',
  'yarn_interactive.html',
  'hadoop-map-side-pipeline-dual_nodes.html',
  'hadoopsim-teaching.html',
  'hadoop-map-side-pipeline.html',
  'hadoop-map-side-pipeline-dual.html'
];

test('catalog exposes five distinct walkthroughs and navigation', async ({
  page
}) => {
  await page.goto('/index.html');
  await expect(page.locator('.module-card')).toHaveCount(5);
  await expect(page.locator('[data-skin-select]')).toHaveCount(0);
  await page
    .getByLabel('Simulator', { exact: true })
    .selectOption('hdfs_interactive.html');
  await expect(page).toHaveURL(/hdfs_interactive\.html$/);
  await expect(page.getByLabel('Simulator', { exact: true })).toHaveValue(
    'hdfs_interactive.html'
  );
});

for (const saved of ['hadoop', 'classroom', 'focus', 'topology', 'unknown']) {
  test(`old ${saved} preference opens the lecture interface`, async ({
    page
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      saved
    );
    await page.goto('/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'lecture');
  });
}

for (const failure of ['read', 'write', 'getter']) {
  test(`lecture shell handles unavailable ${failure} storage`, async ({
    page
  }) => {
    await page.addInitScript((mode) => {
      if (mode === 'getter')
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
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'lecture');
    await page.locator('button[data-format="standard"]').click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-format',
      'standard'
    );
  });
}

for (const skin of ['lecture', 'lecture-dark']) {
  test(`${skin} loads all maintained and legacy routes`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    const failed = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(response.url());
    });
    for (const file of pages) {
      await page.goto(`/${file}`);
      await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
      await expect(page.locator('[data-skin-select]')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--sim-surface')
            .trim()
        )
      ).not.toBe('');
    }
    expect(failed).toEqual([]);
  });
}

test('projection format persists across walkthrough navigation', async ({
  page
}) => {
  await page.goto('/index.html');
  await page.locator('button[data-format="standard"]').click();
  await page
    .getByLabel('Simulator', { exact: true })
    .selectOption('hadoopsim-teaching.html');
  await expect(page.locator('html')).toHaveAttribute('data-format', 'standard');
  await expect(page.locator('button[data-format="standard"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.locator('button[data-format="wide"]').click();
  await expect(page.locator('button[data-format="standard"]')).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

for (const [width, height] of [
  [1440, 810],
  [1024, 768],
  [390, 844]
]) {
  test(`walkthroughs keep page controls reachable at ${width} × ${height}`, async ({
    page
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    for (const file of pages.slice(0, 7)) {
      await page.goto(`/${file}`);
      if (width === 1024)
        await page.locator('button[data-format="standard"]').click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        ),
        file
      ).toBe(true);
      await expect(page.getByLabel('Simulator', { exact: true })).toBeVisible();
    }
  });
}

test('guided focus holds execution and reset clears the selection', async ({
  page
}) => {
  await page.goto('/hadoopsim-teaching.html');
  await page.locator('[data-phase="map"]').click();
  await expect(page.locator('html')).toHaveClass(/lecture-held/);
  await expect(page.locator('#stepBtn')).toBeDisabled();
  await expect(page.locator('#inspect-title')).toHaveText('Map buffer');
  await page.locator('#continueBtn').click();
  await expect(page.locator('html')).not.toHaveClass(/lecture-held/);
  await page.locator('#stepBtn').click();
  await expect(page.locator('#stepCounter')).toHaveText(/^1 \//);
  await page.locator('[data-phase="shuffle"]').click();
  await page.locator('#resetStepBtn').click();
  await expect(page.locator('#stepCounter')).toHaveText(/^0 \//);
  await expect(page.locator('.inspector-panel')).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/lecture-held/);
});

test('node highlighting survives a render and clears with Escape', async ({
  page
}) => {
  await page.goto('/hadoop_full.html');
  await page.locator('.node').first().press('Enter');
  await expect(page.locator('.lecture-selected')).toHaveCount(1);
  await page.getByRole('button', { name: 'Upload File', exact: true }).click();
  await expect(page.locator('.lecture-selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lecture-selected')).toHaveCount(0);
});

test('teaching clicker advances steps while editable controls keep arrow keys', async ({
  page
}) => {
  await page.goto('/hadoopsim-teaching.html');
  await page.keyboard.press('PageDown');
  await expect(page.locator('#stepCounter')).toHaveText(/^1 \//);
  await page.locator('#splitSizeInput').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stepCounter')).toHaveText(/^1 \//);
});

test('local lecture fonts load and failures retain an exclusive red role', async ({
  page
}) => {
  await page.goto('/hadoopsim-teaching.html');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check('16px "Atkinson Hyperlegible Next"')
    )
  ).toBe(true);
  const tokens = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const get = (name) => css.getPropertyValue(name).trim().toLowerCase();
    return {
      error: get('--sim-error'),
      others: [0, 1, 2, 3, 4, 5, 6, 7]
        .map((i) => get(`--sim-file-${i}`))
        .concat(
          [
            '--sim-warning',
            '--sim-success',
            '--sim-partition-0',
            '--sim-partition-1',
            '--sim-partition-2'
          ].map(get)
        )
    };
  });
  expect(tokens.others).not.toContain(tokens.error);
});
