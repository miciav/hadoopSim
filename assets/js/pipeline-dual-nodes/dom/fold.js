/**
 * Row folding functionality for collapsing intermediate steps.
 */

import { el } from './selectors.js';
import { wait } from './animations.js';

/**
 * Folds intermediate rows to focus on results.
 */
export async function foldIntermediateRows() {
  await wait(400);

  // Fold Spills
  ['boxSpill0', 'boxSpill1'].forEach(id => {
    const box = el(id);
    if (box) {
      const row = box.closest('.node-row');
      if (row) row.classList.add('folded');
    }
  });

  await wait(300);

  // Fold Map Output
  ['boxMerge0', 'boxMerge1'].forEach(id => {
    const box = el(id);
    if (box) {
      const row = box.closest('.node-row');
      if (row) row.classList.add('folded');
    }
  });

  await wait(300);

  // Fold Map Task (RAM)
  ['boxMap0', 'boxMap1'].forEach(id => {
    const box = el(id);
    if (box) {
      const row = box.closest('.node-row');
      if (row) row.classList.add('folded');
    }
  });
}

/**
 * Unfolds all intermediate rows.
 */
export function unfoldIntermediateRows() {
  document.querySelectorAll('.node-row.folded').forEach(r =>
    r.classList.remove('folded')
  );
}
