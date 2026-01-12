/**
 * UI reset functionality.
 */

import {
  el,
  ELEMENT_IDS,
  CLEARABLE_CONTAINERS,
  getSourceRecordId
} from './selectors.js';
import { clearLog } from './log.js';
import { resetAllBufferFills } from './buffers.js';
import { clearRecords, clearFlyingRecords, createInputRecordElement } from './records.js';
import { highlightNodes, setNetworkActive } from './highlights.js';
import { unfoldIntermediateRows } from './fold.js';

/**
 * Resets simulation state data structures while preserving running flag.
 * @param {Object} state - Simulation state
 */
export function resetState(state) {
  if (!state) return;

  state.shuffleComplete = false;

  if (Array.isArray(state.mappers)) {
    state.mappers = state.mappers.map((mapper, index) => ({
      ...mapper,
      id: mapper.id ?? index,
      buffer: [],
      spills: [],
      final: [],
      _mergeAll: null,
      data: Array.isArray(mapper.data) ? [...mapper.data] : []
    }));
  } else {
    state.mappers = [];
  }

  const reducerKeys = state.reducers ? Object.keys(state.reducers) : ['0', '1', '2'];
  state.reducers = reducerKeys.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
  state.reduceOutput = reducerKeys.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

/**
 * Resets all metrics counters to zero.
 */
export function resetMetrics() {
  [ELEMENT_IDS.RECORDS_COUNT, ELEMENT_IDS.SPILLS_COUNT, ELEMENT_IDS.NET_COUNT].forEach(id => {
    const elem = el(id);
    if (elem) elem.innerText = '0';
  });

  const progressEl = el(ELEMENT_IDS.PROGRESS_FILL);
  if (progressEl) progressEl.style.width = '0%';
}

/**
 * Clears all record containers.
 */
export function clearAllContainers() {
  CLEARABLE_CONTAINERS.forEach(id => {
    clearRecords(el(id));
  });
  clearFlyingRecords();
}

/**
 * Populates HDFS input boxes with source records.
 * @param {Object} state - Simulation state
 */
export function populateInputs(state) {
  const input0 = el(ELEMENT_IDS.BOX_INPUT_0);
  const input1 = el(ELEMENT_IDS.BOX_INPUT_1);

  if (input0) {
    input0.innerHTML = '';
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexWrap = 'wrap';
    div.style.justifyContent = 'center';
    input0.appendChild(div);

    state.mappers[0].data.forEach((rec, i) => {
      const r = createInputRecordElement(rec, getSourceRecordId(0, i));
      div.appendChild(r);
    });
  }

  if (input1) {
    input1.innerHTML = '';
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexWrap = 'wrap';
    div.style.justifyContent = 'center';
    input1.appendChild(div);

    state.mappers[1].data.forEach((rec, i) => {
      const r = createInputRecordElement(rec, getSourceRecordId(1, i));
      div.appendChild(r);
    });
  }
}

/**
 * Complete UI reset.
 * @param {Object} state - Simulation state
 */
export function resetUI(state) {
  resetState(state);
  clearLog();
  resetMetrics();
  clearAllContainers();
  populateInputs(state);
  resetAllBufferFills();
  setNetworkActive(false);
  unfoldIntermediateRows();
  highlightNodes(null, 'IDLE');
}
