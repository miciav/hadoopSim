/**
 * Reduce phase: aggregates partitioned data into final output.
 */

import { el, getReducerId } from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToGhosts } from '../dom/records.js';
import { wait, triggerCombineSweep } from '../dom/animations.js';
import { aggregateByKey } from '../combiner.js';
import { PARTITIONS, SWEEP_COLORS } from '../config.js';

/**
 * Runs the reduce phase for all partitions.
 * @param {Object} state - Simulation state
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runReduce(state, tick, isRunning) {
  if (!isRunning()) return;

  const partitions = [0, 1, 2];

  const reducePromises = partitions.map(async (p) => {
    if (!isRunning()) return;

    const box = el(getReducerId(p));
    const rawRecs = state.reducers[p] || [];

    // Fade out input records
    turnActiveToGhosts(box);

    // Sweep effect for reduce aggregation
    triggerCombineSweep(getReducerId(p), SWEEP_COLORS.PURPLE);
    await wait(Math.max(tick, 800));

    if (!isRunning()) return;

    // Aggregate by key
    const aggregated = aggregateByKey(rawRecs);

    // Save aggregated results to state for output phase
    const partition = PARTITIONS[p];
    state.reduceOutput[p] = Array.from(aggregated.entries()).map(([k, v]) => ({
      k,
      count: v,
      p,
      c: partition.cssClass
    }));

    // Display final aggregated records
    for (const [k, v] of aggregated.entries()) {
      if (!isRunning()) return;

      const r = createRecordElement({ k, c: partition.cssClass }, v);
      r.classList.add('reduce-output');
      box.appendChild(r);
      showRecord(r);

      await wait(tick * 0.3);
    }
  });

  await Promise.all(reducePromises);
}
