/**
 * Step-by-step simulation engine for teaching mode.
 * Extends the original engine to allow step-by-step execution.
 */

import { createInitialState } from '../pipeline-dual-nodes/state.js';
import { el, ELEMENT_IDS, HEIGHT_SYNC_GROUPS, getSpillSlotId, getCombineSlotId, getSourceRecordId, getMergeInnerId, getFinalSegmentId } from '../pipeline-dual-nodes/dom/selectors.js';
import { highlightNodes, highlightBoxes, setNetworkActive } from '../pipeline-dual-nodes/dom/highlights.js';
import { log } from '../pipeline-dual-nodes/dom/log.js';
import { wait, flyRecord, triggerCombineSweep } from '../pipeline-dual-nodes/dom/animations.js';
import { resetUI } from '../pipeline-dual-nodes/dom/reset.js';
import { foldIntermediateRows, unfoldIntermediateRows } from '../pipeline-dual-nodes/dom/fold.js';
import { CONFIG, SWEEP_COLORS } from '../pipeline-dual-nodes/config.js';
import { sortByPartitionThenKey, combine, mergeSpills, aggregateByKey } from '../pipeline-dual-nodes/combiner.js';
import { shouldSpill, calculateBufferPercentage, getSpillTriggerCount } from '../pipeline-dual-nodes/state.js';
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

/**
 * Step types for the simulation
 */
export const STEP_TYPES = {
  INPUT_INIT: 'INPUT_INIT',
  MAP_BATCH: 'MAP_BATCH',           // Read batch of records into buffer (parallel on both nodes)
  SPILL_SORT: 'SPILL_SORT',         // Sort and spill to disk (parallel on both nodes)
  COMBINE: 'COMBINE',               // Apply combiner to spilled data (parallel on both nodes)
  MERGE: 'MERGE',                   // Merge phase (parallel on both nodes)
  SHUFFLE: 'SHUFFLE',               // Network shuffle (all at once)
  REDUCE_MERGE: 'REDUCE_MERGE',     // Reduce merge sort (all partitions)
  REDUCE: 'REDUCE',                 // Reduce aggregation (all partitions)
  OUTPUT: 'OUTPUT',                 // Write to HDFS (all partitions)
  FINISH: 'FINISH'
};

/**
 * Creates a step-by-step simulation instance.
 * @returns {Object} Simulation API with step-by-step control
 */
