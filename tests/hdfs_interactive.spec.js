import { test, expect } from '@playwright/test';
import { getClusterSnapshot } from './helpers.js';

const seedRandom = (seedValue) => () => {
  let seed = seedValue;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
};

test('HDFS replication factor preserved when space is available', async ({ page }) => {
  await page.addInitScript(seedRandom(42));
  await page.goto('/hdfs_interactive.html');

  await page.evaluate(() => uploadFile());

  const snapshot = await getClusterSnapshot(page);
  const rf = await page.evaluate(() => REPLICATION_FACTOR);

  const counts = {};
  snapshot.nodes.forEach((node) => {
    node.blocks.forEach((block) => {
      counts[block.id] = (counts[block.id] || 0) + 1;
    });
  });

  const file = snapshot.files[0];
  expect(file).toBeTruthy();
  file.blocks.forEach((block) => {
    expect(counts[block.id]).toBe(rf);
  });

  snapshot.nodes.forEach((node) => {
    const ids = node.blocks.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

test('HDFS avoids failed nodes and keeps storage within bounds', async ({ page }) => {
  await page.addInitScript(seedRandom(123));
  await page.goto('/hdfs_interactive.html');

  await page.evaluate(() => simulateNodeFailure());
  await page.evaluate(() => uploadFile());

  const snapshot = await getClusterSnapshot(page);
  const failedNode = snapshot.nodes.find((node) => node.failed);
  expect(failedNode).toBeTruthy();

  const latestFile = snapshot.files[snapshot.files.length - 1];
  expect(latestFile).toBeTruthy();

  const failedBlockIds = new Set(failedNode.blocks.map((block) => block.id));
  const overlaps = latestFile.blocks.some((block) => failedBlockIds.has(block.id));
  expect(overlaps).toBe(false);

  snapshot.nodes.forEach((node) => {
    expect(node.storageUsedMb).toBeGreaterThanOrEqual(0);
    expect(node.storageUsedMb).toBeLessThanOrEqual(node.storageTotalMb);
  });
});

test('HDFS rolls back partial uploads when space runs out', async ({ page }) => {
  await page.addInitScript(seedRandom(7));
  await page.goto('/hdfs_interactive.html');

  await page.evaluate(() => {
    resetCluster();
    cluster.nodes.forEach((node) => {
      node.storageTotalMb = 200;
      node.storageUsedMb = 0;
      node.blocks = [];
    });
    cluster.files = [];
    cluster.blockCounter = 1;
    cluster.fileCounter = 1;
    renderCluster();
  });

  await page.evaluate(() => uploadLargeFile());

  const snapshot = await getClusterSnapshot(page);
  const expectedFileName = 'largefile1.dat';
  const file = snapshot.files.find((entry) => entry.name === expectedFileName);
  expect(file).toBeUndefined();

  const leakedBlocks = snapshot.nodes.flatMap((node) =>
    node.blocks.filter((block) => block.fileName === expectedFileName)
  );
  expect(leakedBlocks.length).toBe(0);

  snapshot.nodes.forEach((node) => {
    expect(node.storageUsedMb).toBe(0);
  });
});
