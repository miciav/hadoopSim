/**
 * Main entry point for the step-by-step teaching simulation.
 */

import { createStepSimulation } from './engine-step.js';
import { el, ELEMENT_IDS } from '../pipeline-dual-nodes/dom/selectors.js';
import { initHeightSync } from '../pipeline-dual-nodes/engine.js';
import { unfoldIntermediateRows } from '../pipeline-dual-nodes/dom/fold.js';

/**
 * Initializes the step-by-step teaching simulation.
 */
export function initTeachingPipeline() {
  const simulation = createStepSimulation();

  document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.querySelector('.app');
    const stepBtn = document.getElementById('stepBtn');
    const resetStepBtn = document.getElementById('resetStepBtn');
    const stepInfo = document.getElementById('stepInfo');
    const stepCounter = document.getElementById('stepCounter');
    const stepDescription = document.getElementById('stepDescription');
    const stepPhase = document.getElementById('stepPhase');

    // Force teaching mode active
    if (appContainer) {
      appContainer.classList.add('teaching-mode-active');
    }

    // Hide original teaching mode checkbox since we're always in teaching mode
    const teachingCheck = el(ELEMENT_IDS.TEACHING_MODE);
    if (teachingCheck) {
      const label = teachingCheck.closest('label');
      if (label) label.style.display = 'none';
    }

    // Hide original start button (we use step button instead)
    const originalStartBtn = el(ELEMENT_IDS.START_BTN);
    if (originalStartBtn) {
      originalStartBtn.style.display = 'none';
    }

    // Hide original reset button (we use our own)
    const originalResetBtn = el(ELEMENT_IDS.RESET_BTN);
    if (originalResetBtn) {
      originalResetBtn.style.display = 'none';
    }

    // Update UI based on step info
    function updateStepUI(info) {
      if (stepCounter) {
        stepCounter.textContent = `${info.index + 1} / ${info.total}`;
      }

      if (stepDescription) {
        if (info.step) {
          stepDescription.textContent = info.step.description;
        } else if (info.isComplete) {
          stepDescription.textContent = 'Simulation complete!';
        } else {
          stepDescription.textContent = 'Click "Next Step" to begin';
        }
      }

      if (stepPhase && info.step) {
        stepPhase.textContent = info.step.phase;
        stepPhase.className = `step-phase phase-${info.step.phase.toLowerCase().replace('_', '-')}`;
      }

      if (stepBtn) {
        stepBtn.disabled = info.isComplete || simulation.isBusy();
        stepBtn.textContent = info.isComplete ? 'Complete' : 'Next Step';
      }
    }

    // Set up step change callback
    simulation.onStepChange(updateStepUI);

    // Step button handler
    if (stepBtn) {
      stepBtn.addEventListener('click', async () => {
        if (simulation.isBusy()) return;

        // Initialize on first click
        const info = simulation.getCurrentStepInfo();
        if (info.total === 0 || info.index === 0 && !simulation.getState().running) {
          simulation.init();
          unfoldIntermediateRows();
        }

        stepBtn.disabled = true;
        await simulation.nextStep();
        stepBtn.disabled = simulation.isComplete();
      });
    }

    // Reset button handler
    if (resetStepBtn) {
      resetStepBtn.addEventListener('click', () => {
        simulation.reset();
        updateStepUI({
          step: null,
          index: 0,
          total: 0,
          isComplete: false
        });
        if (stepDescription) {
          stepDescription.textContent = 'Click "Next Step" to begin';
        }
        if (stepCounter) {
          stepCounter.textContent = '0 / 0';
        }
        if (stepPhase) {
          stepPhase.textContent = 'READY';
          stepPhase.className = 'step-phase';
        }
      });
    }

    // Handle split size changes
    const splitInput = el(ELEMENT_IDS.SPLIT_SIZE_INPUT);
    if (splitInput) {
      splitInput.addEventListener('change', () => {
        if (!simulation.getState().running) {
          simulation.reset();
        }
      });
    }

    // Initialize height sync
    initHeightSync();

    // Initial UI state
    if (stepDescription) {
      stepDescription.textContent = 'Click "Next Step" to begin';
    }
    if (stepPhase) {
      stepPhase.textContent = 'READY';
    }
  });

  return simulation;
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.teachingSimulation = initTeachingPipeline();
}