export function createStepSimulation() {
  let state = createInitialState();
  let stepQueue = [];
  let currentStepIndex = 0;
  let isExecutingStep = false;
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
  function buildStepQueue() {
    stepQueue = [];
    currentStepIndex = 0;

    const triggerCount = getSpillTriggerCount();

    // Calculate batches for each mapper
    const batches = [];
    for (let mapperId = 0; mapperId < 2; mapperId++) {
      const mapperData = state.mappers[mapperId].data;
      const mapperBatches = [];
      let currentBatch = [];

      for (let i = 0; i < mapperData.length; i++) {
        currentBatch.push({ record: mapperData[i], recordIndex: i });

        const isLastRecord = i === mapperData.length - 1;
        if (currentBatch.length >= triggerCount || isLastRecord) {
          mapperBatches.push([...currentBatch]);
          currentBatch = [];
        }
      }
      batches.push(mapperBatches);
    }

    // Determine max number of batches across both mappers
    const maxBatches = Math.max(batches[0].length, batches[1].length);

    // Phase 1: INPUT
    stepQueue.push({
      type: STEP_TYPES.INPUT_INIT,
      description: 'Initialize job and allocate containers on both nodes',
      phase: 'INPUT'
    });

    // Phase 2: MAP + SPILL - interleaved batches for both nodes
    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
      // MAP_BATCH: Read records into buffer (parallel)
      stepQueue.push({
        type: STEP_TYPES.MAP_BATCH,
        description: `Read batch ${batchIndex + 1} into buffer (both nodes in parallel)`,
        phase: 'MAP',
        batchIndex,
        batches: [
          batches[0][batchIndex] || [],
          batches[1][batchIndex] || []
        ]
      });

      // SPILL_SORT: Sort and spill to disk (parallel)
      stepQueue.push({
        type: STEP_TYPES.SPILL_SORT,
        description: `Spill ${batchIndex + 1}: Sort & write to disk (both nodes)`,
        phase: 'SPILL',
        batchIndex,
        spillIndex: batchIndex
      });

      // COMBINE: Apply combiner to spilled data (parallel)
      stepQueue.push({
        type: STEP_TYPES.COMBINE,
        description: `Spill ${batchIndex + 1}: Apply Combiner (both nodes)`,
        phase: 'COMBINE',
        batchIndex,
        spillIndex: batchIndex
      });
    }

    // Phase 3: MERGE (parallel on both nodes)
    stepQueue.push({
      type: STEP_TYPES.MERGE,
      description: 'Merge sorted spills (both nodes in parallel)',
      phase: 'MERGE'
    });

    // Phase 4: SHUFFLE (all at once)
    stepQueue.push({
      type: STEP_TYPES.SHUFFLE,
      description: 'Network shuffle: transfer partitions to reducers',
      phase: 'SHUFFLE'
    });

    // Phase 5: REDUCE MERGE SORT (all partitions)
    stepQueue.push({
      type: STEP_TYPES.REDUCE_MERGE,
      description: 'Merge sort in all reducers (parallel)',
      phase: 'REDUCE_MERGE'
    });

    // Phase 6: REDUCE (all partitions)
    stepQueue.push({
      type: STEP_TYPES.REDUCE,
      description: 'Aggregate by key in all reducers (parallel)',
      phase: 'REDUCE'
    });

    // Phase 7: OUTPUT (all partitions)
    stepQueue.push({
      type: STEP_TYPES.OUTPUT,
      description: 'Write all partitions to HDFS',
      phase: 'OUTPUT'
    });

    // FINISH
    stepQueue.push({
      type: STEP_TYPES.FINISH,
      description: 'Job complete',
      phase: 'FINISH'
    });
  }

  /**
   * Executes a single step
   */
  async function executeStep(step) {
    const tick = getTick();

    switch (step.type) {
      case STEP_TYPES.INPUT_INIT:
        await executeInputInit(tick);
        break;

      case STEP_TYPES.MAP_BATCH:
        await executeMapBatch(step, tick);
        break;

      case STEP_TYPES.SPILL_SORT:
        await executeSpillSort(step, tick);
        break;

      case STEP_TYPES.COMBINE:
        await executeCombine(step, tick);
        break;

      case STEP_TYPES.MERGE:
        await executeMerge(tick);
        break;

      case STEP_TYPES.SHUFFLE:
        await executeShuffle(tick);
        break;

      case STEP_TYPES.REDUCE_MERGE:
        await executeReduceMerge(tick);
        break;

      case STEP_TYPES.REDUCE:
        await executeReduce(tick);
        break;

      case STEP_TYPES.OUTPUT:
        await executeOutput(tick);
        break;

      case STEP_TYPES.FINISH:
        await executeFinish();
        break;
    }
  }

  // Step execution functions

  async function executeInputInit(tick) {
    highlightNodes([ELEMENT_IDS.NODE_01, ELEMENT_IDS.NODE_02], 'Input Phase');
    highlightBoxes([ELEMENT_IDS.BOX_INPUT_0, ELEMENT_IDS.BOX_INPUT_1]);
    log('<strong>YARN ResourceManager:</strong> Job accepted. Allocated Containers on Node 01, Node 02.', 'SYS');
    updatePhaseDisplay('INPUT');
    await wait(tick * 0.5);
  }

  /**
   * Execute MAP_BATCH: Read batch of records into buffer (parallel on both nodes)
   */
  async function executeMapBatch(step, tick) {
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

        // Add to buffer state
        mapper.buffer.push({ ...record, count: 1 });

        // Animate with slight stagger
        await wait(idx * 50); // Small stagger for visual effect
        await flyRecord(sourceId, bufId, record, tick * 0.4);

        // Render in buffer
        const recId = `buf${mapperId}-rec${mapper.buffer.length - 1 - (batch.length - 1 - idx)}`;
        renderRecordInBuffer(mapperId, record, recId);

        callbacks.onRecordProcessed();
      });

      await Promise.all(flyPromises);

      // Update percentage
      const pct = calculateBufferPercentage(mapper.buffer);
      updateBufferFill(mapperId, pct);
    });

    await Promise.all(mapperPromises);

    log(`<strong>Map Phase:</strong> Batch processed on both nodes in parallel`, 'MAP');
    await wait(tick * 0.2);
  }

  /**
   * Execute SPILL_SORT: Sort and spill to disk (parallel on both nodes)
   */
  async function executeSpillSort(step, tick) {
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

      // Store sorted records for the combine phase
      mapper.pendingSpill = sorted;

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
      mapper.buffer = [];
      updateBufferFill(mapperId, 0);

      callbacks.onSpillCreated();
    });

    await Promise.all(spillPromises);
    await wait(tick * 0.2);
  }

  /**
   * Execute COMBINE: Apply combiner to spilled data (parallel on both nodes)
   */
  async function executeCombine(step, tick) {
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
      mapper.spills.push(combined);
      mapper.pendingSpill = null; // Clear pending spill

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
  async function executeMerge(tick) {
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

      const mergedOrder = [];
      while (true) {
        let minIdx = -1;
        let minRec = null;
        spills.forEach((s, idx) => {
          if (s.pos >= s.data.length) return;
          const cand = s.data[s.pos];
          if (!minRec || cand.p < minRec.p || (cand.p === minRec.p && String(cand.k).localeCompare(String(minRec.k)) < 0)) {
            minRec = cand;
            minIdx = idx;
          }
        });
        if (minIdx === -1) break;
        mergedOrder.push({ rec: spills[minIdx].data[spills[minIdx].pos], sourceId: spills[minIdx].sourceId });
        spills[minIdx].pos++;
      }

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

      mapper.final = mergedOrder.map(i => i.rec);
      mapper._mergeAll = mapper.final;
    });

    await Promise.all(mergePromises);

    log('<strong>Merge Phase:</strong> Merge complete on both nodes', 'DISK');
    await wait(tick * 0.3);
  }

  /**
   * Execute SHUFFLE: Network shuffle (all at once, parallel)
   */
  async function executeShuffle(tick) {
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

        // Add to reducer state
        state.reducers[rec.p].push({ ...rec, sourceMapper: mapperId });

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
    state.shuffleComplete = true;

    log('<strong>Shuffle Complete:</strong> All partitions transferred to reducers.', 'NET');
    await wait(tick * 0.3);
  }

  /**
   * Execute REDUCE_MERGE: Merge sort in all reducers (parallel)
   */
  async function executeReduceMerge(tick) {
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
  async function executeReduce(tick) {
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
        state.reduceOutput[partition].push(rec);
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
  async function executeOutput(tick) {
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

  async function executeFinish() {
    log('<strong>Job Complete.</strong> Output written to HDFS.', 'SYS');
    updatePhaseDisplay('FINISHED');

    const progressEl = el(ELEMENT_IDS.PROGRESS_FILL);
    if (progressEl) progressEl.style.width = '100%';

    state.running = false;
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
    const splitSize = parseInt(el(ELEMENT_IDS.SPLIT_SIZE_INPUT)?.value ?? CONFIG.INPUT_SPLIT_RECORDS, 10);
    state = createInitialState(undefined, undefined, splitSize);
    resetUI(state);
    clearCombineSlots(); // Clear pre-created combine slots for dynamic creation
    buildStepQueue();
    currentStepIndex = 0;
    state.running = true;

    // Disable original buttons
    const startBtn = el(ELEMENT_IDS.START_BTN);
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
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
    const step = stepQueue[currentStepIndex];

    try {
      await executeStep(step);
      // Notify that this step completed (before incrementing index)
      notifyStepComplete(step);
      currentStepIndex++;
      updateProgress();
      notifyStepChange();
    } finally {
      isExecutingStep = false;
    }

    return currentStepIndex < stepQueue.length;
  }

  /**
   * Resets the simulation
   */
  function reset() {
    state.running = false;
    isExecutingStep = false;
    const splitSize = parseInt(el(ELEMENT_IDS.SPLIT_SIZE_INPUT)?.value ?? CONFIG.INPUT_SPLIT_RECORDS, 10);
    state = createInitialState(undefined, undefined, splitSize);
    resetUI(state);
    clearCombineSlots(); // Clear pre-created combine slots for dynamic creation
    buildStepQueue();
    currentStepIndex = 0;

    // Re-enable controls
    const startBtn = el(ELEMENT_IDS.START_BTN);
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
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
