/**
 * Configuration constants for the dual-node MapReduce pipeline simulation.
 */

export const CONFIG = Object.freeze({
  BUFFER_CAPACITY: 6,
  SPILL_THRESHOLD: 0.75,
  INPUT_SPLIT_RECORDS: 10,
  DEFAULT_SPEED: 1.5,
  MAX_LOG_ENTRIES: 30
});

export const PARTITIONS = Object.freeze({
  0: { id: 0, cssClass: 'bg-p0' },
  1: { id: 1, cssClass: 'bg-p1' },
  2: { id: 2, cssClass: 'bg-p2' }
});
