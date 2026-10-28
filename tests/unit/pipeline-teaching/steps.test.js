import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../../assets/js/pipeline-dual-nodes/state.js';
import { buildTeachingSteps } from '../../../assets/js/pipeline-teaching/steps.js';

test('guided steps respect splits without requiring the DOM', () => {
  const state = createInitialState(undefined, undefined, 3);
  const before = JSON.stringify(state);
  const steps = buildTeachingSteps(state);
  const batches = steps.filter((step) => step.type === 'MAP_BATCH');
  assert.deepEqual(
    batches.map((step) => step.batches.map((batch) => batch.length)),
    [
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3]
    ]
  );
  assert.equal(JSON.stringify(state), before);
});
