/**
 * Output phase: writes reduce results to HDFS output files.
 */

import { el, getReducerOutputId } from '../dom/selectors.js';
import { createRecordElement, showRecord, markAsGhost } from '../dom/records.js';
import { flyRecord, wait } from '../dom/animations.js';

/**
 * Runs the output phase for all partitions.
 * Animates records flying from reducers to HDFS output files.
 * @param {Object} state - Simulation state
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runOutput(state, tick, isRunning) {
  if (!isRunning()) return;

  const partitions = [0, 1, 2];

  // Process partitions in parallel
  const outputPromises = partitions.map(async (p) => {
    if (!isRunning()) return;

    const sourceId = getReducerOutputId(p);
    const targetId = `hdfsOut${p}`;
    const records = state.reduceOutput[p] || [];

    await wait(tick * 0.3);

    // Animate each record flying to HDFS
    for (const rec of records) {
      if (!isRunning()) return;

      // Fly record from reducer to HDFS output
      await flyRecord(sourceId, targetId, rec, tick * 0.5);

      // Land in HDFS output file
      const targetBox = el(targetId);
      if (targetBox) {
        const r = createRecordElement(rec, rec.count);
        r.classList.add('persistent');
        targetBox.appendChild(r);
        showRecord(r);
      }

      await wait(tick * 0.25);
    }

    const sourceBox = el(sourceId);
    if (sourceBox) {
      sourceBox.querySelectorAll('.kv-record').forEach(markAsGhost);
    }
  });

  await Promise.all(outputPromises);
}
