/**
 * Reduce phase: aggregates partitioned data into final output.
 */

import {
  el,
  getReducerId,
  getReducerSegmentsId,
  getReducerSegmentId,
  getReducerMergeId,
  getReducerOutputId
} from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToGhosts, clearRecords } from '../dom/records.js';
import { flyRecord, wait, triggerCombineSweep } from '../dom/animations.js';
import { aggregateByKey } from '../combiner.js';
import { PARTITIONS, SWEEP_COLORS } from '../config.js';

function sortReducerRecords(records) {
  return [...records].sort((a, b) => String(a.k).localeCompare(String(b.k)));
}

function splitReducerSegments(records) {
  const segmentBuckets = { 0: [], 1: [] };
  let hasUnknownSource = false;

  records.forEach(rec => {
    if (rec.source === 0 || rec.source === 1) {
      segmentBuckets[rec.source].push(rec);
      return;
    }
    hasUnknownSource = true;
  });

  return { segments: [segmentBuckets[0], segmentBuckets[1]], hasUnknownSource };
}

function mergeSortedSegments(segments) {
  const positions = segments.map(() => 0);
  const merged = [];

  while (true) {
    let minIndex = -1;
    let minRecord = null;

    segments.forEach((segment, index) => {
      if (positions[index] >= segment.length) return;
      const candidate = segment[positions[index]];
      if (!minRecord || String(candidate.k).localeCompare(String(minRecord.k)) < 0) {
        minRecord = candidate;
        minIndex = index;
      }
    });

    if (minIndex === -1) break;

    merged.push({ record: segments[minIndex][positions[minIndex]], source: minIndex });
    positions[minIndex] += 1;
  }

  return merged;
}

/**
 * Runs the reducer-side merge sort before aggregation.
 * @param {Object} state - Simulation state
 * @param {number} tick - Base timing
 * @param {Function} isRunning - Check if simulation is running
 * @returns {Promise<void>}
 */
export async function runReduceMergeSort(state, tick, isRunning, isTeaching = () => true) {
  if (!isRunning()) return;

  const partitions = [0, 1, 2];

  const sortPromises = partitions.map(async (p) => {
    if (!isRunning()) return;

    const box = el(getReducerId(p));
    const rawRecs = state.reducers[p] || [];
    if (rawRecs.length === 0) return;

    turnActiveToGhosts(box);
    await wait(Math.max(tick * 0.5, 300));
    if (!isRunning()) return;

    const { segments: rawSegments, hasUnknownSource } = splitReducerSegments(rawRecs);
    const canRenderSegments = isTeaching() && !hasUnknownSource;
    const segments = canRenderSegments
      ? rawSegments.map(segment => sortReducerRecords(segment))
      : [sortReducerRecords(rawRecs), []];
    const mergedOrder = mergeSortedSegments(segments);
    const mergedRecords = mergedOrder.map(item => item.record);
    state.reducers[p] = mergedRecords;

    if (!isTeaching()) {
      if (box) {
        clearRecords(box);
        mergedRecords.forEach(rec => {
          const r = createRecordElement(rec, rec.count);
          box.appendChild(r);
          showRecord(r);
        });
      }
      return;
    }

    const segmentsBox = el(getReducerSegmentsId(p));
    const seg0Box = el(getReducerSegmentId(p, 0));
    const seg1Box = el(getReducerSegmentId(p, 1));
    const mergeBox = el(getReducerMergeId(p));
    const useSegmentUI = canRenderSegments && segmentsBox && seg0Box && seg1Box;

    if (box) {
      if (useSegmentUI) {
        box.classList.add('is-hidden');
      } else {
        box.classList.remove('is-hidden');
      }
    }

    if (segmentsBox && !useSegmentUI) {
      segmentsBox.classList.remove('active');
    }

    if (useSegmentUI) {
      segmentsBox.classList.add('active');
      clearRecords(seg0Box);
      clearRecords(seg1Box);

      segments[0].forEach(rec => {
        const r = createRecordElement(rec, rec.count);
        seg0Box.appendChild(r);
        showRecord(r);
      });
      segments[1].forEach(rec => {
        const r = createRecordElement(rec, rec.count);
        seg1Box.appendChild(r);
        showRecord(r);
      });
    }

    if (mergeBox) {
      mergeBox.classList.add('active');
      clearRecords(mergeBox);
    }

    for (const item of mergedOrder) {
      if (!isRunning()) return;
      const fromId = useSegmentUI ? getReducerSegmentId(p, item.source) : getReducerId(p);
      const targetId = mergeBox ? getReducerMergeId(p) : getReducerId(p);

      await flyRecord(fromId, targetId, item.record, tick * 0.4);
      if (!isRunning()) return;

      const targetBox = mergeBox || box;
      if (targetBox) {
        const r = createRecordElement(item.record, item.record.count);
        targetBox.appendChild(r);
        showRecord(r);
      }
      await wait(Math.max(tick * 0.1, 80));
    }

    if (mergeBox) {
      triggerCombineSweep(getReducerMergeId(p), SWEEP_COLORS.PURPLE);
      await wait(Math.max(tick * 0.4, 400));
      turnActiveToGhosts(mergeBox);
    }

    if (useSegmentUI) {
      turnActiveToGhosts(seg0Box);
      turnActiveToGhosts(seg1Box);
    }

    if (box) {
      clearRecords(box);
      if (!useSegmentUI) {
        for (const rec of mergedRecords) {
          if (!isRunning()) return;
          const r = createRecordElement(rec, rec.count);
          box.appendChild(r);
          showRecord(r);
          await wait(Math.max(tick * 0.1, 80));
        }
      }
    }
  });

  await Promise.all(sortPromises);
}

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
    const outputBox = el(getReducerOutputId(p));
    const rawRecs = state.reducers[p] || [];

    // Fade out input records
    turnActiveToGhosts(box);

    // Sweep effect for reduce aggregation
    triggerCombineSweep(getReducerOutputId(p), SWEEP_COLORS.PURPLE);
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
    if (outputBox) clearRecords(outputBox);
    for (const [k, v] of aggregated.entries()) {
      if (!isRunning()) return;

      const r = createRecordElement({ k, c: partition.cssClass }, v);
      r.classList.add('reduce-output');
      if (outputBox) outputBox.appendChild(r);
      showRecord(r);

      await wait(tick * 0.3);
    }
  });

  await Promise.all(reducePromises);
}
