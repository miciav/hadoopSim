import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecordElement,
  createInputRecordElement,
  showRecord,
  markAsGhost,
  markAsPersistent,
  turnActiveToGhosts,
  turnActiveToPersistent,
  clearRecords,
  clearFlyingRecords
} from '../../../assets/js/pipeline-dual-nodes/dom/records.js';
import { setupMockDom, createElement } from './dom-helpers.js';

test('createRecordElement renders key and count', () => {
  const { restore } = setupMockDom();

  const record = createRecordElement({ k: 'cat', c: 'bg-p0' }, 2);
  assert.equal(record.textContent, 'cat:2');
  assert.ok(record.classList.contains('kv-record'));
  assert.ok(record.classList.contains('bg-p0'));

  restore();
});

test('createInputRecordElement adds persistent class and id', () => {
  const { restore } = setupMockDom();

  const record = createInputRecordElement({ k: 'dog', c: 'bg-p1' }, 'src-1-0');
  assert.equal(record.id, 'src-1-0');
  assert.ok(record.classList.contains('persistent'));
  assert.equal(record.textContent, 'dog');

  restore();
});

test('record state helpers toggle classes', () => {
  const { restore } = setupMockDom();
  const record = createRecordElement({ k: 'cat', c: 'bg-p0' });
  record.classList.add('show');

  showRecord(record);
  assert.ok(record.classList.contains('show'));

  markAsGhost(record);
  assert.ok(record.classList.contains('ghost'));
  assert.ok(!record.classList.contains('show'));

  markAsPersistent(record);
  assert.ok(record.classList.contains('persistent'));
  assert.ok(!record.classList.contains('show'));

  restore();
});

test('turnActiveToGhosts and turnActiveToPersistent filter records', () => {
  const { document, restore } = setupMockDom();
  const container = createElement(document, { id: 'container' });

  const active = createRecordElement({ k: 'cat', c: 'bg-p0' });
  const ghost = createRecordElement({ k: 'dog', c: 'bg-p1' });
  ghost.classList.add('ghost');
  const persistent = createRecordElement({ k: 'ant', c: 'bg-p2' });
  persistent.classList.add('persistent');
  const reduceOutput = createRecordElement({ k: 'eel', c: 'bg-p0' });
  reduceOutput.classList.add('reduce-output');

  container.appendChild(active);
  container.appendChild(ghost);
  container.appendChild(persistent);
  container.appendChild(reduceOutput);

  turnActiveToGhosts(container);
  assert.ok(active.classList.contains('ghost'));
  assert.ok(ghost.classList.contains('ghost'));
  assert.ok(persistent.classList.contains('persistent'));
  assert.ok(!reduceOutput.classList.contains('ghost'));

  active.classList.remove('ghost');
  turnActiveToPersistent(container);
  assert.ok(active.classList.contains('persistent'));
  assert.ok(!reduceOutput.classList.contains('persistent'));

  restore();
});

test('clearRecords removes kv-record elements', () => {
  const { document, restore } = setupMockDom();
  const container = createElement(document, { id: 'container' });
  const record = createRecordElement({ k: 'cat', c: 'bg-p0' });
  container.appendChild(record);

  clearRecords(container);
  assert.equal(container.children.length, 0);

  restore();
});

test('clearFlyingRecords removes flying record elements', () => {
  const { document, restore } = setupMockDom();
  const flying = createElement(document, { className: 'flying-record' });
  const normal = createElement(document, { className: 'kv-record' });

  clearFlyingRecords();

  assert.equal(document.body.querySelectorAll('.flying-record').length, 0);
  assert.equal(document.body.querySelectorAll('.kv-record').length, 1);
  assert.equal(document.body.querySelectorAll('.kv-record')[0], normal);

  restore();
});
