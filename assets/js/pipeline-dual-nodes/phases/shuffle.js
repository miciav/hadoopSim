/**
 * Shuffle phase: network transfer of partitioned data to reducers.
 */

import {
  el,
  getFinalId,
  getReducerId,
  getReducerSegmentId,
  getReducerSegmentsId,
  ELEMENT_IDS
} from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToPersistent, clearRecords } from '../dom/records.js';
import { flyRecord, wait } from '../dom/animations.js';
import { log } from '../dom/log.js';
import { sortByPartitionThenKey } from '../combiner.js';

/**
 * Runs the network shuffle phase.
 * @param {Object} state - Simulation state
 * @param {number} tick - Base timing
 * @param {Object} callbacks - Callback functions
 * @returns {Promise<void>}
 */
export async function runNetworkShuffle(state, tick, callbacks) {
  const { isRunning, isTeaching, onNetPacket } = callbacks;

  if (!isRunning()) return;

  const teachingEnabled = isTeaching();
  const segmentTargets = {};
  if (teachingEnabled) {
    [0, 1, 2].forEach(p => {
      const segmentsBox = el(getReducerSegmentsId(p));
      const seg0 = el(getReducerSegmentId(p, 0));
      const seg1 = el(getReducerSegmentId(p, 1));
      const ready = !!(segmentsBox && seg0 && seg1);
      segmentTargets[String(p)] = ready;
      if (ready) {
        segmentsBox.classList.add('active');
        clearRecords(seg0);
        clearRecords(seg1);
        const reducerBox = el(getReducerId(p));
        if (reducerBox) clearRecords(reducerBox);
      }
    });
  }

  const m0 = state.mappers[0].final;
  const m1 = state.mappers[1].final;

  /**
   * Transmits data from a single node to reducers.
   */
  const transmitNodeData = async (records, sourceId, nodeName, sourceIndex) => {
    const localQueue = sortByPartitionThenKey(records);
    const nodePromises = [];
    const nicSpeed = tick / 4;
    let currentP = -1;

    for (const rec of localQueue) {
      if (!isRunning()) break;

      // Log partition changes in teaching mode
      if (teachingEnabled && rec.p !== currentP) {
        currentP = rec.p;
        await wait(Math.random() * 100);
        log(`${nodeName}: Streaming batch for <strong>Partition ${currentP}</strong>...`, 'NET');
      }

      // Create async packet journey
      const packetJourney = async () => {
        if (!isRunning()) return;

        // Fly to network hub
        await flyRecord(sourceId, ELEMENT_IDS.NET_HUB, rec, tick * 0.5);

        // Update network counter
        onNetPacket();

        // Small delay at hub
        await wait((tick * 0.1) + Math.random() * 80);
        if (!isRunning()) return;

        const recordPayload = { ...rec, source: sourceIndex };
        const segmentId = getReducerSegmentId(rec.p, sourceIndex);
        const useSegments = teachingEnabled && segmentTargets[String(rec.p)] === true;
        const targetId = useSegments ? segmentId : getReducerId(rec.p);

        // Update state
        if (state.reducers[rec.p]) {
          state.reducers[rec.p].push(recordPayload);
        }

        await flyRecord(ELEMENT_IDS.NET_HUB, targetId, recordPayload, tick * 0.5);

        // Land in reducer
        const targetBox = el(targetId);
        if (targetBox) {
          const r = createRecordElement(recordPayload, recordPayload.count);
          targetBox.appendChild(r);
          showRecord(r);
        }

      };

      // Launch packet and continue (parallel transmission)
      nodePromises.push(packetJourney());
      await wait(nicSpeed);
    }

    // Wait for all packets from this node
    await Promise.all(nodePromises);
  };

  // Transmit from both nodes in parallel
  await Promise.all([
    transmitNodeData(m0, getFinalId(0), 'Node 01', 0),
    transmitNodeData(m1, getFinalId(1), 'Node 02', 1)
  ]);

  if (!isRunning()) return;

  // Mark mapper outputs as persistent
  turnActiveToPersistent(el(getFinalId(0)));
  turnActiveToPersistent(el(getFinalId(1)));
}
