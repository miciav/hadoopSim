import test from 'node:test';
import assert from 'node:assert/strict';
import { runMapper } from '../../../assets/js/pipeline-dual-nodes/phases/mapper.js';
import { runSpill } from '../../../assets/js/pipeline-dual-nodes/phases/spill.js';
import { runMergeAnimation, runMergeCombine } from '../../../assets/js/pipeline-dual-nodes/phases/merge.js';
import { runNetworkShuffle } from '../../../assets/js/pipeline-dual-nodes/phases/shuffle.js';
import { runReduce } from '../../../assets/js/pipeline-dual-nodes/phases/reduce.js';
import { runOutput } from '../../../assets/js/pipeline-dual-nodes/phases/output.js';
import { setupMockDom, createElement, useImmediateTimers } from './dom-helpers.js';

function createBaseState() {
  return {
    running: true,
    shuffleComplete: false,
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
  createElement(document, { id: 'finalA' });

  await runMergeAnimation(state, 0, 1, () => true);

  assert.equal(state.mappers[0]._mergeAll.length, 1);
  assert.equal(document.getElementById('finalA').children.length, 1);

  restoreTimers();
  restore();
});

test('runMergeCombine writes final merged output', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.mappers[0].spills = [[{ k: 'cat', p: 0, c: 'bg-p0', count: 1 }]];
  state.mappers[0]._mergeAll = [
    { k: 'cat', p: 0, c: 'bg-p0', count: 1 },
    { k: 'cat', p: 0, c: 'bg-p0', count: 2 }
  ];

  createElement(document, { id: 'spillA0' });
  createElement(document, { id: 'finalA' });

  await runMergeCombine(state, 0, 1, () => true);

  assert.equal(state.mappers[0].final.length, 1);
  assert.equal(state.mappers[0].final[0].count, 3);

  restoreTimers();
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

  await runReduce(state, 1, () => true);

  assert.equal(state.reduceOutput[0].length, 1);
  assert.equal(state.reduceOutput[0][0].count, 3);
  assert.ok(document.getElementById('red0').children.length >= 1);

  restoreTimers();
  restore();
});

test('runOutput writes final records to HDFS outputs', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const state = createBaseState();
  state.reduceOutput[0] = [{ k: 'cat', count: 3, p: 0, c: 'bg-p0' }];

  createElement(document, { id: 'red0' });
  createElement(document, { id: 'red1' });
  createElement(document, { id: 'red2' });
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
