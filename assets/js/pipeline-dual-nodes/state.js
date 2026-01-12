/**
 * State management for the dual-node MapReduce pipeline simulation.
 * Provides factory functions and pure state transitions.
 */

import { CONFIG } from './config.js';

// Raw data as immutable constants
export const RAW_DATA_A = Object.freeze([
  { k: 'cat', p: 0, c: 'bg-p0' }, { k: 'cat', p: 0, c: 'bg-p0' },
  { k: 'dog', p: 1, c: 'bg-p1' }, { k: 'dog', p: 1, c: 'bg-p1' },
  { k: 'ant', p: 2, c: 'bg-p2' }, { k: 'ant', p: 2, c: 'bg-p2' },
  { k: 'car', p: 0, c: 'bg-p0' }, { k: 'day', p: 1, c: 'bg-p1' },
  { k: 'cat', p: 0, c: 'bg-p0' }, { k: 'dog', p: 1, c: 'bg-p1' }
]);

export const RAW_DATA_B = Object.freeze([
  { k: 'cup', p: 0, c: 'bg-p0' }, { k: 'dot', p: 1, c: 'bg-p1' },
  { k: 'dot', p: 1, c: 'bg-p1' }, { k: 'arm', p: 2, c: 'bg-p2' },
  { k: 'cup', p: 0, c: 'bg-p0' }, { k: 'arm', p: 2, c: 'bg-p2' },
  { k: 'dog', p: 1, c: 'bg-p1' }, { k: 'cat', p: 0, c: 'bg-p0' }
]);

/**
 * Creates a fresh mapper state.
 * @param {number} id - Mapper ID (0 or 1)
 * @param {Array} data - Input data for this mapper
 * @returns {Object} Mapper state
 */
function createMapperState(id, data) {
  return {
    id,
    buffer: [],
    spills: [],
    final: [],
    data: [...data],
    _mergeAll: null
  };
}

/**
 * Factory function for creating a fresh simulation state.
 * @param {Array} dataA - Data for mapper 0 (optional, defaults to RAW_DATA_A)
 * @param {Array} dataB - Data for mapper 1 (optional, defaults to RAW_DATA_B)
 * @returns {Object} Initial state
 */
export function createInitialState(dataA = RAW_DATA_A, dataB = RAW_DATA_B) {
  return {
    running: false,
    shuffleComplete: false,
    mappers: [
      createMapperState(0, dataA),
      createMapperState(1, dataB)
    ],
    reducers: { 0: [], 1: [], 2: [] }
  };
}

// --- Pure state transition functions (immutable) ---

/**
 * Adds a record to a mapper's buffer.
 * @param {Object} mapperState
 * @param {Object} record
 * @returns {Object} New mapper state
 */
export function addToBuffer(mapperState, record) {
  return {
    ...mapperState,
    buffer: [...mapperState.buffer, record]
  };
}

/**
 * Clears a mapper's buffer.
 * @param {Object} mapperState
 * @returns {Object} New mapper state
 */
export function clearBuffer(mapperState) {
  return {
    ...mapperState,
    buffer: []
  };
}

/**
 * Adds a spill to a mapper's spill list.
 * @param {Object} mapperState
 * @param {Array} spillData
 * @returns {Object} New mapper state
 */
export function addSpill(mapperState, spillData) {
  return {
    ...mapperState,
    spills: [...mapperState.spills, spillData]
  };
}

/**
 * Sets a mapper's final merged output.
 * @param {Object} mapperState
 * @param {Array} finalData
 * @returns {Object} New mapper state
 */
export function setFinal(mapperState, finalData) {
  return {
    ...mapperState,
    final: finalData
  };
}

/**
 * Adds a record to a reducer partition.
 * @param {Object} reducersState
 * @param {number} partition
 * @param {Object} record
 * @returns {Object} New reducers state
 */
export function addToReducer(reducersState, partition, record) {
  return {
    ...reducersState,
    [partition]: [...reducersState[partition], record]
  };
}

// --- Utility functions ---

/**
 * Calculates buffer usage as a ratio (0 to 1).
 * @param {Array} buffer
 * @param {number} capacity - Buffer capacity (defaults to CONFIG.BUFFER_CAPACITY)
 * @returns {number} Usage ratio
 */
export function calculateBufferUsage(buffer, capacity = CONFIG.BUFFER_CAPACITY) {
  return buffer.length / capacity;
}

/**
 * Determines if a buffer should be spilled.
 * @param {Array} buffer
 * @param {number} threshold - Spill threshold ratio (defaults to CONFIG.SPILL_THRESHOLD)
 * @param {number} capacity - Buffer capacity (defaults to CONFIG.BUFFER_CAPACITY)
 * @returns {boolean} True if buffer should spill
 */
export function shouldSpill(buffer, threshold = CONFIG.SPILL_THRESHOLD, capacity = CONFIG.BUFFER_CAPACITY) {
  return calculateBufferUsage(buffer, capacity) >= threshold;
}

/**
 * Calculates buffer percentage (0 to 100).
 * @param {Array} buffer
 * @param {number} capacity
 * @returns {number} Percentage (capped at 100)
 */
export function calculateBufferPercentage(buffer, capacity = CONFIG.BUFFER_CAPACITY) {
  return Math.min(100, Math.round(calculateBufferUsage(buffer, capacity) * 100));
}
