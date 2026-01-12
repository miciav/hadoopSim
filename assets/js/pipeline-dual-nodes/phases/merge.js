/**
 * Merge phase: combines spills into final mapper output.
 */

import { el, getSpillSlotId, getFinalId } from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToGhosts, turnActiveToPersistent } from '../dom/records.js';
import { flyRecord, wait, triggerCombineSweep } from '../dom/animations.js';
import { combine, sortByPartitionThenKey } from '../combiner.js';
import { SWEEP_COLORS } from '../config.js';

/**
 * Animates records flying from spills to merge output.
 * @param {Object} state - Simulation state
 * @param {number} mapperId - Mapper ID
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runMergeAnimation(state, mapperId, tick, isRunning) {
  if (!isRunning()) return;

  const mapper = state.mappers[mapperId];
  const targetId = getFinalId(mapperId);
  const target = el(targetId);
  const labelA = mapperId === 0 ? 'A' : 'B';

  const all = [];

  // Build processing queue from all spills
  const processingQueue = [];
  mapper.spills.forEach((spillData, spillIdx) => {
    const sourceId = getSpillSlotId(mapperId, spillIdx);
    spillData.forEach(rec => {
      processingQueue.push({ rec, sourceId });
      all.push(rec);
    });
  });

  // Animate records flying sequentially
  for (const item of processingQueue) {
    if (!isRunning()) return;

    await flyRecord(item.sourceId, targetId, item.rec, tick * 0.6);

    // Land record in merge output
    const r = createRecordElement(item.rec, item.rec.count);
    target.appendChild(r);
    showRecord(r);

    await wait(tick * 0.1);
  }

  // Store all records for combine phase
  mapper._mergeAll = all;
}

/**
 * Combines merged records into final sorted output.
 * @param {Object} state - Simulation state
 * @param {number} mapperId - Mapper ID
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runMergeCombine(state, mapperId, tick, isRunning) {
  if (!isRunning()) return;

  const mapper = state.mappers[mapperId];
  const targetId = getFinalId(mapperId);
  const target = el(targetId);
  const labelA = mapperId === 0 ? 'A' : 'B';
  const all = mapper._mergeAll || [];

  // Fade out unsorted records
  turnActiveToGhosts(target);

  // Mark spills as persistent
  for (let i = 0; i < mapper.spills.length; i++) {
    const s = el(getSpillSlotId(mapperId, i));
    if (s) turnActiveToPersistent(s);
  }

  // Sort and combine all records
  const sorted = sortByPartitionThenKey(all);
  const merged = combine(sorted);
  mapper.final = merged;

  // Sweep effect for merge
  triggerCombineSweep(targetId, SWEEP_COLORS.GREEN);
  await wait(800);

  // Show final merged records
  merged.forEach(rec => {
    const r = createRecordElement(rec, rec.count);
    r.style.zIndex = 100;
    target.appendChild(r);
    setTimeout(() => showRecord(r), 10);
  });
}
