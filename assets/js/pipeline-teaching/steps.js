import { getSpillTriggerCount } from '../pipeline-dual-nodes/state.js';

/**
 * Step types for the simulation
 */
export const STEP_TYPES = {
  INPUT_INIT: 'INPUT_INIT',
  MAP_BATCH: 'MAP_BATCH', // Read batch of records into buffer (parallel on both nodes)
  SPILL_SORT: 'SPILL_SORT', // Sort and spill to disk (parallel on both nodes)
  COMBINE: 'COMBINE', // Apply combiner to spilled data (parallel on both nodes)
  MERGE: 'MERGE', // Merge phase (parallel on both nodes)
  SHUFFLE: 'SHUFFLE', // Network shuffle (all at once)
  REDUCE_MERGE: 'REDUCE_MERGE', // Reduce merge sort (all partitions)
  REDUCE: 'REDUCE', // Reduce aggregation (all partitions)
  OUTPUT: 'OUTPUT', // Write to HDFS (all partitions)
  FINISH: 'FINISH'
};

export function buildTeachingSteps(state) {
  const stepQueue = [];

  const triggerCount = getSpillTriggerCount();

  // Calculate batches for each mapper
  const batches = [];
  for (let mapperId = 0; mapperId < 2; mapperId++) {
    const mapperBatches = [];
    let recordIndex = 0;
    for (const split of state.inputSplits[mapperId]) {
      for (let offset = 0; offset < split.length; offset += triggerCount) {
        const batch = split
          .slice(offset, offset + triggerCount)
          .map((record) => ({
            record,
            recordIndex: recordIndex++
          }));
        mapperBatches.push(batch);
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
      batches: [batches[0][batchIndex] || [], batches[1][batchIndex] || []]
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
  return stepQueue;
}
