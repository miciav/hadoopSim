/**
 * DOM manipulation for MapReduce record elements.
 */

/**
 * Creates a key-value record element.
 * @param {Object} data - Record data with k (key), c (css class)
 * @param {number} count - Count to display
 * @returns {HTMLElement}
 */
export function createRecordElement(data, count = 1) {
  const div = document.createElement('div');
  div.className = `kv-record ${data.c}`;
  div.textContent = `${data.k}:${count}`;
  return div;
}

/**
 * Creates an input record element (for HDFS display, shows only key).
 * @param {Object} data - Record data
 * @param {string} id - Element ID
 * @returns {HTMLElement}
 */
export function createInputRecordElement(data, id) {
  const div = document.createElement('div');
  div.className = `kv-record ${data.c} show persistent`;
  div.id = id;
  div.textContent = data.k;
  return div;
}

/**
 * Shows a record by adding the 'show' class.
 * @param {HTMLElement} element
 */
export function showRecord(element) {
  element.classList.add('show');
}

/**
 * Marks a record as ghost (faded out).
 * @param {HTMLElement} element
 */
export function markAsGhost(element) {
  element.classList.add('ghost');
  element.classList.remove('show');
}

/**
 * Marks a record as persistent (stays visible).
 * @param {HTMLElement} element
 */
export function markAsPersistent(element) {
  element.classList.add('persistent');
  element.classList.remove('show');
}

/**
 * Turns all active records in a container to ghosts.
 * @param {HTMLElement} container
 */
export function turnActiveToGhosts(container) {
  if (!container) return;
  const records = container.querySelectorAll('.kv-record:not(.ghost):not(.persistent):not(.reduce-output)');
  records.forEach(markAsGhost);
}

/**
 * Turns all active records in a container to persistent.
 * @param {HTMLElement} container
 */
export function turnActiveToPersistent(container) {
  if (!container) return;
  const records = container.querySelectorAll('.kv-record:not(.ghost):not(.persistent):not(.reduce-output)');
  records.forEach(markAsPersistent);
}

/**
 * Removes all record elements from a container.
 * @param {HTMLElement} container
 */
export function clearRecords(container) {
  if (!container) return;
  container.querySelectorAll('.kv-record').forEach(r => r.remove());
}

/**
 * Removes all flying record elements from the document.
 */
export function clearFlyingRecords() {
  document.querySelectorAll('.flying-record').forEach(r => r.remove());
}
