/**
 * Main entry point for the step-by-step teaching simulation.
 */

import { createStepSimulation } from './engine-step.js';
import { el, ELEMENT_IDS } from '../pipeline-dual-nodes/dom/selectors.js';
import { initHeightSync } from '../pipeline-dual-nodes/engine.js';
import { unfoldIntermediateRows } from '../pipeline-dual-nodes/dom/fold.js';

/**
 * Phase explanations for the teaching callout.
 * Each phase has a title and description explaining what happens.
 */
const PHASE_EXPLANATIONS = {
  READY: {
    title: 'Welcome to Hadoop MapReduce',
    description: 'Click "Next Step" to begin the step-by-step simulation. Each step will show you how data flows through the MapReduce pipeline, from input splits to final output files.',
    targetSelector: null
  },
  INPUT: {
    title: 'Reading Input Splits',
    description: 'The <strong>InputFormat</strong> reads data from HDFS and divides it into <strong>Input Splits</strong>. Each split is processed by one Map task. The records are shown as colored boxes - each color represents a different <strong>partition</strong> (determined by the key\'s hash).',
    targetSelector: '#node02 .box-hdfs'
  },
  MAP: {
    title: 'Map Phase - Processing Records',
    description: 'Records fly from the input split into the <strong>Map buffer (JVM RAM)</strong>. The mapper\'s <code>map()</code> function transforms each input record into key-value pairs. The buffer fills up as records are processed.',
    targetSelector: '#node02 .box-ram'
  },
  SPILL: {
    title: 'Spill to Disk',
    description: 'When the buffer reaches 80% capacity, a <strong>spill</strong> occurs. Records are <strong>sorted by partition and key</strong>, then written to the local disk. The sorted data is stored in spill files on the local filesystem.',
    targetSelector: '#node02 .box-disk'
  },
  COMBINE: {
    title: 'Combiner (Mini-Reducer)',
    description: 'The <strong>Combiner</strong> acts as a local reducer, aggregating values for the same key before the shuffle. This reduces network traffic by sending fewer, pre-aggregated records. For word count, it sums counts locally: <code>(apple,1), (apple,1) → (apple,2)</code>.',
    targetSelector: '#node02 .box-combine'
  },
  MERGE: {
    title: 'Local Merge Sort',
    description: 'After all map output is generated, the <strong>Local Merge Sort</strong> combines all spill files into a single sorted output file using a <strong>multi-way merge</strong> algorithm. The result is partitioned and ready for the shuffle phase.',
    targetSelector: '#node02 .mapper-merge-row'
  },
  SHUFFLE: {
    title: 'Shuffle Phase - Network Transfer',
    description: 'The <strong>Shuffle</strong> moves map outputs across the network to reducer nodes. Each reducer fetches only the partition it needs from all mappers. This is often the most expensive phase due to network I/O.',
    targetSelector: '.network-layer'
  },
  REDUCE_MERGE: {
    title: 'Reducer Merge Sort',
    description: 'Each reducer receives segments from multiple mappers. These segments are <strong>merge-sorted</strong> to group all values for the same key together. This prepares the data for the reduce function.',
    targetSelector: '#nodeRed2 .box-reduce'
  },
  REDUCE: {
    title: 'Reduce Phase - Aggregation',
    description: 'The <strong>reduce()</strong> function processes each unique key and all its associated values. In word count, this sums up all the counts for each word. The output is the final result.',
    targetSelector: '#nodeRed2 .reducer-output'
  },
  OUTPUT: {
    title: 'Writing to HDFS',
    description: 'Final results are written to <strong>HDFS output files</strong>. Each reducer writes one output file (<code>part-r-00000</code>, <code>part-r-00001</code>, etc.). The job is complete when all reducers finish writing.',
    targetSelector: '.node-output'
  },
  FINISH: {
    title: 'Job Complete!',
    description: 'The MapReduce job has finished successfully. All input data has been processed through the pipeline: <strong>Input → Map → Shuffle → Reduce → Output</strong>. The results are now available in HDFS.',
    targetSelector: '.node-output'
  }
};

/**
 * Maps step types to phase names for explanation lookup
 */
const STEP_TO_PHASE = {
  'INPUT_INIT': 'INPUT',
  'MAP_BATCH': 'MAP',
  'SPILL_SORT': 'SPILL',
  'COMBINE': 'COMBINE',
  'MERGE': 'MERGE',
  'SHUFFLE': 'SHUFFLE',
  'REDUCE_MERGE': 'REDUCE_MERGE',
  'REDUCE': 'REDUCE',
  'OUTPUT': 'OUTPUT',
  'FINISH': 'FINISH'
};

