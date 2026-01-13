/**
 * Merge phase: sorts spills into final mapper output.
 */

import { el, getSpillSlotId, getCombineSlotId, getFinalId } from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToGhosts } from '../dom/records.js';
import { flyRecord, wait, triggerCombineSweep } from '../dom/animations.js';
import { sortByPartitionThenKey } from '../combiner.js';
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
  const all = [];

  // Build processing queue from all spills
  const processingQueue = [];
  mapper.spills.forEach((spillData, spillIdx) => {
    const combineId = getCombineSlotId(mapperId, spillIdx);
    const sourceId = el(combineId) ? combineId : getSpillSlotId(mapperId, spillIdx);
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
 * Sorts merged spills into final mapper output.
 * @param {Object} state - Simulation state
 * @param {number} mapperId - Mapper ID
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runMergeSortOutput(state, mapperId, tick, isRunning) {
  if (!isRunning()) return;

  const mapper = state.mappers[mapperId];
  const targetId = getFinalId(mapperId);
  const target = el(targetId);
  const all = mapper._mergeAll || [];

  // Fade out unsorted records
  turnActiveToGhosts(target);

  // Ghost combined spills so they remain visible without staying active
  for (let i = 0; i < mapper.spills.length; i++) {
    const combineId = getCombineSlotId(mapperId, i);
    const slot = el(combineId) || el(getSpillSlotId(mapperId, i));
    if (slot) turnActiveToGhosts(slot);
  }

  // Sort merged records (combiner already ran during spill)
  const merged = sortByPartitionThenKey(all);
  mapper.final = merged;

  // Sweep effect for merge
  triggerCombineSweep(targetId, SWEEP_COLORS.GREEN);
  await wait(800);

  // Show final merged records
  merged.forEach(rec => {
    const r = createRecordElement(rec, rec.count);
    target.appendChild(r);
    setTimeout(() => showRecord(r), 10);
  });
}
