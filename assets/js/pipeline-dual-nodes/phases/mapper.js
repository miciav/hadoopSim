/**
 * Map phase: processes input records and fills buffers.
 */

import { el, getBufferId, getFillId, getPctId, getBoxSpillId, getSourceRecordId } from '../dom/selectors.js';
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

  for (let i = 0; i < mapper.data.length; i++) {
    if (!isRunning()) return;

    const record = mapper.data[i];
    mapper.buffer.push(record);

    // Update record counter
    onRecordProcessed();

    // Fly record from HDFS input to buffer
    const sourceId = getSourceRecordId(mapperId, i);
    await flyRecord(sourceId, getBufferId(mapperId), record, delay * 0.4);

    if (!isRunning()) return;

    // Add record to buffer visually
    const recordEl = createRecordElement(record);
    bufEl.appendChild(recordEl);
    showRecord(recordEl);

    // Update buffer fill indicator
    const pct = calculateBufferPercentage(mapper.buffer);
    updateBufferFill(mapperId, pct);

    // Check for spill condition
    const isLastRecord = i === mapper.data.length - 1;
    if (shouldSpill(mapper.buffer) || isLastRecord) {
      setBufferLimit(mapperId, true);

      if (isTeaching()) {
        log(`Node 0${mapperId + 1}: <strong>Buffer Full (${pct}%).</strong> Pausing input to Spill.`, 'MAP');
      }

      const spillBox = el(getBoxSpillId(mapperId));
      if (spillBox) spillBox.classList.add('active');

      await wait(delay);
      if (!isRunning()) return;

      if (isTeaching()) {
        log(`Node 0${mapperId + 1}: <strong>Combiner</strong> running... Writing Spill to Disk.`, 'DISK');
      }

      await runSpill(state, mapperId, mapper.spills.length, delay, callbacks);
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