/**
 * Updates the phase callout with content.
 * The callout is fixed position and updates content based on the current phase.
 */
function updatePhaseCallout(phase) {
  const callout = document.getElementById('phaseCallout');
  const phaseEl = document.getElementById('calloutPhase');
  const titleEl = document.getElementById('calloutTitle');
  const descEl = document.getElementById('calloutDescription');

  if (!callout) return;

  const explanation = PHASE_EXPLANATIONS[phase] || PHASE_EXPLANATIONS.READY;

  // Update content
  if (phaseEl) {
    phaseEl.textContent = phase;
    phaseEl.className = `callout-phase phase-${phase.toLowerCase().replace('_', '-')}`;
  }
  if (titleEl) {
    titleEl.textContent = explanation.title;
  }
  if (descEl) {
    descEl.innerHTML = explanation.description;
  }

  requestAnimationFrame(() => {
    positionPhaseCallout(phase);
  });
}

function readCssPx(varName, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function positionPhaseCallout(phase) {
  const wrapper = document.querySelector('.phase-callout-wrapper');
  const callout = document.getElementById('phaseCallout');
  if (!wrapper || !callout) return;

  const explanation = PHASE_EXPLANATIONS[phase] || PHASE_EXPLANATIONS.READY;
  const target = explanation.targetSelector
    ? document.querySelector(explanation.targetSelector)
    : null;

  const calloutWidth = wrapper.offsetWidth || callout.offsetWidth;
  const calloutHeight = wrapper.offsetHeight || callout.offsetHeight;
  if (!calloutWidth || !calloutHeight) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const screenPadding = 12;
  const calloutGap = readCssPx('--callout-gap', 10);
  const arrowSize = readCssPx('--callout-arrow-size', 10);

  const stepConsole = document.querySelector('.step-console');
  const stepConsoleRect = stepConsole ? stepConsole.getBoundingClientRect() : null;
  const maxLeft = stepConsoleRect
    ? stepConsoleRect.left - calloutGap - calloutWidth
    : viewportWidth - calloutWidth - screenPadding;

  let left = maxLeft;
  let top = (viewportHeight - calloutHeight) / 2;
  let arrowCenter = calloutHeight / 2;

  if (target) {
    const targetRect = target.getBoundingClientRect();
    const targetCenter = targetRect.top + targetRect.height / 2;

    left = Math.min(targetRect.right + arrowSize, maxLeft);
    left = Math.max(screenPadding, left);

    top = targetCenter - calloutHeight / 2;
    arrowCenter = targetCenter - top;
  }

  top = Math.min(Math.max(top, screenPadding), viewportHeight - calloutHeight - screenPadding);
  arrowCenter = Math.min(Math.max(arrowCenter, arrowSize + 4), calloutHeight - arrowSize - 4);

  wrapper.style.left = `${left}px`;
  wrapper.style.right = 'auto';
  wrapper.style.top = `${top}px`;
  wrapper.style.transform = 'translateY(0)';
  callout.style.setProperty('--callout-arrow-top', `${arrowCenter}px`);
}

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

      // Update callout to FINISH when simulation completes
      if (info.isComplete) {
        updatePhaseCallout('FINISH');
      }
    }

    // Track the last completed phase for scroll/resize updates
    let lastCompletedPhase = 'READY';

    // Set up step change callback (for UI updates before next step)
    simulation.onStepChange(updateStepUI);

    // Set up step complete callback (for callout positioning AFTER step executes)
    simulation.onStepComplete((completedStep) => {
      lastCompletedPhase = STEP_TO_PHASE[completedStep.type] || completedStep.phase;
      updatePhaseCallout(lastCompletedPhase);
    });

    const scheduleCalloutPosition = () => {
      requestAnimationFrame(() => positionPhaseCallout(lastCompletedPhase));
    };

    window.addEventListener('resize', scheduleCalloutPosition);
    window.addEventListener('scroll', scheduleCalloutPosition, { passive: true });

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
        // Reset callout to initial state
        lastCompletedPhase = 'READY';
        updatePhaseCallout('READY');
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

    // Initialize callout
    updatePhaseCallout('READY');
  });

  return simulation;
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.teachingSimulation = initTeachingPipeline();
}
