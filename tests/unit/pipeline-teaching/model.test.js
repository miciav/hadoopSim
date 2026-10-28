import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../../assets/js/pipeline-dual-nodes/state.js';
import { buildTeachingSteps } from '../../../assets/js/pipeline-teaching/steps.js';
import { applyTeachingStep } from '../../../assets/js/pipeline-teaching/model.js';

test('headless teaching steps preserve counts and split boundaries', () => {
  let state = createInitialState(undefined, undefined, 3);
  const steps = buildTeachingSteps(state);
  for (const step of steps) {
    const before = JSON.stringify(state);
    const next = applyTeachingStep(state, step);
    assert.equal(JSON.stringify(state), before);
    state = next;
  }
  assert.deepEqual(
    state.mappers.map((mapper) => mapper.spills.length),
    [4, 4]
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.values(state.reduceOutput)
        .flat()
        .map((record) => [record.k, record.count])
    ),
    { ant: 7, arm: 2, car: 5, cat: 1, cup: 3, day: 3, dog: 2, dot: 1 }
  );
});

test('headless teaching steps handle empty inputs', () => {
  let state = createInitialState([], []);
  for (const step of buildTeachingSteps(state))
    state = applyTeachingStep(state, step);
  assert.deepEqual(state.reduceOutput, { 0: [], 1: [], 2: [] });
  assert.equal(state.running, false);
});

test('headless teaching supports uneven inputs and repeated keys at different split sizes', () => {
  const records = [
    { k: 'ant', p: 0 },
    { k: 'ant', p: 0 },
    { k: 'car', p: 1 }
  ];
  for (const splitSize of [1, 2, 10]) {
    let state = createInitialState(records, [], splitSize);
    for (const step of buildTeachingSteps(state))
      state = applyTeachingStep(state, step);
    assert.deepEqual(
      Object.fromEntries(
        Object.values(state.reduceOutput)
          .flat()
          .map((record) => [record.k, record.count])
      ),
      { ant: 2, car: 1 }
    );
    assert.equal(state.mappers[1].spills.length, 0);
  }
});
