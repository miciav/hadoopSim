import { createActor, fromPromise, toPromise } from 'xstate';
/**
 * Step-by-step simulation engine for teaching mode.
 * Extends the original engine to allow step-by-step execution.
 */

import { createInitialState } from '../pipeline-dual-nodes/state.js';
import { el, ELEMENT_IDS, HEIGHT_SYNC_GROUPS, getSpillSlotId, getCombineSlotId, getSourceRecordId, getMergeInnerId, getFinalSegmentId } from '../pipeline-dual-nodes/dom/selectors.js';
import { highlightNodes, highlightBoxes, setNetworkActive } from '../pipeline-dual-nodes/dom/highlights.js';
import { log } from '../pipeline-dual-nodes/dom/log.js';
import { wait as baseWait, flyRecord as baseFlyRecord, triggerCombineSweep } from '../pipeline-dual-nodes/dom/animations.js';
import { resetUI } from '../pipeline-dual-nodes/dom/reset.js';
import { foldIntermediateRows, unfoldIntermediateRows } from '../pipeline-dual-nodes/dom/fold.js';
import { SWEEP_COLORS } from '../pipeline-dual-nodes/config.js';
import { sortByPartitionThenKey, combine, mergeSortedSpills, aggregateByKey } from '../pipeline-dual-nodes/combiner.js';
import { shouldSpill, calculateBufferPercentage } from '../pipeline-dual-nodes/state.js';
import { updateBufferFill } from '../pipeline-dual-nodes/dom/buffers.js';
import {
  renderRecordInBuffer,
  renderRecordInSpill,
  renderRecordInCombine,
  renderRecordInFinal,
  renderRecordInReducer,
  renderRecordInReduceOutput,
  renderRecordInHdfsOutput,
  turnActiveToGhosts,
  removeActiveRecords,
  revealSpillSlot,
  revealCombineRow,
  createCombineSlot,
  clearCombineSlots,
  revealMergeRow
} from './dom-helpers.js';

import { STEP_TYPES, buildTeachingSteps } from './steps.js';
import { applyTeachingStep } from './model.js';
export { STEP_TYPES } from './steps.js';

/**
 * Creates a step-by-step simulation instance.
 * @returns {Object} Simulation API with step-by-step control
 */
