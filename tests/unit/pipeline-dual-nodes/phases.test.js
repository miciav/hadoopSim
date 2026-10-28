import test from 'node:test';
import assert from 'node:assert/strict';
import { runMapper } from '../../../assets/js/pipeline-dual-nodes/phases/mapper.js';
import { runSpill } from '../../../assets/js/pipeline-dual-nodes/phases/spill.js';
import { runMergeAnimation, runMergeSortOutput } from '../../../assets/js/pipeline-dual-nodes/phases/merge.js';
import { runNetworkShuffle } from '../../../assets/js/pipeline-dual-nodes/phases/shuffle.js';
import { runReduce, runReduceMergeSort } from '../../../assets/js/pipeline-dual-nodes/phases/reduce.js';
import { runOutput } from '../../../assets/js/pipeline-dual-nodes/phases/output.js';
import { setupMockDom, createElement, useImmediateTimers } from './dom-helpers.js';

function createBaseState() {
  return {
    running: true,
    shuffleComplete: false,
    inputSplits: [[], []],
    mappers: [
      { id: 0, buffer: [], spills: [], final: [], data: [], _mergeAll: null },
      { id: 1, buffer: [], spills: [], final: [], data: [], _mergeAll: null }
    ],
    reducers: { 0: [], 1: [], 2: [] },
    reduceOutput: { 0: [], 1: [], 2: [] }
  };
}

test('runSpill stores combined spill data', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.mappers[0].buffer = [
    { k: 'cat', p: 0, c: 'bg-p0' },
    { k: 'cat', p: 0, c: 'bg-p0' }
  ];

  createElement(document, { id: 'buf0' });
  createElement(document, { id: 'spillA0' });

  let spillCount = 0;
  await runSpill(state, 0, 0, 1, {
    isRunning: () => true,
    onSpillCreated: () => { spillCount += 1; }
  });

  assert.equal(state.mappers[0].spills.length, 1);
  assert.equal(state.mappers[0].spills[0][0].count, 2);
  assert.equal(spillCount, 1);

  restoreTimers();
  restore();
});

test('runMapper processes records and triggers spill', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.mappers[0].data = [{ k: 'cat', p: 0, c: 'bg-p0' }];
  state.inputSplits[0] = [state.mappers[0].data];

  createElement(document, { id: 'buf0' });
  createElement(document, { id: 'fill0' });
  createElement(document, { id: 'pct0' });
  createElement(document, { id: 'boxSpill0' });
  createElement(document, { id: 'spillA0' });
  createElement(document, { id: 'src-0-0' });

  let processed = 0;
  await runMapper(state, 0, 1, 'node01', {
    isRunning: () => true,
    isTeaching: () => false,
    onRecordProcessed: () => { processed += 1; },
    onSpillCreated: () => {}
  });

  assert.equal(processed, 1);
  assert.equal(state.mappers[0].buffer.length, 0);
  assert.equal(state.mappers[0].spills.length, 1);
  assert.equal(document.getElementById('fill0').style.height, '0%');
  assert.ok(!document.getElementById('fill0').classList.contains('limit'));

  restoreTimers();
  restore();
});

test('runMergeAnimation captures merged records', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.mappers[0].spills = [[{ k: 'cat', p: 0, c: 'bg-p0', count: 1 }]];

  createElement(document, { id: 'spillA0' });
  createElement(document, { id: 'combineA0' });
  createElement(document, { id: 'finalA-p0' });

  await runMergeAnimation(state, 0, 1, () => true);

  assert.equal(state.mappers[0].final.length, 1);
  assert.equal(document.getElementById('finalA-p0').children.length, 1);

  restoreTimers();
  restore();
});

test('runMergeSortOutput ghosts source records without altering merged data', async () => {
  const { document, restore } = setupMockDom();
  const state = createBaseState();
  const record = { k: 'cat', p: 0, c: 'bg-p0', count: 2 };
  state.mappers[0].spills = [[record]];
  state.mappers[0].final = [record];
  const slot = createElement(document, { id: 'combineA0' });
  const item = createElement(document, { parent: slot });
  item.classList.add('kv-record');
  await runMergeSortOutput(state, 0, 1, () => true);
  assert.deepEqual(state.mappers[0].final, [record]);
  assert.ok(item.classList.contains('ghost'));
  restore();
});

test('runNetworkShuffle distributes records to reducers', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.mappers[0].final = [
    { k: 'cat', p: 0, c: 'bg-p0', count: 1 },
    { k: 'dog', p: 1, c: 'bg-p1', count: 1 }
  ];
  state.mappers[1].final = [
    { k: 'ant', p: 2, c: 'bg-p2', count: 1 }
  ];

  createElement(document, { id: 'finalA' });
  createElement(document, { id: 'finalB' });
  createElement(document, { id: 'netHub' });
  createElement(document, { id: 'red0' });
  createElement(document, { id: 'red1' });
  createElement(document, { id: 'red2' });

  let packets = 0;
  await runNetworkShuffle(state, 1, {
    isRunning: () => true,
    isTeaching: () => false,
    onNetPacket: () => { packets += 1; }
  });

  assert.equal(state.reducers[0].length, 1);
  assert.equal(state.reducers[1].length, 1);
  assert.equal(state.reducers[2].length, 1);
  assert.equal(packets, 3);

  restoreTimers();
  restore();
});

