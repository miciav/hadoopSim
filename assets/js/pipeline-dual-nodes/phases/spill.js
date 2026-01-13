/**
 * Spill phase: writes buffer contents to disk with sorting and combining.
 */

import { el, getBufferId, getSpillSlotId, getCombineSlotId, getBoxCombineId } from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToGhosts, clearRecords } from '../dom/records.js';
import { flyRecord, wait, triggerCombineSweep } from '../dom/animations.js';
import { sortAndCombineBuffer } from '../combiner.js';
import { SWEEP_COLORS } from '../config.js';

/**
 * Executes a spill operation for a mapper.
 * @param {Object} state - Simulation state
 * @param {number} mapperId - Mapper ID
 * @param {number} spillIdx - Index for this spill
 * @param {number} delay - Base delay for animations
 * @param {Object} callbacks - Callback functions
 * @returns {Promise<void>}
 */
export async function runSpill(state, mapperId, spillIdx, delay, callbacks) {
  const { isRunning, onSpillCreated } = callbacks;

  if (!isRunning()) return;

  const mapper = state.mappers[mapperId];
  const bufId = getBufferId(mapperId);
  const slotId = getSpillSlotId(mapperId, spillIdx);
  const slot = el(slotId);
  const combineSlotId = getCombineSlotId(mapperId, spillIdx);
  const combineSlot = el(combineSlotId);
  const combineBox = el(getBoxCombineId(mapperId));
  const combineRow = combineBox ? combineBox.closest('.node-row') : null;

  if (slot) {
    slot.classList.remove('is-hidden');
  }

  // Animate records flying sequentially from buffer to spill slot
  for (const rec of mapper.buffer) {
    if (!isRunning()) return;

    await flyRecord(bufId, slotId, rec, delay * 0.5);

    // Land record in spill slot
    if (slot) {
      const r = createRecordElement(rec, 1);
      slot.appendChild(r);
      showRecord(r);
    }

    await wait(delay * 0.1);
  }

  if (!isRunning()) return;

  // Sort and combine buffer contents
  const combined = sortAndCombineBuffer(mapper.buffer);
  mapper.spills.push(combined);

  // Update spill counter
  onSpillCreated();

  if (slot) {
    await wait(delay * 0.5);
    if (!isRunning()) return;

    if (spillIdx === 1 && combineRow) {
      combineRow.classList.remove('is-hidden');
    }

    // Fade out unsorted records
    turnActiveToGhosts(slot);

    // Sweep effect for combine
    if (combineSlot) clearRecords(combineSlot);
    const sweepTargetId = combineSlot ? combineSlotId : slotId;
    triggerCombineSweep(sweepTargetId, SWEEP_COLORS.AMBER);
    await wait(800);

    // Show combined records
    combined.forEach(rec => {
      const r = createRecordElement(rec, rec.count);
      (combineSlot || slot).appendChild(r);
      setTimeout(() => showRecord(r), 20);
    });
  }
}
