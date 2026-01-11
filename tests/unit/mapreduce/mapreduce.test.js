import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../../assets/js/hadoop-sim/state.js';
import { createSeededRng } from '../../../assets/js/hadoop-sim/random.js';
import { createManualClock } from '../../../assets/js/hadoop-sim/clock.js';
import { createHdfsEngine } from '../../../assets/js/hadoop-sim/hdfs.js';
import { createYarnEngine } from '../../../assets/js/hadoop-sim/yarn.js';
import { createMapReduceEngine } from '../../../assets/js/hadoop-sim/mapreduce.js';

function setupSimulation() {
  const state = createInitialState({
    nodeCount: 3,
    replicationFactor: 2,
    blockSizeMb: 100,
    nodeTemplate: {
      cpuTotal: 8,
      memoryTotalMb: 16384,
      storageTotalMb: 10000
    },
    mapReduce: {
      mapperIntervalMs: 100
    }
  });
  const rng = createSeededRng(21);
  const clock = createManualClock(0);
  const hdfs = createHdfsEngine({ state, rng });
  const yarn = createYarnEngine({ state, rng });
  const mapreduce = createMapReduceEngine({
    state,
    rng,
    clock,
    allocateContainer: yarn.allocateContainer,
    releaseContainer: yarn.releaseContainer
  });

  return { state, rng, clock, hdfs, yarn, mapreduce };
}

test('MapReduce allocates one mapper per block with locality preference', () => {
  const { state, hdfs, mapreduce } = setupSimulation();

  hdfs.uploadFile(220);
  const job = mapreduce.runJob({});

  assert.ok(job);
  assert.equal(job.status, 'running');

  const file = state.files.find((entry) => entry.name === job.fileName);
  assert.ok(file);
  assert.equal(job.mappers.length, file.blocks.length);

  const locality = job.mappers.filter((mapper) => {
    const node = state.nodes.find((entry) => entry.id === mapper.nodeId);
    return node && node.blocks.some((block) => block.id === mapper.blockId);
  }).length;

  assert.ok(locality > 0);
  assert.ok(locality / job.mappers.length >= 0.5);
});

test('MapReduce reschedules or marks mappers after node failure', () => {
  const { state, hdfs, mapreduce } = setupSimulation();

  hdfs.uploadFile(200);
  const job = mapreduce.runJob({});

  const failedNodeId = job.mappers[0].nodeId;
  mapreduce.handleNodeFailure(failedNodeId);

  const activeOnFailed = job.mappers.filter(
    (mapper) => mapper.nodeId === failedNodeId && mapper.progress >= 0
  );
  assert.equal(activeOnFailed.length, 0);
});

test('MapReduce completes and releases resources', () => {
  const { state, hdfs, mapreduce, clock } = setupSimulation();

  hdfs.uploadFile(200);
  const job = mapreduce.runJob({});

  clock.advance(2000);

  assert.equal(job.status, 'completed');

  const activeMapReduce = state.nodes.flatMap((node) =>
    node.containers.filter((container) => container.isMapReduce)
  );
  assert.equal(activeMapReduce.length, 0);

  const amContainers = state.nodes.flatMap((node) =>
    node.containers.filter((container) => container.name === `AM-${job.name}`)
  );
  assert.equal(amContainers.length, 0);
});
