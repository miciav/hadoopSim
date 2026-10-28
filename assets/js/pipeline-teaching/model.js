import { aggregateByKey, combine, mergeSortedSpills, sortByPartitionThenKey } from '../pipeline-dual-nodes/combiner.js';
import { STEP_TYPES } from './steps.js';

export function applyTeachingStep(previous, step) {
  const state = structuredClone(previous);
  switch (step.type) {
    case STEP_TYPES.INPUT_INIT:
      state.running = true;
      break;
    case STEP_TYPES.MAP_BATCH:
      step.batches.forEach((batch, index) => {
        state.mappers[index].buffer.push(...batch.map(({ record }) => ({ ...record, count: 1 })));
      });
      break;
    case STEP_TYPES.SPILL_SORT:
      state.mappers.forEach((mapper) => {
        if (mapper.buffer.length) mapper.pendingSpill = sortByPartitionThenKey(mapper.buffer);
        mapper.buffer = [];
      });
      break;
    case STEP_TYPES.COMBINE:
      state.mappers.forEach((mapper) => {
        if (mapper.pendingSpill?.length) mapper.spills.push(combine(mapper.pendingSpill));
        mapper.pendingSpill = null;
      });
      break;
    case STEP_TYPES.MERGE:
      state.mappers.forEach((mapper) => {
        mapper.final = mergeSortedSpills(mapper.spills).map(({ record }) => record);
        mapper._mergeAll = mapper.final;
      });
      break;
    case STEP_TYPES.SHUFFLE:
      state.mappers.forEach((mapper, sourceMapper) => {
        sortByPartitionThenKey(mapper.final).forEach((record) => {
          state.reducers[record.p].push({ ...record, sourceMapper });
        });
      });
      state.shuffleComplete = true;
      break;
    case STEP_TYPES.REDUCE_MERGE:
      Object.keys(state.reducers).forEach((partition) => {
        state.reducers[partition] = sortByPartitionThenKey(state.reducers[partition]);
      });
      break;
    case STEP_TYPES.REDUCE:
      Object.keys(state.reducers).forEach((partition) => {
        state.reduceOutput[partition] = Array.from(aggregateByKey(state.reducers[partition]), ([k, count]) => ({
          k, p: Number(partition), c: `bg-p${partition}`, count
        }));
      });
      break;
    case STEP_TYPES.FINISH:
      state.running = false;
      break;
  }
  return state;
}
