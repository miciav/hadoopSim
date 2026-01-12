/**
 * Simulation engine: orchestrates all phases of the MapReduce pipeline.
 */

import { createInitialState } from './state.js';
import { el, ELEMENT_IDS, HEIGHT_SYNC_GROUPS } from './dom/selectors.js';
import { highlightNodes, highlightBoxes, setNetworkActive } from './dom/highlights.js';
import { log } from './dom/log.js';
import { wait } from './dom/animations.js';
import { resetUI } from './dom/reset.js';
import { foldIntermediateRows, unfoldIntermediateRows } from './dom/fold.js';
import { runMapper } from './phases/mapper.js';
import { runMergeAnimation, runMergeCombine } from './phases/merge.js';
import { runNetworkShuffle } from './phases/shuffle.js';
import { runReduce } from './phases/reduce.js';
import { runOutput } from './phases/output.js';

/**
 * Creates a simulation instance.
 * @returns {Object} Simulation API: { run, stop, reset, getState }
 */
export function createSimulation() {
  let state = createInitialState();

  // Callbacks for phase functions
  const callbacks = {
    isRunning: () => state.running,
    isTeaching: () => el(ELEMENT_IDS.TEACHING_MODE)?.checked ?? false,
    onRecordProcessed: () => {
      const countEl = el(ELEMENT_IDS.RECORDS_COUNT);
      if (countEl) countEl.innerText = parseInt(countEl.innerText) + 1;
    },
    onSpillCreated: () => {
      const spillEl = el(ELEMENT_IDS.SPILLS_COUNT);
      if (spillEl) spillEl.innerText = parseInt(spillEl.innerText) + 1;
    },
    onNetPacket: () => {
      const netEl = el(ELEMENT_IDS.NET_COUNT);
      if (netEl) netEl.innerText = parseInt(netEl.innerText) + 1;
    }
  };

  /**
   * Runs the complete simulation.
   */
  async function run() {
    if (state.running) return;

    state.running = true;
    const startBtn = el(ELEMENT_IDS.START_BTN);
    if (startBtn) startBtn.disabled = true;

    resetUI(state);

    const speed = parseFloat(el(ELEMENT_IDS.SPEED_SLIDER)?.value ?? 1.5);
    const tick = 1000 / speed;

    // Phase 1: INPUT
    if (!state.running) return;
    await runInputPhase(tick);

    // Phase 2: MAP & BUFFER
    if (!state.running) return;
    await runMapPhase(tick);

    // Phase 3: MERGE
    if (!state.running) return;
    await runMergePhase(tick);

    // Phase 4: SHUFFLE
    if (!state.running) return;
    await runShufflePhase(tick);

    // Phase 5: REDUCE
    if (!state.running) return;
    await runReducePhase(tick);

    // Phase 6: OUTPUT
    if (!state.running) return;
    await runOutputPhase(tick);

    // Complete
    finishSimulation();
  }

  /**
   * Phase 1: Initialize and show input.
   */
  async function runInputPhase(tick) {
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Map Phase');
    highlightBoxes([ELEMENT_IDS.BOX_INPUT_0, ELEMENT_IDS.BOX_INPUT_1]);
    log('<strong>YARN ResourceManager:</strong> Job accepted. Allocated Containers on Node 01, Node 02.', 'SYS');
    await wait(tick);
  }

  /**
   * Phase 2: Run mappers in parallel.
   */
  async function runMapPhase(tick) {
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Map Processing');
    highlightBoxes([ELEMENT_IDS.BOX_MAP_0, ELEMENT_IDS.BOX_MAP_1]);
    log('<strong>Map Phase:</strong> Tasks started. Filling JVM Heap Buffers.', 'MAP');

    await Promise.all([
      runMapper(state, 0, tick, ELEMENT_IDS.NODE_01, callbacks),
      runMapper(state, 1, tick * 1.1, ELEMENT_IDS.NODE_02, callbacks)
    ]);
  }

  /**
   * Phase 3: Merge spills.
   */
  async function runMergePhase(tick) {
    if (!state.running) return;

    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Merge Sort');
    highlightBoxes([ELEMENT_IDS.BOX_MERGE_0, ELEMENT_IDS.BOX_MERGE_1]);
    log('<strong>Merge Phase:</strong> Map tasks finished input. Merging spills...', 'DISK');

    // Animation: fly records to merge output
    await Promise.all([
      runMergeAnimation(state, 0, tick, callbacks.isRunning),
      runMergeAnimation(state, 1, tick * 1.05, callbacks.isRunning)
    ]);

    if (!state.running) return;
    await wait(tick);

    // Combine with sweep effect
    log('<strong>Merge Phase:</strong> Combining sorted spills...', 'DISK');
    await Promise.all([
      runMergeCombine(state, 0, tick, callbacks.isRunning),
      runMergeCombine(state, 1, tick, callbacks.isRunning)
    ]);
  }

  /**
   * Phase 4: Network shuffle.
   */
  async function runShufflePhase(tick) {
    if (!state.running) return;

    highlightNodes(null, 'Network Shuffle');
    setNetworkActive(true);
    log('<strong>Shuffle Phase:</strong> Nodes streaming partitions in parallel via HTTP.', 'NET');

    await runNetworkShuffle(state, tick, callbacks);

    if (!state.running) return;

    setNetworkActive(false);
    state.shuffleComplete = true;

    // Fold if teaching mode is OFF
    if (!callbacks.isTeaching()) {
      await foldIntermediateRows();
    }
  }

  /**
   * Phase 5: Reduce.
   */
  async function runReducePhase(tick) {
    if (!state.running) return;

    highlightNodes(null, 'Reduce Phase');
    highlightBoxes([ELEMENT_IDS.BOX_RED_0, ELEMENT_IDS.BOX_RED_1, ELEMENT_IDS.BOX_RED_2]);
    log('<strong>Reduce Phase:</strong> Sort/Group & Aggregation started.', 'RED');

    await runReduce(state, tick, callbacks.isRunning);
  }

  /**
   * Phase 6: Output to HDFS.
   */
  async function runOutputPhase(tick) {
    if (!state.running) return;

    highlightNodes(null, 'Output Phase');
    highlightBoxes([ELEMENT_IDS.BOX_HDFS_OUTPUT]);
    log('<strong>Output Phase:</strong> Writing results to HDFS...', 'SYS');

    await runOutput(state, tick, callbacks.isRunning);
  }

  /**
   * Finishes the simulation.
   */
  function finishSimulation() {
    log('<strong>Job Complete.</strong> Output written to HDFS.', 'SYS');

    const phaseEl = el(ELEMENT_IDS.PHASE);
    if (phaseEl) phaseEl.textContent = 'FINISHED';

    const startBtn = el(ELEMENT_IDS.START_BTN);
    if (startBtn) startBtn.disabled = false;

    state.running = false;

    const progressEl = el(ELEMENT_IDS.PROGRESS_FILL);
    if (progressEl) progressEl.style.width = '100%';
  }

  /**
   * Stops the simulation.
   */
  function stop() {
    state.running = false;
  }

  /**
   * Resets the simulation to initial state.
   */
  function reset() {
    state.running = false;
    state = createInitialState();
    resetUI(state);

    const startBtn = el(ELEMENT_IDS.START_BTN);
    if (startBtn) startBtn.disabled = false;
  }

  /**
   * Gets current state (for debugging).
   */
  function getState() {
    return state;
  }

  return { run, stop, reset, getState };
}

/**
 * Initializes height synchronization for layout.
 */
export function initHeightSync() {
  let isAdjusting = false;

  const ro = new ResizeObserver(() => {
    if (isAdjusting) return;

    window.requestAnimationFrame(() => {
      isAdjusting = true;

      HEIGHT_SYNC_GROUPS.forEach(ids => {
        const elements = ids.map(id => el(id)).filter(e => e !== null);
        if (elements.length < 2) return;

        // Reset heights
        elements.forEach(e => e.style.minHeight = '');

        // Measure natural heights
        const heights = elements.map(e => e.scrollHeight);

        // Apply max height to all
        const maxH = Math.max(...heights);
        elements.forEach(e => e.style.minHeight = `${maxH}px`);
      });

      isAdjusting = false;
    });
  });

  // Observe all synced elements
  HEIGHT_SYNC_GROUPS.flat().forEach(id => {
    const e = el(id);
    if (e) ro.observe(e);
  });
}
