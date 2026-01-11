import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../../assets/js/hadoop-sim/state.js';
import { createSeededRng } from '../../../assets/js/hadoop-sim/random.js';
import { createYarnEngine } from '../../../assets/js/hadoop-sim/yarn.js';

test('YARN keeps resource usage within capacity', () => {
  const state = createInitialState({
    nodeCount: 2,
    nodeTemplate: {
      cpuTotal: 4,
      memoryTotalMb: 4096,
      storageTotalMb: 10000
    }
  });
  const yarn = createYarnEngine({ state, rng: createSeededRng(10) });

  yarn.submitJob({ name: 'Job-1', cpu: 2, memoryMb: 1024 });
  yarn.submitJob({ name: 'Job-2', cpu: 2, memoryMb: 2048 });
  yarn.submitJob({ name: 'Job-3', cpu: 2, memoryMb: 2048 });

  state.nodes.forEach((node) => {
    assert.ok(node.cpuUsed <= node.cpuTotal);
    assert.ok(node.memoryUsedMb <= node.memoryTotalMb);
  });
});

test('YARN queue drains when resources free up', () => {
  const state = createInitialState({
    nodeCount: 1,
    nodeTemplate: {
      cpuTotal: 2,
      memoryTotalMb: 2048,
      storageTotalMb: 10000
    }
  });
  const yarn = createYarnEngine({ state, rng: createSeededRng(11) });

  const jobA = yarn.submitJob({ name: 'Job-A', cpu: 2, memoryMb: 1024 });
  const jobB = yarn.submitJob({ name: 'Job-B', cpu: 2, memoryMb: 1024 });

  assert.equal(jobA.allocated, true);
  assert.equal(jobB.allocated, false);
  assert.equal(state.yarnQueue.length, 1);

  yarn.releaseContainer('Job-A');

  assert.equal(state.yarnQueue.length, 0);
  assert.equal(state.nodes[0].containers.length, 1);
  assert.equal(state.nodes[0].containers[0].name, 'Job-B');
});
