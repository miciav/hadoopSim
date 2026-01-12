import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, initHeightSync } from '../../../assets/js/pipeline-dual-nodes/engine.js';
import { CLEARABLE_CONTAINERS, ELEMENT_IDS } from '../../../assets/js/pipeline-dual-nodes/dom/selectors.js';
import { setupMockDom, createElement, MockResizeObserver } from './dom-helpers.js';

test('createSimulation reset restores state and enables start button', () => {
  const { document, restore } = setupMockDom();
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
  const startBtn = createElement(document, { id: ELEMENT_IDS.START_BTN });

  CLEARABLE_CONTAINERS.forEach(id => createElement(document, { id }));

  const simulation = createSimulation();
  const oldState = simulation.getState();
  startBtn.disabled = true;

  simulation.reset();
  const newState = simulation.getState();

  assert.notEqual(oldState, newState);
  assert.equal(startBtn.disabled, false);

  restore();
});

test('createSimulation stop flips running flag', () => {
  const { restore } = setupMockDom();
  const simulation = createSimulation();
  simulation.getState().running = true;

  simulation.stop();
  assert.equal(simulation.getState().running, false);

  restore();
});

test('initHeightSync normalizes heights across groups', () => {
  const { document, restore } = setupMockDom();
  global.ResizeObserver = MockResizeObserver;

  const boxA = createElement(document, { id: 'boxInput0' });
  const boxB = createElement(document, { id: 'boxInput1' });
  boxA.scrollHeight = 120;
  boxB.scrollHeight = 80;

  initHeightSync();

  assert.equal(MockResizeObserver.instances.length, 1);
  MockResizeObserver.instances[0].callback();

  assert.equal(boxA.style.minHeight, '120px');
  assert.equal(boxB.style.minHeight, '120px');

  restore();
});