test('runReduce aggregates reducer data', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.reducers[0] = [
    { k: 'cat', count: 1, p: 0, c: 'bg-p0' },
    { k: 'cat', count: 2, p: 0, c: 'bg-p0' }
  ];

  createElement(document, { id: 'red0' });
  createElement(document, { id: 'red1' });
  createElement(document, { id: 'red2' });
  createElement(document, { id: 'red0Reduce' });
  createElement(document, { id: 'red1Reduce' });
  createElement(document, { id: 'red2Reduce' });

  await runReduce(state, 1, () => true);

  assert.equal(state.reduceOutput[0].length, 1);
  assert.equal(state.reduceOutput[0][0].count, 3);
  assert.ok(document.getElementById('red0Reduce').children.length >= 1);

  restoreTimers();
  restore();
});

test('runReduceMergeSort sorts reducer inputs by key', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.reducers[0] = [
    { k: 'dog', p: 0, c: 'bg-p0', count: 1, source: 1 },
    { k: 'ant', p: 0, c: 'bg-p0', count: 1, source: 0 },
    { k: 'cat', p: 0, c: 'bg-p0', count: 1, source: 1 }
  ];

  createElement(document, { id: 'red0' });
  createElement(document, { id: 'red0Segments' });
  createElement(document, { id: 'red0Seg0' });
  createElement(document, { id: 'red0Seg1' });
  createElement(document, { id: 'red0Merge' });

  await runReduceMergeSort(state, 1, () => true, () => true);

  assert.equal(state.reducers[0][0].k, 'ant');
  assert.equal(state.reducers[0][1].k, 'cat');
  assert.equal(state.reducers[0][2].k, 'dog');

  const box = document.getElementById('red0');
  const mergeBox = document.getElementById('red0Merge');
  assert.equal(mergeBox.children.length, 3);
  assert.equal(box.children.length, 0);

  restoreTimers();
  restore();
});

test('runOutput writes final records to HDFS outputs', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.reduceOutput[0] = [{ k: 'cat', count: 3, p: 0, c: 'bg-p0' }];

  createElement(document, { id: 'red0Reduce' });
  createElement(document, { id: 'red1Reduce' });
  createElement(document, { id: 'red2Reduce' });
  createElement(document, { id: 'hdfsOut0' });
  createElement(document, { id: 'hdfsOut1' });
  createElement(document, { id: 'hdfsOut2' });

  await runOutput(state, 1, () => true);

  const output = document.getElementById('hdfsOut0');
  assert.equal(output.children.length, 1);
  assert.ok(output.children[0].classList.contains('persistent'));

  restoreTimers();
  restore();
});

test('runMapper processes data even without a fill indicator', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  const record = { k: 'cat', p: 0, c: 'bg-p0' };
  state.mappers[0].data = [record];
  state.inputSplits[0] = [[record]];
  createElement(document, { id: 'buf0' });
  let processed = 0;
  try {
    await runMapper(state, 0, 1, 'node01', {
      isRunning: () => true, isTeaching: () => false,
      onRecordProcessed: () => { processed++; }, onSpillCreated: () => {}
    });
    assert.equal(processed, 1);
    assert.equal(state.mappers[0].spills[0][0].k, 'cat');
  } finally {
    restoreTimers();
    restore();
  }
});

test('mapper can process records without a DOM', async () => {
  const state = createBaseState();
  const record = { k: 'cat', p: 0, c: 'bg-p0' };
  state.mappers[0].data = [record];
  state.inputSplits[0] = [[record]];
  await runMapper(state, 0, 0, 'node01', {
    isRunning: () => true, isTeaching: () => false,
    onRecordProcessed: () => {}, onSpillCreated: () => {}
  });
  assert.deepEqual(state.mappers[0].spills.map(spill => spill.map(item => [item.k, item.count])), [[['cat', 1]]]);
});

test('automatic pipeline processes its default data without a DOM', async () => {
  const { createInitialState } = await import('../../../assets/js/pipeline-dual-nodes/state.js');
  const state = createInitialState();
  state.running = true;
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 1; };
  const callbacks = { isRunning: () => true, isTeaching: () => false,
    onRecordProcessed: () => {}, onSpillCreated: () => {}, onNetPacket: () => {} };
  try {
    await Promise.all([runMapper(state, 0, 0, 'node01', callbacks), runMapper(state, 1, 0, 'node02', callbacks)]);
    await Promise.all([runMergeAnimation(state, 0, 0, callbacks.isRunning), runMergeAnimation(state, 1, 0, callbacks.isRunning)]);
    await runNetworkShuffle(state, 0, callbacks);
    await runReduceMergeSort(state, 0, callbacks.isRunning, callbacks.isTeaching);
    await runReduce(state, 0, callbacks.isRunning);
    assert.deepEqual(Object.fromEntries(Object.values(state.reduceOutput).flat().map(record => [record.k, record.count])),
      { ant: 7, arm: 2, car: 5, cat: 1, cup: 3, day: 3, dog: 2, dot: 1 });
  } finally {
    globalThis.setTimeout = originalTimeout;
  }
});
