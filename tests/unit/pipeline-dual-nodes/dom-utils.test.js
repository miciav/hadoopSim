import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightNodes, highlightBoxes, setNetworkActive } from '../../../assets/js/pipeline-dual-nodes/dom/highlights.js';
import { foldIntermediateRows, unfoldIntermediateRows } from '../../../assets/js/pipeline-dual-nodes/dom/fold.js';
import { log, clearLog } from '../../../assets/js/pipeline-dual-nodes/dom/log.js';
import { resetState, resetUI } from '../../../assets/js/pipeline-dual-nodes/dom/reset.js';
import { ELEMENT_IDS, CLEARABLE_CONTAINERS } from '../../../assets/js/pipeline-dual-nodes/dom/selectors.js';
import { setupMockDom, createElement, useImmediateTimers } from './dom-helpers.js';

test('highlightNodes activates selected nodes and updates phase', () => {
  const { document, restore } = setupMockDom();
  const node01 = createElement(document, { id: ELEMENT_IDS.NODE_01, className: 'node-container' });
  const node02 = createElement(document, { id: ELEMENT_IDS.NODE_02, className: 'node-container active-node' });
  const phase = createElement(document, { id: ELEMENT_IDS.PHASE });

  highlightNodes([ELEMENT_IDS.NODE_01], 'Map Phase');

  assert.ok(node01.classList.contains('active-node'));
  assert.ok(!node02.classList.contains('active-node'));
  assert.equal(phase.textContent, 'Map Phase');

  restore();
});

test('highlightBoxes sets active class only on specified boxes', () => {
  const { document, restore } = setupMockDom();
  const boxA = createElement(document, { id: 'boxA', className: 'box-content active' });
  const boxB = createElement(document, { id: 'boxB', className: 'box-content' });

  highlightBoxes(['boxB']);

  assert.ok(!boxA.classList.contains('active'));
  assert.ok(boxB.classList.contains('active'));

  restore();
});

test('setNetworkActive toggles network visuals', () => {
  const { document, restore } = setupMockDom();
  const layer = createElement(document, { id: ELEMENT_IDS.NETWORK_LAYER });
  const pulse = createElement(document, { id: ELEMENT_IDS.NET_PULSE });

  setNetworkActive(true);
  assert.equal(layer.style.borderColor, '#3b82f6');
  assert.ok(pulse.classList.contains('active'));

  setNetworkActive(false);
  assert.equal(layer.style.borderColor, '#475569');
  assert.ok(!pulse.classList.contains('active'));

  restore();
});

test('foldIntermediateRows and unfoldIntermediateRows toggle row state', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const row = createElement(document, { className: 'node-row' });
  const spillBox = createElement(document, { id: 'boxSpill0', parent: row });
  const mergeBox = createElement(document, { id: 'boxMerge0', parent: row });
  const mapBox = createElement(document, { id: 'boxMap0', parent: row });

  await foldIntermediateRows();

  assert.ok(row.classList.contains('folded'));

  unfoldIntermediateRows();
  assert.ok(!row.classList.contains('folded'));

  restoreTimers();
  restore();
});

test('log appends entries and clearLog resets console', () => {
  const { document, restore } = setupMockDom();
  const consoleEl = createElement(document, { id: ELEMENT_IDS.CONSOLE_LOG });

  clearLog();
  assert.ok(consoleEl.innerHTML.includes('Cluster Daemon Started'));

  log('Test message', 'SYS');
  assert.equal(consoleEl.children.length, 1);

  for (let i = 0; i < 40; i++) {
    log(`Message ${i}`, 'MAP');
  }
  assert.ok(consoleEl.children.length <= 30);

  restore();
});

test('resetState clears simulation collections', () => {
  const { restore } = setupMockDom();
  const state = {
    running: true,
    shuffleComplete: true,
    mappers: [
      { id: 0, buffer: [{ k: 'cat' }], spills: [[{ k: 'cat' }]], final: [{ k: 'cat' }], data: [{ k: 'cat' }], _mergeAll: [{ k: 'cat' }] },
      { id: 1, buffer: [{ k: 'dog' }], spills: [[{ k: 'dog' }]], final: [{ k: 'dog' }], data: [{ k: 'dog' }], _mergeAll: [{ k: 'dog' }] }
    ],
    reducers: { 0: [{ k: 'cat' }], 1: [], 2: [] },
    reduceOutput: { 0: [{ k: 'cat' }], 1: [], 2: [] }
  };

  resetState(state);

  assert.equal(state.shuffleComplete, false);
  assert.equal(state.mappers[0].buffer.length, 0);
  assert.equal(state.mappers[0].spills.length, 0);
  assert.equal(state.mappers[0].final.length, 0);
  assert.equal(state.mappers[0]._mergeAll, null);
  assert.equal(state.reducers[0].length, 0);
  assert.equal(state.reduceOutput[0].length, 0);

  restore();
});

test('resetUI restores counters and inputs', () => {
  const { document, restore } = setupMockDom();
  const state = {
    running: false,
    shuffleComplete: true,
    mappers: [
      { id: 0, buffer: [], spills: [], final: [], data: [{ k: 'cat', c: 'bg-p0' }] },
      { id: 1, buffer: [], spills: [], final: [], data: [{ k: 'dog', c: 'bg-p1' }] }
    ],
    reducers: { 0: [{ k: 'cat' }], 1: [], 2: [] },
    reduceOutput: { 0: [{ k: 'cat' }], 1: [], 2: [] }
  };

  createElement(document, { id: ELEMENT_IDS.CONSOLE_LOG });
  createElement(document, { id: ELEMENT_IDS.RECORDS_COUNT });
  createElement(document, { id: ELEMENT_IDS.SPILLS_COUNT });
  createElement(document, { id: ELEMENT_IDS.NET_COUNT });
  createElement(document, { id: ELEMENT_IDS.PROGRESS_FILL });
  createElement(document, { id: ELEMENT_IDS.NETWORK_LAYER });
  createElement(document, { id: ELEMENT_IDS.NET_PULSE });
  createElement(document, { id: ELEMENT_IDS.BOX_INPUT_0 });
  createElement(document, { id: ELEMENT_IDS.BOX_INPUT_1 });
  createElement(document, { id: ELEMENT_IDS.FILL_0 });
  createElement(document, { id: ELEMENT_IDS.FILL_1 });
  createElement(document, { id: ELEMENT_IDS.PCT_0 });
  createElement(document, { id: ELEMENT_IDS.PCT_1 });

  CLEARABLE_CONTAINERS.forEach(id => createElement(document, { id }));

  resetUI(state);

  assert.equal(document.getElementById(ELEMENT_IDS.RECORDS_COUNT).innerText, '0');
  assert.equal(document.getElementById(ELEMENT_IDS.SPILLS_COUNT).innerText, '0');
  assert.equal(document.getElementById(ELEMENT_IDS.NET_COUNT).innerText, '0');
  assert.equal(document.getElementById(ELEMENT_IDS.PROGRESS_FILL).style.width, '0%');

  const input0 = document.getElementById(ELEMENT_IDS.BOX_INPUT_0);
  const input1 = document.getElementById(ELEMENT_IDS.BOX_INPUT_1);
  assert.equal(input0.querySelectorAll('.kv-record').length, 1);
  assert.equal(input1.querySelectorAll('.kv-record').length, 1);

  restore();
});
