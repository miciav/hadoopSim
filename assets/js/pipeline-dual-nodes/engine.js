import { createActor, fromPromise, toPromise } from 'xstate';
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
import { runMergeAnimation, runMergeSortOutput } from './phases/merge.js';
import { runNetworkShuffle } from './phases/shuffle.js';
import { runReduce, runReduceMergeSort } from './phases/reduce.js';
import { runOutput } from './phases/output.js';

/**
 * Creates a simulation instance.
 * @returns {Object} Simulation API: { run, stop, reset, getState }
 */
export function createSimulation() {
  let state = createInitialState();
  let runActor = null;

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
    const runState = state;
    let runSignal;
    const startBtn = el(ELEMENT_IDS.START_BTN);
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
    if (startBtn) startBtn.disabled = true;
    if (splitInput) splitInput.disabled = true;

    resetUI(state);

    const teachingLatched = callbacks.isTeaching();
    const runCallbacks = {
      ...callbacks,
      isRunning: () => runState.running && state === runState && !runSignal?.aborted,
      isTeaching: () => teachingLatched,
      onRecordProcessed: () => { if (runState.running) callbacks.onRecordProcessed(); },
      onSpillCreated: () => { if (runState.running) callbacks.onSpillCreated(); },
      onNetPacket: () => { if (runState.running) callbacks.onNetPacket(); }
    };

    const speed = parseFloat(el(ELEMENT_IDS.SPEED_SLIDER)?.value ?? 1.5);
    const tick = 1000 / speed;

    const actor = createActor(fromPromise(async ({ signal }) => {
      runSignal = signal;
      runCallbacks.signal = signal;
      // Phase 1: INPUT
      if (!runCallbacks.isRunning()) return;
      await runInputPhase(tick, runState, runCallbacks);

      // Phase 2: MAP & BUFFER
      if (!runCallbacks.isRunning()) return;
      await runMapPhase(tick, runState, runCallbacks);

      // Phase 3: MERGE
      if (!runCallbacks.isRunning()) return;
      await runMergePhase(tick, runState, runCallbacks);

      // Phase 4: SHUFFLE
      if (!runCallbacks.isRunning()) return;
      await runShufflePhase(tick, runState, runCallbacks);

      // Phase 5: REDUCE MERGE SORT
      if (!runCallbacks.isRunning()) return;
      await runReduceMergeSortPhase(tick, runState, runCallbacks);

      // Phase 6: REDUCE
      if (!runCallbacks.isRunning()) return;
      await runReducePhase(tick, runState, runCallbacks);

      // Phase 7: OUTPUT
      if (!runCallbacks.isRunning()) return;
      await runOutputPhase(tick, runState, runCallbacks);

      // Complete
      if (runCallbacks.isRunning()) finishSimulation();
    }));
    runActor = actor;
    actor.start();
    await toPromise(actor);
    if (runActor === actor) runActor = null;
  }

  /**
   * Phase 1: Initialize and show input.
   */
  async function runInputPhase(tick, runState, runCallbacks) {
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Map Phase');
    highlightBoxes([ELEMENT_IDS.BOX_INPUT_0, ELEMENT_IDS.BOX_INPUT_1]);
    log('<strong>YARN ResourceManager:</strong> Job accepted. Allocated Containers on Node 01, Node 02.', 'SYS');
    await wait(tick, runCallbacks.signal);
  }

  /**
   * Phase 2: Run mappers in parallel.
   */
  async function runMapPhase(tick, runState, runCallbacks) {
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Map Processing');
    highlightBoxes([ELEMENT_IDS.BOX_MAP_0, ELEMENT_IDS.BOX_MAP_1]);
    log('<strong>Map Phase:</strong> Tasks started. Filling JVM Heap Buffers.', 'MAP');

    await Promise.all([
      runMapper(runState, 0, tick, ELEMENT_IDS.NODE_01, runCallbacks),
      runMapper(runState, 1, tick * 1.1, ELEMENT_IDS.NODE_02, runCallbacks)
    ]);
  }

  /**
   * Phase 3: Merge spills.
   */
  async function runMergePhase(tick, runState, runCallbacks) {
    if (!runState.running) return;

    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Merge Phase');
    highlightBoxes([ELEMENT_IDS.BOX_MERGE_0, ELEMENT_IDS.BOX_MERGE_1]);
    log('<strong>Merge Phase:</strong> Multi-way merge of sorted spills...', 'DISK');

    // Animation: fly records to merge output in sorted order
    await Promise.all([
      runMergeAnimation(runState, 0, tick, runCallbacks.isRunning, runCallbacks.signal),
      runMergeAnimation(runState, 1, tick * 1.05, runCallbacks.isRunning, runCallbacks.signal)
    ]);

    if (!runState.running) return;
    await wait(tick, runCallbacks.signal);

    // Finalize merge output (ghost source spills)
    await Promise.all([
      runMergeSortOutput(runState, 0, tick, runCallbacks.isRunning, runCallbacks.signal),
      runMergeSortOutput(runState, 1, tick, runCallbacks.isRunning, runCallbacks.signal)
    ]);
  }

  /**
   * Phase 4: Network shuffle.
   */
  async function runShufflePhase(tick, runState, runCallbacks) {
    if (!runState.running) return;

    highlightNodes(null, 'Network Shuffle');
    setNetworkActive(true);
    log('<strong>Shuffle Phase:</strong> Nodes streaming partitions in parallel via HTTP.', 'NET');

    await runNetworkShuffle(runState, tick, runCallbacks);

    if (!runState.running) return;

    setNetworkActive(false);
    runState.shuffleComplete = true;

    // Fold if teaching mode is OFF
    if (!runCallbacks.isTeaching()) {
      await foldIntermediateRows(runCallbacks.isRunning, runCallbacks.signal);
    }
  }

  /**
   * Phase 5: Reduce.
   */
  async function runReducePhase(tick, runState, runCallbacks) {
    if (!runState.running) return;

    highlightNodes(null, 'Reduce Phase');
    highlightBoxes([ELEMENT_IDS.BOX_RED_0, ELEMENT_IDS.BOX_RED_1, ELEMENT_IDS.BOX_RED_2]);
    log('<strong>Reduce Phase:</strong> Sort/Group & Aggregation started.', 'RED');

    await runReduce(runState, tick, runCallbacks.isRunning, runCallbacks.signal);
  }

  /**
   * Phase 5: Reducer merge sort.
   */
  async function runReduceMergeSortPhase(tick, runState, runCallbacks) {
    if (!runState.running) return;

    highlightNodes(null, 'Reduce Merge Sort');
    highlightBoxes([ELEMENT_IDS.BOX_RED_0, ELEMENT_IDS.BOX_RED_1, ELEMENT_IDS.BOX_RED_2]);
    log('<strong>Reduce Merge Sort:</strong> Merging sorted map outputs...', 'RED');

    await runReduceMergeSort(runState, tick, runCallbacks.isRunning, runCallbacks.isTeaching, runCallbacks.signal);
  }

  /**
   * Phase 6: Output to HDFS.
   */
  async function runOutputPhase(tick, runState, runCallbacks) {
    if (!runState.running) return;

    highlightNodes(null, 'Output Phase');
    highlightBoxes([ELEMENT_IDS.BOX_HDFS_OUTPUT]);
    log('<strong>Output Phase:</strong> Writing results to HDFS...', 'SYS');

    await runOutput(runState, tick, runCallbacks.isRunning, runCallbacks.signal);
  }

  /**
   * Finishes the simulation.
   */
  function finishSimulation() {
    log('<strong>Job Complete.</strong> Output written to HDFS.', 'SYS');

    const phaseEl = el(ELEMENT_IDS.PHASE);
    if (phaseEl) phaseEl.textContent = 'FINISHED';

    const startBtn = el(ELEMENT_IDS.START_BTN);
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
    if (startBtn) startBtn.disabled = false;
    if (splitInput) splitInput.disabled = false;

    state.running = false;

    const progressEl = el(ELEMENT_IDS.PROGRESS_FILL);
    if (progressEl) progressEl.style.width = '100%';
  }

  /**
   * Stops the simulation.
   */
  function stop() {
    state.running = false;
    runActor?.stop();
    runActor = null;
  }

  /**
   * Resets the simulation to initial state.
   */
  function reset() {
    state.running = false;
    runActor?.stop();
    runActor = null;
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
    const requestedSize = Number(splitInput?.value);
    const splitSize = Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : state.splitSize;
    if (splitInput) splitInput.value = String(splitSize);
    state = createInitialState(undefined, undefined, splitSize);
    resetUI(state);

    const startBtn = el(ELEMENT_IDS.START_BTN);
    if (startBtn) startBtn.disabled = false;
    if (splitInput) splitInput.disabled = false;
  }

  /**
   * Gets current state (for debugging).
   */
  function getState() {
    return state;
  }

  function updateSplitSize(size) {
    if (state.running) return;
    state = createInitialState(undefined, undefined, size);
    resetUI(state);
  }

  return { run, stop, reset, getState, updateSplitSize };
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
