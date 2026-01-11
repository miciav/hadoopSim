import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../../assets/js/hadoop-sim/state.js';
import { createSeededRng } from '../../../assets/js/hadoop-sim/random.js';
import { createHdfsEngine } from '../../../assets/js/hadoop-sim/hdfs.js';

function countReplicas(state, { includeFailed = true } = {}) {
  const counts = {};
  state.nodes.forEach((node) => {
    if (!includeFailed && node.failed) {
      return;
    }
    node.blocks.forEach((block) => {
      counts[block.id] = (counts[block.id] || 0) + 1;
    });
  });
  return counts;
}

test('HDFS maintains replication factor when space is available', () => {
  const state = createInitialState({
    nodeCount: 3,
    replicationFactor: 2,
    blockSizeMb: 100,
    nodeTemplate: { storageTotalMb: 1000 }
  });
  const hdfs = createHdfsEngine({ state, rng: createSeededRng(1) });

  const result = hdfs.uploadFile(220);
  assert.equal(result.ok, true);

  const counts = countReplicas(state);
  const file = state.files[0];
  file.blocks.forEach((block) => {
    assert.equal(counts[block.id], 2);
  });

  state.nodes.forEach((node) => {
    const ids = node.blocks.map((block) => block.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

test('HDFS avoids failed nodes for new allocations', () => {
  const state = createInitialState({
    nodeCount: 3,
    replicationFactor: 2,
    blockSizeMb: 100,
    nodeTemplate: { storageTotalMb: 1000 }
  });
  const hdfs = createHdfsEngine({ state, rng: createSeededRng(2) });

  hdfs.failNode(1);
  const result = hdfs.uploadFile(120);
  assert.equal(result.ok, true);

  const failedNode = state.nodes.find((node) => node.id === 1);
  assert.equal(failedNode.failed, true);
  const failedBlockIds = new Set(failedNode.blocks.map((block) => block.id));
  const file = state.files[0];
  const overlaps = file.blocks.some((block) => failedBlockIds.has(block.id));
  assert.equal(overlaps, false);
});

test('HDFS rolls back when no replica can be placed', () => {
  const state = createInitialState({
    nodeCount: 2,
    replicationFactor: 2,
    blockSizeMb: 100,
    nodeTemplate: { storageTotalMb: 50 }
  });
  const hdfs = createHdfsEngine({ state, rng: createSeededRng(3) });

  const result = hdfs.uploadFile(120);
  assert.equal(result.ok, false);
  assert.equal(state.files.length, 0);

  const leakedBlocks = state.nodes.flatMap((node) => node.blocks);
  assert.equal(leakedBlocks.length, 0);
});

test('HDFS re-replicates under-replicated blocks when possible', () => {
  const state = createInitialState({
    nodeCount: 3,
    replicationFactor: 2,
    blockSizeMb: 128,
    nodeTemplate: { storageTotalMb: 1000 }
  });
  const hdfs = createHdfsEngine({ state, rng: createSeededRng(4) });

  const result = hdfs.uploadFile(128);
  assert.equal(result.ok, true);

  const initialCounts = countReplicas(state);
  const blockId = state.files[0].blocks[0].id;
  assert.equal(initialCounts[blockId], 2);

  const holder = state.nodes.find((node) =>
    node.blocks.some((block) => block.id === blockId)
  );
  hdfs.failNode(holder.id);

  const summary = hdfs.reReplicate();
  assert.equal(summary.lost, 0);
  assert.ok(summary.reReplicated >= 1);

  const counts = countReplicas(state, { includeFailed: false });
  assert.equal(counts[blockId], 2);
});
