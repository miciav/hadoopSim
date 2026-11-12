import { test, expect } from './fixtures.js';

const skins = ['lecture', 'lecture-dark'];

for (const skin of skins) {
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
        await page
          .getByRole('button', { name: 'Upload File', exact: true })
          .click();
        await page.locator('.workload-controls > summary').click();
        await page.getByRole('button', { name: /Submit Simple Job/i }).click();
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
        if (file === 'hadoop_full.html') {
          await page.locator('.workload-controls > summary').click();
          await page
            .getByRole('button', { name: /Submit Simple Job/i })
            .click();
        }
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

for (const [width, height] of [
  [1440, 810],
  [1024, 768],
  [390, 844]
]) {
  test(`teaching controls and explanation remain available at ${width} × ${height}`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/hadoopsim-teaching.html');
    if (width === 1024)
      await page.locator('button[data-format="standard"]').click();
    await page.getByRole('button', { name: 'Next Step', exact: true }).click();
    await expect(page.locator('.phase-callout-wrapper')).toBeVisible();
    await expect(page.locator('#stepCounter')).toHaveText(/^1 \//);
    const controls = await page.locator('.lesson-footer').boundingBox();
    expect(controls.x).toBeGreaterThanOrEqual(0);
    expect(controls.x + controls.width).toBeLessThanOrEqual(width + 1);
    if (width > 800)
      expect(controls.y + controls.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
  });
}
