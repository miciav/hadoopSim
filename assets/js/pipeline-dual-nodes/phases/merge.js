/**
 * Merge phase: sorts spills into final mapper output.
 */

import {
  el,
  getSpillSlotId,
  getCombineSlotId,
  getFinalId,
  getFinalSegmentId,
  getBoxLocalMergeId,
  getMergeInnerId
} from '../dom/selectors.js';
import {
  createRecordElement,
  showRecord,
  turnActiveToGhosts,
  markAsGhost
} from '../dom/records.js';
import { flyRecord, wait } from '../dom/animations.js';
import { mergeSortedSpills } from '../combiner.js';

/**
 * Animates records flying from spills to Local Merge Sort box.
 * @param {Object} state - Simulation state
 * @param {number} mapperId - Mapper ID
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runMergeAnimation(
  state,
  mapperId,
  tick,
  isRunning,
  signal
) {
  if (!isRunning()) return;

  const mapper = state.mappers[mapperId];
  const mergeBoxId = getBoxLocalMergeId(mapperId);
  const mergeInnerId = getMergeInnerId(mapperId);
  const mergeBox = el(mergeBoxId);
  const mergeInner = el(mergeInnerId);

  if (mergeBox) {
    const row = mergeBox.closest('.node-row');
    if (row) row.classList.remove('is-hidden');
  }

  // 1. Multi-way merge from spills
  const spills = mapper.spills.map((data, idx) => {
    const combineId = getCombineSlotId(mapperId, idx);
    const sourceId = el(combineId) ? combineId : getSpillSlotId(mapperId, idx);
    return { data: [...data], sourceId, pos: 0 };
  });

  const mergedOrder = mergeSortedSpills(spills.map((spill) => spill.data)).map(
    ({ record, sourceIndex }) => ({
      rec: record,
      sourceId: spills[sourceIndex].sourceId
    })
  );

  // 2. Fly to Merge Sort box
  for (const item of mergedOrder) {
    if (!isRunning()) return;
    await flyRecord(item.sourceId, mergeInnerId, item.rec, tick * 0.5, signal);
    if (!isRunning()) return;
    if (mergeInner) {
      const r = createRecordElement(item.rec, item.rec.count);
      mergeInner.appendChild(r);
      showRecord(r);
      item.mergeEl = r; // Keep reference to ghost it later
    }
    await wait(tick * 0.1, signal);
    if (!isRunning()) return;
  }

  // 3. Pause for sort completion
  await wait(tick * 0.5, signal);
  if (!isRunning()) return;

  // 4. Save to Disk (Copy to final segments and ghost in merge box)
  for (const item of mergedOrder) {
    if (!isRunning()) return;
    const segmentId = getFinalSegmentId(mapperId, item.rec.p);

    // Fly to segment
    await flyRecord(mergeInnerId, segmentId, item.rec, tick * 0.5, signal);
    if (!isRunning()) return;

    // Ghost the record in Local Merge box instead of removing it
    if (item.mergeEl) markAsGhost(item.mergeEl);

    const segment = el(segmentId);
    if (segment) {
      const r = createRecordElement(item.rec, item.rec.count);
      segment.appendChild(r);
      showRecord(r);
    }
    await wait(tick * 0.05, signal);
    if (!isRunning()) return;
  }

  mapper.final = mergedOrder.map((i) => i.rec);
}

/**
 * Finalizes the merge phase.
 */
export async function runMergeSortOutput(
  state,
  mapperId,
  tick,
  isRunning,
  signal
) {
  if (!isRunning()) return;
  const mapper = state.mappers[mapperId];

  // Ghost source spills
  for (let i = 0; i < mapper.spills.length; i++) {
    const slot =
      el(getCombineSlotId(mapperId, i)) || el(getSpillSlotId(mapperId, i));
    if (slot) turnActiveToGhosts(slot);
  }
}
