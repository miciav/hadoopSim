/**
 * Buffer fill indicator management.
 */

import { el, getFillId, getPctId } from './selectors.js';

/**
 * Updates buffer fill indicator display.
 * @param {number} mapperId - Mapper ID (0 or 1)
 * @param {number} percentage - Fill percentage (0-100)
 */
export function updateBufferFill(mapperId, percentage) {
  const fillEl = el(getFillId(mapperId));
  const pctEl = el(getPctId(mapperId));

  if (fillEl) {
    fillEl.style.height = percentage + '%';
  }
  if (pctEl) {
    pctEl.innerText = percentage + '%';
  }
}

/**
 * Sets buffer fill to limit state (visual warning).
 * @param {number} mapperId - Mapper ID
 * @param {boolean} isLimit - Whether at limit
 */
export function setBufferLimit(mapperId, isLimit) {
  const fillEl = el(getFillId(mapperId));
  if (fillEl) {
    fillEl.classList.toggle('limit', isLimit);
  }
}

/**
 * Resets buffer fill indicator.
 * @param {number} mapperId - Mapper ID
 */
export function resetBufferFill(mapperId) {
  updateBufferFill(mapperId, 0);
  setBufferLimit(mapperId, false);
}

/**
 * Resets all buffer fill indicators.
 */
export function resetAllBufferFills() {
  resetBufferFill(0);
  resetBufferFill(1);
}
