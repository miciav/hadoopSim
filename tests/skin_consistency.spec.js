import { test, expect } from './fixtures.js';

const pages = [
  'index.html',
  'hadoop_full.html',
  'hdfs_interactive.html',
  'yarn_interactive.html',
  'hadoop-ecosystem-simulator.html',
  'hadoop-map-side-pipeline-dual_nodes.html',
  'hadoopsim-teaching.html',
  'hadoop-map-side-pipeline.html',
  'hadoop-map-side-pipeline-dual.html'
];
const skins = [
  'hadoop',
  'classroom',
  'focus',
  'topology',
  'lecture',
  'lecture-dark'
];

for (const skin of skins) {
  for (const width of [1440, 390]) {
    test(`${skin} shares control styling and title scale at ${width}px`, async ({
      page
    }, testInfo) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(
        (value) => localStorage.setItem('hadoopSim.skin', value),
        skin
      );
      let reference;
      for (const file of pages) {
        await page.goto(`/${file}`);
        const action = page
          .locator('.card a:visible, button:visible:not(:disabled)')
          .first();
        const styles = await action.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            font: s.fontFamily,
            size: s.fontSize,
            line: s.lineHeight,
            padding: s.padding,
            radius: s.borderRadius,
            shadow: s.boxShadow,
            minHeight: s.minHeight
          };
        });
        const title = await page
          .locator('h1')
          .evaluate((el) => getComputedStyle(el).fontSize);
        if (!reference) reference = { styles, title };
        expect(styles, `${file} action`).toEqual(reference.styles);
        expect(title, `${file} heading`).toBe(reference.title);
        await action.hover();
        expect(
          await action.evaluate((el) => getComputedStyle(el).boxShadow),
          `${file} hover shadow`
        ).toBe(reference.styles.shadow);
        const field = page
          .locator(
            'select:visible, input:visible:not([type=range]):not([type=checkbox]):not([type=radio])'
          )
          .first();
        if (await field.count()) {
          const actual = await field.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              size: s.fontSize,
              radius: s.borderRadius,
              padding: s.padding,
              minHeight: s.minHeight
            };
          });
          // WebKit exposes internal menulist defaults through CSSOM even with appearance:none.
          if (await field.evaluate((el) => el.tagName === 'SELECT')) {
            const bounds = await field.boundingBox();
            expect(bounds.height, `${file} rendered select height`).toBeCloseTo(
              parseFloat(reference.styles.minHeight),
              0
            );
          } else {
            expect(actual, `${file} field`).toEqual({
              size: reference.styles.size,
              radius: reference.styles.radius,
              padding: reference.styles.padding,
              minHeight: reference.styles.minHeight
            });
          }
          await field.focus();
          expect(
            await field.evaluate((el) => getComputedStyle(el).boxShadow),
            `${file} focused field`
          ).toBe('none');
        }
        await page.screenshot({
          path: testInfo.outputPath(`${file}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    });
  }
  test(`${skin} uses the same resource roles in every cluster view`, async ({
    page
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    const colors = {};
    for (const file of [
      'hadoop-ecosystem-simulator.html',
      'hadoop_full.html',
      'hdfs_interactive.html',
      'yarn_interactive.html'
    ]) {
      await page.goto(`/${file}`);
      if (file === 'hadoop-ecosystem-simulator.html') {
        await page.getByRole('button', { name: /Upload 256 MB/i }).click();
        await page.getByRole('button', { name: /Run on file-1.dat/i }).click();
      } else if (file === 'yarn_interactive.html') {
        await page.getByRole('button', { name: /Submit New Job/i }).click();
      } else {
        await page
          .getByRole('button', {
            name:
              file === 'hdfs_interactive.html'
                ? /Upload Small File/i
                : /Upload File/i
          })
          .click();
        if (file === 'hadoop_full.html')
          await page
            .getByRole('button', { name: /Submit Simple Job/i })
            .click();
      }
      for (const role of file === 'hdfs_interactive.html'
        ? ['storage']
        : file === 'yarn_interactive.html'
          ? ['cpu', 'memory']
          : ['cpu', 'memory', 'storage']) {
        const bar = page.locator(`.${role}-fill`).first();
        await expect(bar, `${file}: ${role}`).toHaveCount(1);
        await expect
          .poll(() =>
            page
              .locator(`.${role}-fill`)
              .evaluateAll((elements) =>
                elements.some((el) => el.getBoundingClientRect().width > 0)
              )
          )
          .toBe(true);
        const rendered = await page
          .locator(`.${role}-fill`)
          .evaluateAll((elements) => {
            const el = elements.find(
              (item) => item.getBoundingClientRect().width > 0
            );
            return el
              ? {
                  color: getComputedStyle(el).backgroundColor,
                  width: el.getBoundingClientRect().width
                }
              : null;
          });
        expect(rendered, `${file} visible ${role}`).not.toBeNull();
        const color = rendered.color;
        expect(color).not.toBe('rgba(0, 0, 0, 0)');
        if (!colors[role]) colors[role] = color;
        expect(color, `${file}: ${role}`).toBe(colors[role]);
      }
    }
    expect(new Set(Object.values(colors)).size).toBe(3);
    await page.goto('/hadoop_full.html');
    await page.evaluate(() => {
      const sim = window.simulation;
      const node = sim.state.nodes[0];
      sim.actions.submitYarnJob({
        name: 'high-load',
        cpu: node.cpuTotal,
        memoryMb: node.memoryTotalMb,
        preferredNodeIds: [node.id]
      });
    });
    const warning = page.locator('.cpu-fill.warning').first();
    await expect(warning).toHaveCount(1);
    const color = await warning.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const expectedWarning = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.background = 'var(--sim-warning)';
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    expect(color).toBe(expectedWarning);
    expect(
      await warning.evaluate((el) => el.getBoundingClientRect().width)
    ).toBeGreaterThan(0);
  });
}

for (const skin of skins) {
  test(`${skin} uses consistent resting cluster node geometry`, async ({
    page
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let reference;
    let panelReference;
    for (const file of [
      'hadoop_full.html',
      'hdfs_interactive.html',
      'yarn_interactive.html',
      'hadoop-ecosystem-simulator.html'
    ]) {
      await page.goto(`/${file}`);
      const style = await page
        .locator('.node, .datanode')
        .first()
        .evaluate((el) => {
          const css = getComputedStyle(el);
          return {
            radius: css.borderRadius,
            padding: css.padding,
            background: css.backgroundColor,
            shadow: css.boxShadow
          };
        });
      if (!reference) reference = style;
      expect(style, file).toEqual(reference);
      const panel = await page
        .locator('.cluster-panel, .cluster-view')
        .first()
        .evaluate((el) => {
          const css = getComputedStyle(el);
          return {
            radius: css.borderRadius,
            shadow: css.boxShadow,
            padding: css.padding
          };
        });
      if (!panelReference) panelReference = panel;
      expect(panel, `${file} cluster panel`).toEqual(panelReference);
    }
  });
}

for (const skin of skins) {
  test(`${skin} preserves disabled controls and normal-motion shadow styling`, async ({
    page
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/hadoop-map-side-pipeline.html');
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    expect(
      await page
        .locator('#pauseBtn')
        .evaluate((el) => getComputedStyle(el).boxShadow)
    ).toBe('none');
    await page.goto('/hadoopsim-teaching.html');
    const shadows = await page.locator('#stepBtn').evaluate((el) =>
      el
        .getAnimations()
        .flatMap((animation) => animation.effect.getKeyframes())
        .filter((frame) => frame.boxShadow && frame.boxShadow !== 'none')
    );
    expect(
      shadows,
      'primary action must not animate legacy colored shadows'
    ).toEqual([]);
  });
}

for (const skin of skins) {
  test(`${skin} teaching controller does not cover the narrow diagram`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      (value) => localStorage.setItem('hadoopSim.skin', value),
      skin
    );
    await page.goto('/hadoopsim-teaching.html');
    const controller = await page.locator('.step-console').boundingBox();
    const diagram = await page
      .getByRole('region', { name: 'Simulation diagram' })
      .boundingBox();
    expect(controller.y + controller.height).toBeLessThanOrEqual(diagram.y);
    const title = await page.locator('h1').boundingBox();
    expect(controller.y).toBeGreaterThanOrEqual(title.y + title.height);
    expect(diagram.y - controller.y - controller.height).toBeLessThan(60);
    expect(
      await page
        .locator('#stepBtn')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    ).toBe(true);
    await expect(page.getByRole('button', { name: 'Next Step' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(391);
  });
}
