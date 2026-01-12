import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENT_IDS } from '../../../assets/js/pipeline-dual-nodes/dom/selectors.js';
import { setupMockDom, createElement, MockResizeObserver } from './dom-helpers.js';

test('initPipeline wires teaching mode and buttons', async () => {
  const { document, restore } = setupMockDom({ includeWindow: false });
  const { initPipeline } = await import('../../../assets/js/pipeline-dual-nodes/index.js');

  global.window = {
    scrollX: 0,
    scrollY: 0,
    requestAnimationFrame: callback => callback()
  };
  global.ResizeObserver = MockResizeObserver;

  const app = createElement(document, { className: 'app' });
  const teaching = createElement(document, { id: ELEMENT_IDS.TEACHING_MODE });
  teaching.checked = true;
  const startBtn = createElement(document, { id: ELEMENT_IDS.START_BTN });
  const resetBtn = createElement(document, { id: ELEMENT_IDS.RESET_BTN });

  const simulation = initPipeline();
  document.triggerDOMContentLoaded();

  assert.ok(app.classList.contains('teaching-mode-active'));

  let runCalled = false;
  let resetCalled = false;
  simulation.run = () => { runCalled = true; };
  simulation.reset = () => { resetCalled = true; };

  startBtn.dispatchEvent({ type: 'click' });
  resetBtn.dispatchEvent({ type: 'click' });

  assert.ok(runCalled);
  assert.ok(resetCalled);

  teaching.checked = false;
  teaching.dispatchEvent({ type: 'change', target: teaching });

  assert.ok(!app.classList.contains('teaching-mode-active'));

  restore();
});
