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

export function getSpillSlotId(mapperId, spillIndex) {
  const label = mapperId === 0 ? 'A' : 'B';
  return `spill${label}${spillIndex}`;
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
  'finalA', 'finalB',
  'red0', 'red1', 'red2',
  'hdfsOut0', 'hdfsOut1', 'hdfsOut2'
]);

// Box pairs for height sync
export const HEIGHT_SYNC_GROUPS = Object.freeze([
  ['boxInput0', 'boxInput1'],
  ['boxMap0', 'boxMap1'],
  ['boxSpill0', 'boxSpill1'],
  ['boxMerge0', 'boxMerge1'],
  ['spillA0', 'spillB0'],
  ['spillA1', 'spillB1'],
  ['finalA', 'finalB'],
  ['boxRed0', 'boxRed1', 'boxRed2'],
  ['hdfsOut0', 'hdfsOut1', 'hdfsOut2']
]);
