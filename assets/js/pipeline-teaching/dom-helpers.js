/**
 * DOM helper functions for step-by-step simulation.
 */

import { el, getSpillSlotId, getCombineSlotId, getSourceRecordId } from '../pipeline-dual-nodes/dom/selectors.js';
import { createRecordElement, showRecord, markAsGhost, markAsPersistent } from '../pipeline-dual-nodes/dom/records.js';

/**
 * Gets the label for a mapper (A or B).
 */
function getMapperLabel(mapperId) {
  return mapperId === 0 ? 'A' : 'B';
}

/**
 * Renders a record in a mapper buffer.
 * @param {number} mapperId - Mapper ID (0 or 1)
 * @param {Object} record - Record data
 * @param {string} id - Element ID
 */
export function renderRecordInBuffer(mapperId, record, id) {
  const bufEl = el(`buf${mapperId}`);
  if (!bufEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  bufEl.appendChild(recEl);

  // Force reflow then show
  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Renders a record in a spill slot.
 * @param {number} mapperId - Mapper ID
 * @param {number} spillIndex - Spill index
 * @param {Object} record - Record data
 * @param {string} id - Element ID
 */
export function renderRecordInSpill(mapperId, spillIndex, record, id) {
  const spillId = getSpillSlotId(mapperId, spillIndex);
  const spillEl = el(spillId);
  if (!spillEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  spillEl.appendChild(recEl);

  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Renders a record in a combine slot.
 * @param {number} mapperId - Mapper ID
 * @param {number} spillIndex - Spill/combine index
 * @param {Object} record - Record data
 * @param {string} id - Element ID
 */
export function renderRecordInCombine(mapperId, spillIndex, record, id) {
  const combineId = getCombineSlotId(mapperId, spillIndex);
  const combineEl = el(combineId);
  if (!combineEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  combineEl.appendChild(recEl);

  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Renders a record in the final mapper output.
 * @param {number} mapperId - Mapper ID
 * @param {Object} record - Record data
 * @param {string} id - Element ID
 * @param {string} segmentId - Segment container ID (e.g., 'finalA-p0')
 */
export function renderRecordInFinal(mapperId, record, id, segmentId) {
  const segmentEl = el(segmentId);
  if (!segmentEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  segmentEl.appendChild(recEl);

  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Renders a record in a reducer container.
 * @param {number} partition - Partition number (0, 1, or 2)
 * @param {Object} record - Record data
 * @param {string} id - Element ID
 * @param {string} containerId - Container element ID (e.g., 'red0Seg0', 'red0Merge')
 */
export function renderRecordInReducer(partition, record, id, containerId) {
  const containerEl = el(containerId);
  if (!containerEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  containerEl.appendChild(recEl);

  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Renders a record in the reduce output container.
 * @param {number} partition - Partition number
 * @param {Object} record - Record data with count
 * @param {string} id - Element ID
 */
export function renderRecordInReduceOutput(partition, record, id) {
  const outputEl = el(`red${partition}Reduce`);
  if (!outputEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  recEl.classList.add('reduce-output');
  outputEl.appendChild(recEl);

  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Renders a record in HDFS output.
 * @param {number} partition - Partition number
 * @param {Object} record - Record data
 * @param {string} id - Element ID
 */
export function renderRecordInHdfsOutput(partition, record, id) {
  const hdfsEl = el(`hdfsOut${partition}`);
  if (!hdfsEl) return null;

  const recEl = createRecordElement(record, record.count || 1);
  recEl.id = id;
  recEl.classList.add('persistent');
  hdfsEl.appendChild(recEl);

  recEl.offsetHeight;
  showRecord(recEl);

  return recEl;
}

/**
 * Removes all active (non-ghost, non-persistent) records from a container.
 * @param {HTMLElement} container
 */
export function removeActiveRecords(container) {
  if (!container) return;
  const records = container.querySelectorAll('.kv-record:not(.ghost):not(.persistent)');
  records.forEach(r => r.remove());
}

/**
 * Reveals a spill slot container.
 * @param {number} mapperId - Mapper ID
 * @param {number} spillIndex - Spill index
 */
export function revealSpillSlot(mapperId, spillIndex) {
  const spillId = getSpillSlotId(mapperId, spillIndex);
  const slot = el(spillId);

  if (slot) {
    slot.classList.remove('is-hidden');
  }

  return slot;
}

/**
 * Reveals the combine row for a mapper.
 * @param {number} mapperId - Mapper ID
 */
export function revealCombineRow(mapperId) {
  const nodeEl = el(mapperId === 0 ? 'node01' : 'node02');
  if (!nodeEl) return;

  const combineRow = nodeEl.querySelector('.combine-row');
  if (combineRow) {
    combineRow.classList.remove('is-hidden');
  }
}

/**
 * Reveals the merge row for a mapper.
 * @param {number} mapperId - Mapper ID
 */
export function revealMergeRow(mapperId) {
  const nodeEl = el(mapperId === 0 ? 'node01' : 'node02');
  if (!nodeEl) return;

  const mergeRow = nodeEl.querySelector('.mapper-merge-row');
  if (mergeRow) {
    mergeRow.classList.remove('is-hidden');
  }
}

/**
 * Turns all active records in a container to ghosts.
 * Re-exported for convenience.
 */
export { turnActiveToGhosts } from '../pipeline-dual-nodes/dom/records.js';
