import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateBufferFill,
  setBufferLimit,
  resetBufferFill,
  resetAllBufferFills
} from '../../../assets/js/pipeline-dual-nodes/dom/buffers.js';
import { setupMockDom, createElement } from './dom-helpers.js';

test('updateBufferFill sets height and percentage label', () => {
  const { document, restore } = setupMockDom();
  const fill = createElement(document, { id: 'fill0' });
  const pct = createElement(document, { id: 'pct0' });

  updateBufferFill(0, 45);

  assert.equal(fill.style.height, '45%');
  assert.equal(pct.innerText, '45%');

  restore();
});

test('setBufferLimit toggles limit class', () => {
  const { document, restore } = setupMockDom();
  const fill = createElement(document, { id: 'fill0' });

  setBufferLimit(0, true);
  assert.ok(fill.classList.contains('limit'));

  setBufferLimit(0, false);
  assert.ok(!fill.classList.contains('limit'));

  restore();
});

test('resetBufferFill and resetAllBufferFills zero out fills', () => {
  const { document, restore } = setupMockDom();
  createElement(document, { id: 'fill0' });
  createElement(document, { id: 'pct0' });
  createElement(document, { id: 'fill1' });
  createElement(document, { id: 'pct1' });

  updateBufferFill(0, 50);
  updateBufferFill(1, 75);

  resetBufferFill(0);
  assert.equal(document.getElementById('fill0').style.height, '0%');
  assert.equal(document.getElementById('pct0').innerText, '0%');

  resetAllBufferFills();
  assert.equal(document.getElementById('fill1').style.height, '0%');
  assert.equal(document.getElementById('pct1').innerText, '0%');

  restore();
});
