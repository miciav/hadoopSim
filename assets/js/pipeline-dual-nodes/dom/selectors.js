/**
 * DOM element ID constants and query helpers.
 * Centralizes all element IDs to eliminate magic strings.
 */

export const ELEMENT_IDS = Object.freeze({
  // Controls
  START_BTN: 'startBtn',
  RESET_BTN: 'resetBtn',
  TEACHING_MODE: 'teachingMode',
  SPEED_SLIDER: 'speedSlider',

  // Metrics
  RECORDS_COUNT: 'mRecords',
  SPILLS_COUNT: 'mSpills',
  NET_COUNT: 'mNet',
  PHASE: 'mPhase',
  PROGRESS_FILL: 'progressFill',

  // Nodes
  NODE_01: 'node01',
  NODE_02: 'node02',

  // Inputs
  BOX_INPUT_0: 'boxInput0',
  BOX_INPUT_1: 'boxInput1',

  // Mapper buffers
  BUF_0: 'buf0',
  BUF_1: 'buf1',
  FILL_0: 'fill0',
  FILL_1: 'fill1',
  PCT_0: 'pct0',
  PCT_1: 'pct1',
  BOX_MAP_0: 'boxMap0',
  BOX_MAP_1: 'boxMap1',

  // Spills
  BOX_SPILL_0: 'boxSpill0',
  BOX_SPILL_1: 'boxSpill1',
  BOX_COMBINE_0: 'boxCombine0',
  BOX_COMBINE_1: 'boxCombine1',

  // Merge outputs
  BOX_MERGE_0: 'boxMerge0',
  BOX_MERGE_1: 'boxMerge1',
  FINAL_A: 'finalA',
  FINAL_B: 'finalB',

  // Network
  NETWORK_LAYER: 'networkLayer',
  NET_PULSE: 'netPulse',
  NET_HUB: 'netHub',

  // Reducer Nodes
  NODE_RED_0: 'nodeRed0',
  NODE_RED_1: 'nodeRed1',
  NODE_RED_2: 'nodeRed2',
  BOX_RED_0: 'boxRed0',
  BOX_RED_1: 'boxRed1',
  BOX_RED_2: 'boxRed2',
  RED_0: 'red0',
  RED_1: 'red1',
  RED_2: 'red2',
  REDUCE_0: 'red0Reduce',
  REDUCE_1: 'red1Reduce',
  REDUCE_2: 'red2Reduce',

  // HDFS Output
  BOX_HDFS_OUTPUT: 'boxHdfsOutput',
  HDFS_OUT_0: 'hdfsOut0',
  HDFS_OUT_1: 'hdfsOut1',
  HDFS_OUT_2: 'hdfsOut2',

  // Log
  CONSOLE_LOG: 'consoleLog'
});

// Dynamic ID generators
export function getBufferId(mapperId) {
  return `buf${mapperId}`;
}

export function getFillId(mapperId) {
  return `fill${mapperId}`;
}

export function getPctId(mapperId) {
  return `pct${mapperId}`;
}

export function getBoxMapId(mapperId) {
  return `boxMap${mapperId}`;
}

export function getBoxSpillId(mapperId) {
  return `boxSpill${mapperId}`;
}

export function getBoxCombineId(mapperId) {
  return `boxCombine${mapperId}`;
}

export function getSpillSlotId(mapperId, spillIndex) {
  const label = mapperId === 0 ? 'A' : 'B';
  return `spill${label}${spillIndex}`;
}

export function getCombineSlotId(mapperId, spillIndex) {
  const label = mapperId === 0 ? 'A' : 'B';
  return `combine${label}${spillIndex}`;
}

export function getFinalId(mapperId) {
  return mapperId === 0 ? 'finalA' : 'finalB';
}

export function getSourceRecordId(mapperId, recordIndex) {
  return `src-${mapperId}-${recordIndex}`;
}

export function getReducerId(partition) {
  return `red${partition}`;
}

export function getReducerSegmentsId(partition) {
  return `red${partition}Segments`;
}

export function getReducerSegmentId(partition, mapperId) {
  return `red${partition}Seg${mapperId}`;
}

export function getReducerMergeId(partition) {
  return `red${partition}Merge`;
}

export function getReducerOutputId(partition) {
  return `red${partition}Reduce`;
}

export function getNodeRedId(partition) {
  return `nodeRed${partition}`;
}

export function getBoxRedId(partition) {
  return `boxRed${partition}`;
}

export function getHdfsOutId(partition) {
  return `hdfsOut${partition}`;
}

// Simple element getter (no caching to avoid stale references)
export function el(id) {
  return document.getElementById(id);
}

// All container IDs that need to be cleared on reset
export const CLEARABLE_CONTAINERS = Object.freeze([
  'buf0', 'buf1',
  'spillA0', 'spillA1', 'spillB0', 'spillB1',
  'combineA0', 'combineA1', 'combineB0', 'combineB1',
  'finalA', 'finalB',
  'red0', 'red1', 'red2',
  'red0Reduce', 'red1Reduce', 'red2Reduce',
  'red0Seg0', 'red0Seg1', 'red1Seg0', 'red1Seg1', 'red2Seg0', 'red2Seg1',
  'red0Merge', 'red1Merge', 'red2Merge',
  'hdfsOut0', 'hdfsOut1', 'hdfsOut2'
]);

// Box pairs for height sync
export const HEIGHT_SYNC_GROUPS = Object.freeze([
  ['boxInput0', 'boxInput1'],
  ['boxMap0', 'boxMap1'],
  ['boxSpill0', 'boxSpill1'],
  ['boxCombine0', 'boxCombine1'],
  ['boxMerge0', 'boxMerge1'],
  ['spillA0', 'spillB0'],
  ['spillA1', 'spillB1'],
  ['combineA0', 'combineB0'],
  ['combineA1', 'combineB1'],
  ['finalA', 'finalB'],
  ['boxRed0', 'boxRed1', 'boxRed2'],
  ['red0Reduce', 'red1Reduce', 'red2Reduce'],
  ['hdfsOut0', 'hdfsOut1', 'hdfsOut2']
]);
