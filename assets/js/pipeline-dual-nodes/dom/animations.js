/**
 * Animation utilities for record movement and visual effects.
 */

import { el } from './selectors.js';
import { createRecordElement } from './records.js';

/**
 * Returns a promise that resolves after the specified delay.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Animates a record flying from source to target element.
 * @param {string} sourceId - ID of source element
 * @param {string} targetId - ID of target element
 * @param {Object} recordData - Record data for display
 * @param {number} duration - Animation duration in ms
 */
export async function flyRecord(
  sourceId,
  targetId,
  recordData,
  duration,
  signal
) {
  signal?.throwIfAborted();
  const src = el(sourceId);
  const tgt = el(targetId);
  if (!src || !tgt) return;

  const r1 = src.getBoundingClientRect();
  const r2 = tgt.getBoundingClientRect();

  const flyer = createRecordElement(recordData, recordData.count || 1);
  flyer.classList.add('flying-record', 'show');
  document.body.appendChild(flyer);

  // Position at source center
  flyer.style.left = r1.left + r1.width / 2 + window.scrollX - 15 + 'px';
  flyer.style.top = r1.top + r1.height / 2 + window.scrollY - 8 + 'px';

  // Force reflow to enable transition
  flyer.getBoundingClientRect();

  // Animate to target center
  flyer.style.left = r2.left + r2.width / 2 + window.scrollX - 15 + 'px';
  flyer.style.top = r2.top + r2.height / 2 + window.scrollY - 8 + 'px';
  flyer.style.transition = `top ${duration}ms ease-in-out, left ${duration}ms ease-in-out`;

  try {
    await wait(duration, signal);
  } finally {
    flyer.remove();
  }
}

/**
 * Triggers a combine sweep animation effect on a container.
 * @param {string} elementId - Container element ID
 * @param {string} colorVariant - CSS class for color (e.g., 'sweep-amber')
 */
export function triggerCombineSweep(elementId, colorVariant = '', signal) {
  if (signal?.aborted) return;
  const container = el(elementId);
  if (!container) return;

  // Remove any existing sweep
  const existing = container.querySelector('.combine-sweep');
  if (existing) existing.remove();

  // Create sweep overlay
  const sweep = document.createElement('div');
  sweep.className = `combine-sweep ${colorVariant}`;
  container.appendChild(sweep);

  // Clean up after animation
  let timer;
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cleanup);
    sweep.remove();
  };
  timer = setTimeout(cleanup, 1100);
  signal?.addEventListener('abort', cleanup, { once: true });
}
