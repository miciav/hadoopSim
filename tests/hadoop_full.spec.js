import { test, expect } from '@playwright/test';
import { getClusterSnapshot } from './helpers.js';

const seedRandom = (seedValue) => () => {
  let seed = seedValue;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
};

test('Full HDFS replication and storage bounds', async ({ page }) => {
  await page.addInitScript(seedRandom(7));
  await page.goto('/hadoop_full.html');

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
    expect(node.storageUsedMb).toBeGreaterThanOrEqual(0);
    expect(node.storageUsedMb).toBeLessThanOrEqual(node.storageTotalMb);
  });
});

test('MapReduce allocates one mapper per block and prefers locality', async ({ page }) => {
  await page.addInitScript(seedRandom(11));
  await page.goto('/hadoop_full.html');

  await page.evaluate(() => {
    uploadFile();
    runMapReduce();
  });

  const snapshot = await getClusterSnapshot(page);
  const job = snapshot.mapReduceJobs[0];
  expect(job).toBeTruthy();

  const file = snapshot.files.find((entry) => entry.name === job.fileName);
  expect(file).toBeTruthy();
  expect(job.mappers.length).toBe(file.blocks.length);
  expect(job.status).toBe('running');

  const localityCount = job.mappers.filter((mapper) => {
    const node = snapshot.nodes.find((entry) => entry.id === mapper.nodeId);
    return node && node.blocks.some((block) => block.id === mapper.blockId);
  }).length;

  expect(localityCount).toBeGreaterThan(0);
  expect(localityCount / job.mappers.length).toBeGreaterThanOrEqual(0.5);
});

test('MapReduce failure reschedules or marks mappers on failed nodes', async ({ page }) => {
  await page.addInitScript(seedRandom(21));
  await page.goto('/hadoop_full.html');

  await page.evaluate(() => {
    uploadFile();
    runMapReduce();
  });

  await page.evaluate(() => simulateFailure());

  const snapshot = await getClusterSnapshot(page);
  const failedNode = snapshot.nodes.find((node) => node.failed);
  expect(failedNode).toBeTruthy();

  const job = snapshot.mapReduceJobs[0];
  expect(job).toBeTruthy();

  const activeOnFailed = job.mappers.filter(
    (mapper) => mapper.nodeId === failedNode.id && mapper.progress >= 0
  );
  expect(activeOnFailed.length).toBe(0);

  snapshot.nodes.forEach((node) => {
    expect(node.cpuUsed).toBeGreaterThanOrEqual(0);
    expect(node.cpuUsed).toBeLessThanOrEqual(node.cpuTotal);
    expect(node.memoryUsedMb).toBeGreaterThanOrEqual(0);
    expect(node.memoryUsedMb).toBeLessThanOrEqual(node.memoryTotalMb);
  });
});

test('MapReduce completes and releases resources', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 17;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const nativeSetInterval = window.setInterval;
    window.setInterval = (fn, ms, ...args) => nativeSetInterval(fn, Math.min(ms, 20), ...args);
  });

  await page.goto('/hadoop_full.html');

  await page.evaluate(() => {
    uploadFile();
    runMapReduce();
  });

  await page.waitForFunction(
    () => cluster.mapReduceJobs.length > 0 && cluster.mapReduceJobs[0].status !== 'running',
    null,
    { timeout: 6000 }
  );

  const snapshot = await getClusterSnapshot(page);
  const job = snapshot.mapReduceJobs[0];
  expect(job.status).toBe('completed');

  const activeMapReduce = snapshot.nodes.flatMap((node) =>
    node.containers.filter((container) => container.isMapReduce)
  );
  expect(activeMapReduce.length).toBe(0);
});
