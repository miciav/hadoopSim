/**
 * Node and box highlighting for phase visualization.
 */

import { el, ELEMENT_IDS } from './selectors.js';

/**
 * Highlights specified nodes and updates phase display.
 * @param {string[]|null} nodeIds - Array of node IDs to highlight, or null to clear
 * @param {string} phaseName - Name of current phase
 */
export function highlightNodes(nodeIds, phaseName) {
  // Clear all node highlights
  document.querySelectorAll('.node-container').forEach(n =>
    n.classList.remove('active-node')
  );
  // Clear all box highlights
  document.querySelectorAll('.box-content').forEach(b =>
    b.classList.remove('active')
  );

  // Apply new node highlights
  if (nodeIds) {
    nodeIds.forEach(id => {
      const n = el(id);
      if (n) n.classList.add('active-node');
    });
  }

  // Update phase display
  const phaseEl = el(ELEMENT_IDS.PHASE);
  if (phaseEl) phaseEl.textContent = phaseName;
}

/**
 * Highlights specified boxes.
 * @param {string[]|null} boxIds - Array of box IDs to highlight, or null to clear
 */
export function highlightBoxes(boxIds) {
  // Clear all box highlights
  document.querySelectorAll('.box-content').forEach(b =>
    b.classList.remove('active')
  );

  // Apply new box highlights
  if (boxIds) {
    boxIds.forEach(id => {
      const b = el(id);
      if (b) b.classList.add('active');
    });
  }
}

/**
 * Sets network layer active state.
 * @param {boolean} active - Whether network is active
 */
export function setNetworkActive(active) {
  const layer = el(ELEMENT_IDS.NETWORK_LAYER);
  const pulse = el(ELEMENT_IDS.NET_PULSE);

  if (layer) {
    layer.style.borderColor = active ? '#3b82f6' : '#475569';
  }
  if (pulse) {
    pulse.classList.toggle('active', active);
  }
}
