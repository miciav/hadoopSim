/**
 * Pure combining and sorting logic for MapReduce records.
 * All functions are pure and fully testable without DOM.
 */

/**
 * Combines records by key, summing counts.
 * @param {Array<{k: string, p: number, c: string, count?: number}>} records
 * @returns {Array<{k: string, p: number, c: string, count: number}>}
 */
export function combine(records) {
  const map = new Map();

  for (const record of records) {
    const existing = map.get(record.k);
    if (existing) {
      existing.count += (record.count || 1);
    } else {
      map.set(record.k, { ...record, count: record.count || 1 });
    }
  }

  return Array.from(map.values());
}

/**
 * Sorts records by partition first, then by key alphabetically.
 * Returns a new array without mutating the original.
 * @param {Array<{k: string, p: number}>} records
 * @returns {Array<{k: string, p: number}>}
 */
export function sortByPartitionThenKey(records) {
  return [...records].sort((a, b) => {
    const partitionDiff = a.p - b.p;
    if (partitionDiff !== 0) return partitionDiff;
    return a.k.localeCompare(b.k);
  });
}

/**
 * Merges multiple spills into a single sorted and combined output.
 * @param {Array<Array<Record>>} spills
 * @returns {Array<Record>}
 */
export function mergeSpills(spills) {
  const all = spills.flat();
  const sorted = sortByPartitionThenKey(all);
  return combine(sorted);
}

/**
 * Aggregates reducer input by key, producing final counts.
 * Used in the reduce phase.
 * @param {Array<{k: string, count?: number}>} records
 * @returns {Map<string, number>}
 */
export function aggregateByKey(records) {
  const map = new Map();
  for (const record of records) {
    const prev = map.get(record.k) || 0;
    map.set(record.k, prev + (record.count || 1));
  }
  return map;
}

/**
 * Sorts and combines a buffer before spilling.
 * @param {Array<Record>} buffer
 * @returns {Array<Record>}
 */
export function sortAndCombineBuffer(buffer) {
  const sorted = sortByPartitionThenKey(buffer);
  return combine(sorted);
}
