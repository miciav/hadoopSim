/**
 * Map phase: processes input records and fills buffers.
 */

import {
  el,
  getBufferId,
  getFillId,
  getBoxSpillId,
  getBoxCombineId,
  getSpillSlotId,
  getSourceRecordId
} from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToGhosts } from '../dom/records.js';
import { flyRecord, wait } from '../dom/animations.js';
import { log } from '../dom/log.js';
import { updateBufferFill, setBufferLimit } from '../dom/buffers.js';
import { shouldSpill, calculateBufferPercentage } from '../state.js';
import { runSpill } from './spill.js';

/**
 * Runs the map phase for a single mapper.
 * @param {Object} state - Simulation state
 * @param {number} mapperId - Mapper ID (0 or 1)
 * @param {number} delay - Base delay for animations
 * @param {string} nodeId - Node element ID (for logging)
 * @param {Object} callbacks - Callback functions
 * @returns {Promise<void>}
 */
export async function runMapper(state, mapperId, delay, nodeId, callbacks) {
  const { isRunning, isTeaching, onRecordProcessed } = callbacks;

  if (!isRunning()) return;

  const mapper = state.mappers[mapperId];
  const bufEl = el(getBufferId(mapperId));
  const fillEl = el(getFillId(mapperId));

  if (!fillEl) return;

  // Use splits from state to simulate tasks
  const splits = state.inputSplits[mapperId] || [mapper.data];
  let globalRecordIndex = 0;

  for (let splitIdx = 0; splitIdx < splits.length; splitIdx++) {
    if (!isRunning()) return;

    const split = splits[splitIdx];
    const displayNode = (mapperId === 0) ? 'Node 01' : 'Node 02';

    // Log start of task (if significant splits exist)
    if (isTeaching() && splits.length > 1) {
       log(`${displayNode}: <strong>Task ${splitIdx}</strong> processing Split ${splitIdx} (${split.length} records)...`, 'MAP');
    }

    for (let i = 0; i < split.length; i++) {
      if (!isRunning()) return;

      const record = split[i];
      mapper.buffer.push(record);

      // Update record counter
      onRecordProcessed();

      // Fly record from HDFS input to buffer
      // Note: we use globalRecordIndex to match the static input element IDs
      const sourceId = getSourceRecordId(mapperId, globalRecordIndex);
      await flyRecord(sourceId, getBufferId(mapperId), record, delay * 0.4);
      
      globalRecordIndex++;

      if (!isRunning()) return;

      // Add record to buffer visually
      const recordEl = createRecordElement(record);
      bufEl.appendChild(recordEl);
      showRecord(recordEl);

      // Update buffer fill indicator
      const pct = calculateBufferPercentage(mapper.buffer);
      updateBufferFill(mapperId, pct);

      // Check for spill condition: Buffer Full OR End of Split (Task completion)
      const isBufferFull = shouldSpill(mapper.buffer);
      const isEndOfTask = i === split.length - 1;

      if (isBufferFull || isEndOfTask) {
        setBufferLimit(mapperId, true);

        if (isTeaching()) {
          const reason = isBufferFull ? `Buffer Full (${pct}%)` : `End of Task`;
          log(`${displayNode}: <strong>${reason}.</strong> Spilling to disk.`, 'MAP');
        }

        const spillBox = el(getBoxSpillId(mapperId));
        if (spillBox) spillBox.classList.add('active');

        await wait(delay);
        if (!isRunning()) return;

        const spillIdx = mapper.spills.length;
        const spillSlot = el(getSpillSlotId(mapperId, spillIdx));
        if (spillSlot) spillSlot.classList.remove('is-hidden');

        // Note: Combine row visibility is handled in spill.js

        if (isTeaching()) {
           log(`${displayNode}: <strong>Combiner</strong> running... Writing Combine output.`, 'DISK');
        }

        await runSpill(state, mapperId, spillIdx, delay, callbacks);
        if (!isRunning()) return;

        if (spillBox) spillBox.classList.remove('active');
        turnActiveToGhosts(bufEl);

        // Reset buffer state
        mapper.buffer = [];
        updateBufferFill(mapperId, 0);
        setBufferLimit(mapperId, false);
      }

      await wait(delay * 0.2);
    }
  }
}
