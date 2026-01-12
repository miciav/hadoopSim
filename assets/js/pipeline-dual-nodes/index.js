/**
 * Main entry point for the dual-node MapReduce pipeline simulation.
 */

import { createSimulation, initHeightSync } from './engine.js';
import { el, ELEMENT_IDS } from './dom/selectors.js';
import { foldIntermediateRows, unfoldIntermediateRows } from './dom/fold.js';

// Re-export for external use
export { createSimulation } from './engine.js';
export { createInitialState, RAW_DATA_A, RAW_DATA_B } from './state.js';
export { combine, sortByPartitionThenKey, mergeSpills, aggregateByKey } from './combiner.js';
export { CONFIG, PARTITIONS, LOG_TYPES } from './config.js';

/**
 * Initializes the pipeline simulation and attaches event handlers.
 */
export function initPipeline() {
  const simulation = createSimulation();

  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = el(ELEMENT_IDS.START_BTN);
    const resetBtn = el(ELEMENT_IDS.RESET_BTN);
    const teachingCheck = el(ELEMENT_IDS.TEACHING_MODE);
    const appContainer = document.querySelector('.app');

    // Initialize teaching mode state
    if (teachingCheck && appContainer) {
      if (teachingCheck.checked) {
        appContainer.classList.add('teaching-mode-active');
      }

      teachingCheck.addEventListener('change', (e) => {
        if (e.target.checked) {
          appContainer.classList.add('teaching-mode-active');
          unfoldIntermediateRows();
        } else {
          appContainer.classList.remove('teaching-mode-active');
          // Fold when teaching mode is turned OFF (if shuffle is complete)
          const state = simulation.getState();
          if (state.shuffleComplete) {
            foldIntermediateRows();
          }
        }
      });
    }

    // Attach button handlers
    if (startBtn) {
      startBtn.addEventListener('click', () => simulation.run());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => simulation.reset());
    }

    // Initialize layout sync
    initHeightSync();
  });

  return simulation;
}

// Auto-initialize when loaded as main module
if (typeof window !== 'undefined') {
  window.pipelineSimulation = initPipeline();
}