export function createStepSimulation() {
  let state = createInitialState();
  let stepQueue = [];
  let currentStepIndex = 0;
  let isExecutingStep = false;
  let generation = 0;
  let stepActor = null;
  let onStepChangeCallback = null;
  let onStepCompleteCallback = null;

  const callbacks = {
    isRunning: () => state.running,
    isTeaching: () => true, // Always teaching mode
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
   * Gets the speed/tick value
   */
  function getTick() {
    const speed = parseFloat(el(ELEMENT_IDS.SPEED_SLIDER)?.value ?? 1.5);
    return 1000 / speed;
  }

  /**
   * Builds all steps for the simulation
   */

  /**
   * Executes a single step
   */
  async function executeStep(step, signal) {
    const tick = getTick();

    switch (step.type) {
      case STEP_TYPES.INPUT_INIT:
        await executeInputInit(tick, signal);
        break;

      case STEP_TYPES.MAP_BATCH:
        await executeMapBatch(step, tick, signal);
        break;

      case STEP_TYPES.SPILL_SORT:
        await executeSpillSort(step, tick, signal);
        break;

      case STEP_TYPES.COMBINE:
        await executeCombine(step, tick, signal);
        break;

      case STEP_TYPES.MERGE:
        await executeMerge(tick, signal);
        break;

      case STEP_TYPES.SHUFFLE:
        await executeShuffle(tick, signal);
        break;

      case STEP_TYPES.REDUCE_MERGE:
        await executeReduceMerge(tick, signal);
        break;

      case STEP_TYPES.REDUCE:
        await executeReduce(tick, signal);
        break;

      case STEP_TYPES.OUTPUT:
        await executeOutput(tick, signal);
        break;

      case STEP_TYPES.FINISH:
        await executeFinish(signal);
        break;
    }
  }

  function abortable(promise, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Step cancelled', 'AbortError'));
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  // Step execution functions

  async function executeInputInit(tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Input Phase');
    highlightBoxes([ELEMENT_IDS.BOX_INPUT_0, ELEMENT_IDS.BOX_INPUT_1]);
    log('<strong>YARN ResourceManager:</strong> Job accepted. Allocated Containers on Node 01, Node 02.', 'SYS');
    updatePhaseDisplay('INPUT');
    await wait(tick * 0.5);
  }

  /**
   * Execute MAP_BATCH: Read batch of records into buffer (parallel on both nodes)
   */
  async function executeMapBatch(step, tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    const { batches } = step;

    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Map Processing');
    highlightBoxes([ELEMENT_IDS.BOX_MAP_0, ELEMENT_IDS.BOX_MAP_1]);
    updatePhaseDisplay('MAP');

    // Process both mappers in parallel
    const mapperPromises = batches.map(async (batch, mapperId) => {
      if (!batch || batch.length === 0) return;

      const mapper = state.mappers[mapperId];
      const bufId = `buf${mapperId}`;

      // Fly all records in parallel
      const flyPromises = batch.map(async ({ record, recordIndex }, idx) => {
        const sourceId = getSourceRecordId(mapperId, recordIndex);

        // Ensure record has CSS class based on partition
        if (!record.c) {
          record.c = `bg-p${record.p}`;
        }

        // Animate with slight stagger
        await wait(idx * 50); // Small stagger for visual effect
        await flyRecord(sourceId, bufId, record, tick * 0.4);

        // Render in buffer
        const recId = `buf${mapperId}-rec${mapper.buffer.length + idx}`;
        renderRecordInBuffer(mapperId, record, recId);

        callbacks.onRecordProcessed();
      });

      await Promise.all(flyPromises);

      // Update percentage
      const pct = calculateBufferPercentage([...mapper.buffer, ...batch]);
      updateBufferFill(mapperId, pct);
    });

    await Promise.all(mapperPromises);

    log(`<strong>Map Phase:</strong> Batch processed on both nodes in parallel`, 'MAP');
    await wait(tick * 0.2);
  }

  /**
   * Execute SPILL_SORT: Sort and spill to disk (parallel on both nodes)
   */
  async function executeSpillSort(step, tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    const { spillIndex } = step;

    highlightBoxes([ELEMENT_IDS.BOX_SPILL_0, ELEMENT_IDS.BOX_SPILL_1]);
    updatePhaseDisplay('SPILL');

    log(`<strong>Spill ${spillIndex + 1}:</strong> Sorting & spilling on both nodes in parallel`, 'DISK');

    // Process both mappers in parallel
    const spillPromises = [0, 1].map(async (mapperId) => {
      const mapper = state.mappers[mapperId];
      if (mapper.buffer.length === 0) return;

      // Sort buffer
      const sorted = sortByPartitionThenKey(mapper.buffer);

      // Reveal spill slot
      revealSpillSlot(mapperId, spillIndex);

      // Animate records from buffer to spill (in parallel)
      const spillContainerId = getSpillSlotId(mapperId, spillIndex);
      const flyPromises = sorted.map(async (rec, i) => {
        // Ensure record has CSS class based on partition
        if (!rec.c) {
          rec.c = `bg-p${rec.p}`;
        }
        const sourceId = `buf${mapperId}-rec${i}`;
        await wait(i * 30); // Small stagger
        await flyRecord(sourceId, spillContainerId, rec, tick * 0.3);
        renderRecordInSpill(mapperId, spillIndex, rec, `${spillContainerId}-rec${i}`);
      });

      await Promise.all(flyPromises);

      // Clear buffer visually and state
      const bufEl = el(`buf${mapperId}`);
      if (bufEl) {
        const records = bufEl.querySelectorAll('.kv-record:not(.buffer-fill)');
        records.forEach(r => r.remove());
      }
      updateBufferFill(mapperId, 0);

      callbacks.onSpillCreated();
    });

    await Promise.all(spillPromises);
    await wait(tick * 0.2);
  }

  /**
   * Execute COMBINE: Apply combiner to spilled data (parallel on both nodes)
   */
  async function executeCombine(step, tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    const { spillIndex } = step;

    // Highlight combine boxes
    highlightBoxes(['boxCombine0', 'boxCombine1']);
    updatePhaseDisplay('COMBINE');

    log(`<strong>Spill ${spillIndex + 1}:</strong> Applying Combiner on both nodes`, 'DISK');

    // Process both mappers in parallel
    const combinePromises = [0, 1].map(async (mapperId) => {
      const mapper = state.mappers[mapperId];

      // Get the sorted records stored during spill phase
      const spillRecords = mapper.pendingSpill;
      if (!spillRecords || spillRecords.length === 0) return;

      // Reveal combine row and create combine slot dynamically
      revealCombineRow(mapperId);
      createCombineSlot(mapperId, spillIndex);

      const spillContainerId = getSpillSlotId(mapperId, spillIndex);
      const combineContainerId = getCombineSlotId(mapperId, spillIndex);

      triggerCombineSweep(spillContainerId, SWEEP_COLORS.AMBER);

      await wait(tick * 0.4);

      // Combine records
      const combined = combine(spillRecords);

      // Render combined records (ensure CSS class is set)
      for (let i = 0; i < combined.length; i++) {
        const rec = combined[i];
        // Ensure record has CSS class based on partition
        if (!rec.c) {
          rec.c = `bg-p${rec.p}`;
        }
        renderRecordInCombine(mapperId, spillIndex, rec, `${combineContainerId}-rec${i}`);
      }

      // Ghost the spill records
      const spillEl = el(spillContainerId);
      if (spillEl) {
        turnActiveToGhosts(spillEl);
      }
    });

    await Promise.all(combinePromises);

    log(`<strong>Spill ${spillIndex + 1}:</strong> Combiner completed on both nodes`, 'DISK');
    await wait(tick * 0.2);
  }

  /**
   * Execute MERGE: Merge phase (parallel on both nodes)
   */
  async function executeMerge(tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Merge Phase');
    highlightBoxes([ELEMENT_IDS.BOX_MERGE_0, ELEMENT_IDS.BOX_MERGE_1]);
    updatePhaseDisplay('MERGE');
    log('<strong>Merge Phase:</strong> Multi-way merge of sorted spills on both nodes...', 'DISK');

    // Reveal merge rows
    revealMergeRow(0);
    revealMergeRow(1);

    await wait(tick * 0.3);

    // Process both mappers in parallel
    const mergePromises = [0, 1].map(async (mapperId) => {
      const mapper = state.mappers[mapperId];
      if (mapper.spills.length === 0) return;

      const mergeInnerId = getMergeInnerId(mapperId);
      const mergeInner = el(mergeInnerId);

      // Build multi-way merge from spills
      const spills = mapper.spills.map((data, idx) => {
        const combineId = getCombineSlotId(mapperId, idx);
        const sourceId = el(combineId) ? combineId : getSpillSlotId(mapperId, idx);
        return { data: [...data], sourceId, pos: 0 };
      });

      const mergedOrder = mergeSortedSpills(spills.map(spill => spill.data)).map(({ record, sourceIndex }) => ({
        rec: record,
        sourceId: spills[sourceIndex].sourceId
      }));

      // 1. Fly records from combine slots to Local Merge Sort box (in parallel with stagger)
      const mergeElements = [];
      const flyToMergePromises = mergedOrder.map(async (item, i) => {
        await wait(i * 40);
        await flyRecord(item.sourceId, mergeInnerId, item.rec, tick * 0.4);

        if (mergeInner) {
          const recEl = document.createElement('div');
          recEl.className = `kv-record ${item.rec.c} show`;
          recEl.id = `merge${mapperId}-rec${i}`;
          recEl.textContent = `${item.rec.k}:${item.rec.count || 1}`;
          mergeInner.appendChild(recEl);
          mergeElements[i] = recEl;
        }
      });

      await Promise.all(flyToMergePromises);

      // Ghost combine slots
      for (let si = 0; si < mapper.spills.length; si++) {
        const combineEl = el(getCombineSlotId(mapperId, si));
        if (combineEl) {
          turnActiveToGhosts(combineEl);
        }
      }

      await wait(tick * 0.3);

      // 2. Fly records from Local Merge Sort to final segments (in parallel with stagger)
      const finalId = mapperId === 0 ? 'finalA' : 'finalB';
      const flyToFinalPromises = mergedOrder.map(async (item, i) => {
        const segmentId = getFinalSegmentId(mapperId, item.rec.p);

        await wait(i * 30);
        await flyRecord(mergeInnerId, segmentId, item.rec, tick * 0.4);

        // Ghost in merge box
        if (mergeElements[i]) {
          mergeElements[i].classList.add('ghost');
          mergeElements[i].classList.remove('show');
        }

        // Add to final segment
        renderRecordInFinal(mapperId, item.rec, `${finalId}-rec${i}`, segmentId);
      });

      await Promise.all(flyToFinalPromises);

    });

    await Promise.all(mergePromises);

    log('<strong>Merge Phase:</strong> Merge complete on both nodes', 'DISK');
    await wait(tick * 0.3);
  }

  /**
   * Execute SHUFFLE: Network shuffle (all at once, parallel)
   */
  async function executeShuffle(tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    highlightNodes(null, 'Network Shuffle');
    setNetworkActive(true);
    updatePhaseDisplay('SHUFFLE');
    log('<strong>Shuffle Phase:</strong> Both nodes streaming partitions in parallel via HTTP.', 'NET');

    // Show all reducer segments
    for (let p = 0; p < 3; p++) {
      const segmentsEl = el(`red${p}Segments`);
      if (segmentsEl) segmentsEl.classList.add('active');
    }

    // Execute shuffle for both mappers in parallel
    const shufflePromises = [0, 1].map(async (mapperId) => {
      const mapper = state.mappers[mapperId];
      const finalId = mapperId === 0 ? 'finalA' : 'finalB';
      const sorted = sortByPartitionThenKey(mapper.final);

      const packetPromises = sorted.map(async (rec, i) => {
        const sourceId = `${finalId}-rec${i}`;
        const targetSegId = `red${rec.p}Seg${mapperId}`;

        await wait(i * 60 + mapperId * 30); // Stagger with offset per mapper

        await flyRecord(sourceId, ELEMENT_IDS.NET_HUB, rec, tick * 0.3);
        callbacks.onNetPacket();
        await wait(tick * 0.05);
        await flyRecord(ELEMENT_IDS.NET_HUB, targetSegId, rec, tick * 0.3);

        // Render in reducer segment
        renderRecordInReducer(rec.p, rec, `red${rec.p}-seg${mapperId}-rec${i}`, targetSegId);
      });

      await Promise.all(packetPromises);

      // Ghost final outputs
      const finalEl = el(finalId);
      if (finalEl) {
        turnActiveToGhosts(finalEl);
      }
    });

    await Promise.all(shufflePromises);

    setNetworkActive(false);

    log('<strong>Shuffle Complete:</strong> All partitions transferred to reducers.', 'NET');
    await wait(tick * 0.3);
  }

  /**
   * Execute REDUCE_MERGE: Merge sort in all reducers (parallel)
   */
  async function executeReduceMerge(tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    highlightNodes(null, 'Reduce Merge Sort');
    highlightBoxes([ELEMENT_IDS.BOX_RED_0, ELEMENT_IDS.BOX_RED_1, ELEMENT_IDS.BOX_RED_2]);
    updatePhaseDisplay('REDUCE_MERGE');
    log('<strong>Reduce Merge Sort:</strong> Merging sorted map outputs in all reducers...', 'RED');

    // Process all partitions in parallel
    const mergePromises = [0, 1, 2].map(async (p) => {
      const mergeEl = el(`red${p}Merge`);
      if (mergeEl) mergeEl.classList.add('active');

      const records = state.reducers[p];
      const sorted = sortByPartitionThenKey(records);

      triggerCombineSweep(`red${p}Merge`, SWEEP_COLORS.PURPLE);
      await wait(tick * 0.4);

      // Render sorted in merge box (with stagger)
      const renderPromises = sorted.map(async (rec, i) => {
        await wait(i * 40);
        renderRecordInReducer(p, rec, `red${p}-merge-rec${i}`, `red${p}Merge`);
      });

      await Promise.all(renderPromises);

      // Ghost segments
      const seg0 = el(`red${p}Seg0`);
      const seg1 = el(`red${p}Seg1`);
      if (seg0) turnActiveToGhosts(seg0);
      if (seg1) turnActiveToGhosts(seg1);
    });

    await Promise.all(mergePromises);

    await wait(tick * 0.3);
  }

  /**
   * Execute REDUCE: Aggregate by key in all reducers (parallel)
   */
  async function executeReduce(tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    highlightNodes(null, 'Reduce Phase');
    highlightBoxes([ELEMENT_IDS.BOX_RED_0, ELEMENT_IDS.BOX_RED_1, ELEMENT_IDS.BOX_RED_2]);
    updatePhaseDisplay('REDUCE');
    log('<strong>Reduce Phase:</strong> Aggregating values by key in all reducers...', 'RED');

    // Process all partitions in parallel
    const reducePromises = [0, 1, 2].map(async (partition) => {
      const records = state.reducers[partition];
      const aggregated = aggregateByKey(records);

      triggerCombineSweep(`red${partition}Reduce`, SWEEP_COLORS.PURPLE);
      await wait(tick * 0.4);

      // Ghost merge records
      const mergeEl = el(`red${partition}Merge`);
      if (mergeEl) turnActiveToGhosts(mergeEl);

      // Render aggregated records (with stagger)
      let idx = 0;
      for (const [key, count] of aggregated.entries()) {
        const rec = { k: key, p: partition, c: `bg-p${partition}`, count };
        await wait(idx * 50);
        renderRecordInReduceOutput(partition, rec, `red${partition}-out-rec${idx}`);
        idx++;
      }
    });

    await Promise.all(reducePromises);

    log('<strong>Reduce Phase:</strong> Aggregation complete on all partitions', 'RED');
    await wait(tick * 0.2);
  }

  /**
   * Execute OUTPUT: Write all partitions to HDFS
   */
  async function executeOutput(tick, signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    highlightNodes(null, 'Output Phase');
    highlightBoxes([ELEMENT_IDS.BOX_HDFS_OUTPUT]);
    updatePhaseDisplay('OUTPUT');
    log('<strong>Output Phase:</strong> Writing all partitions to HDFS...', 'SYS');

    // Process all partitions in parallel
    const outputPromises = [0, 1, 2].map(async (partition) => {
      const records = state.reduceOutput[partition];
      const reduceOutputEl = el(`red${partition}Reduce`);

      const writePromises = records.map(async (rec, i) => {
        const sourceId = `red${partition}-out-rec${i}`;
        await wait(i * 60 + partition * 40); // Stagger with offset per partition
        await flyRecord(sourceId, `hdfsOut${partition}`, rec, tick * 0.4);
        renderRecordInHdfsOutput(partition, rec, `hdfs${partition}-rec${i}`);
      });

      await Promise.all(writePromises);

      // Ghost reduce output
      if (reduceOutputEl) turnActiveToGhosts(reduceOutputEl);
    });

    await Promise.all(outputPromises);

    log('<strong>HDFS:</strong> All partitions written (part-r-00000, part-r-00001, part-r-00002)', 'SYS');
    await wait(tick * 0.2);
  }

  async function executeFinish(signal) {
    const wait = (ms) => abortable(baseWait(ms), signal);
    const flyRecord = (...args) => abortable(baseFlyRecord(...args), signal);
    log('<strong>Job Complete.</strong> Output written to HDFS.', 'SYS');
    updatePhaseDisplay('FINISHED');

    const progressEl = el(ELEMENT_IDS.PROGRESS_FILL);
    if (progressEl) progressEl.style.width = '100%';

  }

  function updatePhaseDisplay(phase) {
    const phaseEl = el(ELEMENT_IDS.PHASE);
    if (phaseEl) phaseEl.textContent = phase;
  }

  function updateProgress() {
    const progressEl = el(ELEMENT_IDS.PROGRESS_FILL);
    if (progressEl && stepQueue.length > 0) {
      const pct = Math.round((currentStepIndex / stepQueue.length) * 100);
      progressEl.style.width = `${pct}%`;
    }
  }

  // Public API

  /**
   * Initializes the step-by-step simulation
   */
  function init() {
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
    const requestedSize = Number(splitInput?.value);
    const splitSize = Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : state.splitSize;
    if (splitInput) splitInput.value = String(splitSize);
    state = createInitialState(undefined, undefined, splitSize);
    resetUI(state);
    clearCombineSlots(); // Clear pre-created combine slots for dynamic creation
    stepQueue = buildTeachingSteps(state);
    currentStepIndex = 0;
    state.running = true;

    // Disable original buttons
    const startBtn = el(ELEMENT_IDS.START_BTN);
    if (startBtn) startBtn.disabled = true;
    if (splitInput) splitInput.disabled = true;

    notifyStepChange();
  }

  /**
   * Executes the next step
   */
  async function nextStep() {
    if (isExecutingStep) return false;
    if (currentStepIndex >= stepQueue.length) return false;

    isExecutingStep = true;
    const stepGeneration = generation;
    const step = stepQueue[currentStepIndex];

    try {
      const nextState = applyTeachingStep(state, step);
      stepActor = createActor(fromPromise(({ signal }) => executeStep(step, signal)));
      stepActor.start();
      await toPromise(stepActor);
      if (generation !== stepGeneration) return false;
      state = nextState;
      // Notify that this step completed (before incrementing index)
      notifyStepComplete(step);
      currentStepIndex++;
      updateProgress();
      notifyStepChange();
    } finally {
      if (generation === stepGeneration) isExecutingStep = false;
    }

    return currentStepIndex < stepQueue.length;
  }

  /**
   * Resets the simulation
   */
  function reset() {
    generation++;
    stepActor?.stop();
    stepActor = null;
    state.running = false;
    isExecutingStep = false;
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
    const requestedSize = Number(splitInput?.value);
    const splitSize = Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : state.splitSize;
    if (splitInput) splitInput.value = String(splitSize);
    state = createInitialState(undefined, undefined, splitSize);
    resetUI(state);
    clearCombineSlots(); // Clear pre-created combine slots for dynamic creation
    stepQueue = buildTeachingSteps(state);
    currentStepIndex = 0;

    // Re-enable controls
    const startBtn = el(ELEMENT_IDS.START_BTN);
    if (startBtn) startBtn.disabled = false;
    if (splitInput) splitInput.disabled = false;

    updatePhaseDisplay('IDLE');
    notifyStepChange();
  }

  /**
   * Gets current step info
   */
  function getCurrentStepInfo() {
    if (currentStepIndex >= stepQueue.length) {
      return { step: null, index: currentStepIndex, total: stepQueue.length, isComplete: true };
    }
    return {
      step: stepQueue[currentStepIndex],
      index: currentStepIndex,
      total: stepQueue.length,
      isComplete: false
    };
  }

  /**
   * Sets callback for step changes (called after index increments, for next step info)
   */
  function onStepChange(callback) {
    onStepChangeCallback = callback;
  }

  /**
   * Sets callback for step completion (called after step executes, with completed step info)
   */
  function onStepComplete(callback) {
    onStepCompleteCallback = callback;
  }

  function notifyStepChange() {
    if (onStepChangeCallback) {
      onStepChangeCallback(getCurrentStepInfo());
    }
  }

  function notifyStepComplete(completedStep) {
    if (onStepCompleteCallback) {
      onStepCompleteCallback(completedStep);
    }
  }

  /**
   * Gets current state
   */
  function getState() {
    return state;
  }

  /**
   * Checks if simulation is complete
   */
  function isComplete() {
    return currentStepIndex >= stepQueue.length;
  }

  /**
   * Checks if currently executing a step
   */
  function isBusy() {
    return isExecutingStep;
  }

  return {
    init,
    nextStep,
    reset,
    getCurrentStepInfo,
    onStepChange,
    onStepComplete,
    getState,
    isComplete,
    isBusy
  };
}
