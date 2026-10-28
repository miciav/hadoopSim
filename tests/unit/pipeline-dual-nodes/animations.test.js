import test from 'node:test';
import assert from 'node:assert/strict';
import { wait, flyRecord, triggerCombineSweep } from '../../../assets/js/pipeline-dual-nodes/dom/animations.js';
import { setupMockDom, createElement, useImmediateTimers } from './dom-helpers.js';

test('wait resolves after timeout', async () => {
  const restoreTimers = useImmediateTimers();
  await wait(20);
  restoreTimers();
});

test('flyRecord is a no-op without source or target', async () => {
  const { document, restore } = setupMockDom();
  await flyRecord('missingSource', 'missingTarget', { k: 'cat' }, 10);
  assert.equal(document.body.children.length, 0);
  restore();
});

test('flyRecord removes flying element after animation', async () => {
  const { document, restore } = setupMockDom();
  const restoreTimers = useImmediateTimers();
  const source = createElement(document, { id: 'src' });
  const target = createElement(document, { id: 'tgt' });

  await flyRecord('src', 'tgt', { k: 'cat', c: 'bg-p0' }, 10);

  assert.equal(document.body.querySelectorAll('.flying-record').length, 0);
  assert.equal(source.children.length, 0);
  assert.equal(target.children.length, 0);

  restoreTimers();
  restore();
});

test('triggerCombineSweep adds and removes sweep element', () => {
  const { document, restore } = setupMockDom();
  const container = createElement(document, { id: 'target' });
  let pendingTimeout = null;
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => {
    pendingTimeout = fn;
    return 0;
  };

  triggerCombineSweep('target', 'sweep-amber');
  assert.equal(container.querySelectorAll('.combine-sweep').length, 1);

  pendingTimeout();
  assert.equal(container.querySelectorAll('.combine-sweep').length, 0);

  global.setTimeout = originalSetTimeout;
  restore();
});

test('abort cancels an animation wait and clears its timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  const pending = wait(10000, controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  t.mock.timers.tick(10000);
  await rejected;
});

test('abort removes combine sweep immediately', () => {
  const { document, restore } = setupMockDom();
  try {
    const container = createElement(document, { id: 'target' });
    const controller = new AbortController();
    triggerCombineSweep('target', 'sweep-amber', controller.signal);
    controller.abort();
    assert.equal(container.querySelectorAll('.combine-sweep').length, 0);
  } finally {
    restore();
  }
});
