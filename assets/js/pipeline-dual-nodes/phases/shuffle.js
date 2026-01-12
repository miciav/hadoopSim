/**
 * Shuffle phase: network transfer of partitioned data to reducers.
 */

import { el, getFinalId, getReducerId, ELEMENT_IDS } from '../dom/selectors.js';
import { createRecordElement, showRecord, turnActiveToPersistent } from '../dom/records.js';
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

  const m0 = state.mappers[0].final;
  const m1 = state.mappers[1].final;

  /**
   * Transmits data from a single node to reducers.
   */
  const transmitNodeData = async (records, sourceId, nodeName) => {
    const localQueue = sortByPartitionThenKey(records);
    const nodePromises = [];
    const nicSpeed = tick / 4;
    let currentP = -1;

    for (const rec of localQueue) {
      if (!isRunning()) break;

      // Log partition changes in teaching mode
      if (isTeaching() && rec.p !== currentP) {
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

        // Fly to reducer
        const targetId = getReducerId(rec.p);

        // Update state
        if (state.reducers[rec.p]) {
          state.reducers[rec.p].push(rec);
        }

        await flyRecord(ELEMENT_IDS.NET_HUB, targetId, rec, tick * 0.5);

        // Land in reducer
        const targetBox = el(targetId);
        if (targetBox) {
          const r = createRecordElement(rec, rec.count);
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
    transmitNodeData(m0, getFinalId(0), 'Node 01'),
    transmitNodeData(m1, getFinalId(1), 'Node 02')
  ]);

  if (!isRunning()) return;

  // Mark mapper outputs as persistent
  turnActiveToPersistent(el(getFinalId(0)));
  turnActiveToPersistent(el(getFinalId(1)));
}
