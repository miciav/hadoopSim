import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENT_IDS,
  CLEARABLE_CONTAINERS,
  HEIGHT_SYNC_GROUPS,
  getBufferId,
  getFillId,
  getPctId,
  getBoxMapId,
  getBoxSpillId,
  getSpillSlotId,
  getFinalId,
  getSourceRecordId,
  getReducerId,
  getNodeRedId,
  getBoxRedId,
  getHdfsOutId,
  el
} from '../../../assets/js/pipeline-dual-nodes/dom/selectors.js';
import { setupMockDom, createElement } from './dom-helpers.js';

test('selector helpers build predictable IDs', () => {
  assert.equal(getBufferId(0), 'buf0');
  assert.equal(getFillId(1), 'fill1');
  assert.equal(getPctId(0), 'pct0');
  assert.equal(getBoxMapId(1), 'boxMap1');
  assert.equal(getBoxSpillId(0), 'boxSpill0');
  assert.equal(getSpillSlotId(1, 1), 'spillB1');
  assert.equal(getFinalId(0), 'finalA');
  assert.equal(getSourceRecordId(1, 3), 'src-1-3');
  assert.equal(getReducerId(2), 'red2');
  assert.equal(getNodeRedId(0), 'nodeRed0');
  assert.equal(getBoxRedId(2), 'boxRed2');
  assert.equal(getHdfsOutId(1), 'hdfsOut1');
});

test('el returns element by ID', () => {
  const { document, restore } = setupMockDom();
  const target = createElement(document, { id: ELEMENT_IDS.BOX_INPUT_0 });

  assert.equal(el(ELEMENT_IDS.BOX_INPUT_0), target);

  restore();
});

test('constants expose expected ids and groups', () => {
  assert.ok(ELEMENT_IDS.START_BTN);
  assert.ok(ELEMENT_IDS.NETWORK_LAYER);
  assert.ok(CLEARABLE_CONTAINERS.includes('finalA'));
  assert.ok(HEIGHT_SYNC_GROUPS.some(group => group.includes('boxInput0')));
});
