import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../../assets/js/hadoop-sim/state.js';

test('createInitialState builds nodes from config', () => {
  const state = createInitialState({
    nodeCount: 2,
    nodeTemplate: {
      cpuTotal: 4,
      memoryTotalMb: 8192,
      storageTotalMb: 51200,
      namePrefix: 'DataNode-'
    }
  });

  assert.equal(state.nodes.length, 2);
  assert.equal(state.nodes[0].name, 'DataNode-1');
  assert.equal(state.nodes[1].cpuTotal, 4);
  assert.equal(state.nodes[1].memoryTotalMb, 8192);
  assert.equal(state.nodes[1].storageTotalMb, 51200);
  assert.equal(state.nodes[1].storageUsedMb, 0);
});

test('createInitialState includes counters and queues', () => {
  const state = createInitialState();
  assert.deepEqual(state.counters, {
    file: 1,
    block: 1,
    job: 1,
    mapReduce: 1
  });
  assert.deepEqual(state.files, []);
  assert.deepEqual(state.yarnQueue, []);
  assert.deepEqual(state.mapReduceQueue, []);
});
