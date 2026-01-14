/**
 * UI reset functionality.
 */

import {
  el,
  ELEMENT_IDS,
  CLEARABLE_CONTAINERS,
  getSourceRecordId,
  getBoxSpillId,
  getBoxCombineId,
  getSpillSlotId,
  getCombineSlotId
} from './selectors.js';
import { clearLog } from './log.js';
import { resetAllBufferFills } from './buffers.js';
import { clearRecords, clearFlyingRecords, createInputRecordElement } from './records.js';
import { highlightNodes, setNetworkActive } from './highlights.js';
import { unfoldIntermediateRows } from './fold.js';
import { splitInputData, calculateSpillCount } from '../state.js';

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

  const size = state.splitSize || 10;
  state.inputSplits = state.mappers.map(mapper => splitInputData(mapper.data || [], size));
  state.spillCounts = state.mappers.map(mapper => calculateSpillCount(mapper.data.length));

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

function buildSlot(id, label, className, isHidden = false) {
  const slot = document.createElement('div');
  slot.id = id;
  slot.className = className;
  if (isHidden) {
    slot.classList.add('is-hidden');
  }
  const mini = document.createElement('div');
  mini.className = 'mini-label';
  mini.textContent = label;
  slot.appendChild(mini);
  return slot;
}

function renderSpillCombineSlots(state) {
  if (!state?.mappers?.length) return;

  state.mappers.forEach((mapper, mapperId) => {
    const spillCount = state.spillCounts?.[mapperId] ?? calculateSpillCount(mapper.data.length);
    const spillBox = el(getBoxSpillId(mapperId));
    const spillContainer = spillBox ? spillBox.querySelector('.spill-container') : null;
    if (spillContainer) {
      spillContainer.innerHTML = '';
      for (let i = 0; i < spillCount; i += 1) {
        const slot = buildSlot(getSpillSlotId(mapperId, i), `Spill ${i}`, 'spill-slot', true);
        spillContainer.appendChild(slot);
      }
    }

    const combineBox = el(getBoxCombineId(mapperId));
    const combineContainer = combineBox ? combineBox.querySelector('.combine-container') : null;
    if (combineContainer) {
      combineContainer.innerHTML = '';
      for (let i = 0; i < spillCount; i += 1) {
        const slot = buildSlot(getCombineSlotId(mapperId, i), `Combine ${i}`, 'combine-slot');
        combineContainer.appendChild(slot);
      }
    }
  });
}

/**
 * Populates HDFS input boxes with source records.
 * @param {Object} state - Simulation state
 */
export function populateInputs(state) {
  const input0 = el(ELEMENT_IDS.BOX_INPUT_0);
  const input1 = el(ELEMENT_IDS.BOX_INPUT_1);

  [input0, input1].forEach((box, mapperId) => {
    if (!box) return;

    const splits = state.inputSplits?.[mapperId] ?? splitInputData(state.mappers?.[mapperId]?.data || []);
    box.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'input-splits';
    box.appendChild(container);

    let recordIndex = 0;
    splits.forEach((split, splitIndex) => {
      const splitBox = document.createElement('div');
      splitBox.className = 'input-split input-records';
      const label = document.createElement('div');
      label.className = 'mini-label';
      label.textContent = `Split ${splitIndex}`;
      splitBox.appendChild(label);

      split.forEach(rec => {
        const r = createInputRecordElement(rec, getSourceRecordId(mapperId, recordIndex));
        splitBox.appendChild(r);
        recordIndex += 1;
      });

      container.appendChild(splitBox);
    });
  });
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
  renderSpillCombineSlots(state);
  document.querySelectorAll('.reducer-segments.active, .reducer-merge.active').forEach(el => {
    el.classList.remove('active');
  });
  document.querySelectorAll('.spill-slot').forEach(el => {
    el.classList.add('is-hidden');
  });
  document.querySelectorAll('.combine-row').forEach(el => {
    el.classList.add('is-hidden');
  });
  document.querySelectorAll('.reducer-inner.is-hidden').forEach(el => {
    el.classList.remove('is-hidden');
  });
  populateInputs(state);
  resetAllBufferFills();
  setNetworkActive(false);
  unfoldIntermediateRows();
  highlightNodes(null, 'IDLE');
}
