import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualClock } from '../../../assets/js/hadoop-sim/clock.js';

test('manual clock runs timeouts in order', () => {
  const clock = createManualClock(0);
  const calls = [];

  clock.setTimeout(() => calls.push('a'), 10);
  clock.setTimeout(() => calls.push('b'), 5);

  clock.advance(4);
  assert.deepEqual(calls, []);

  clock.advance(2);
  assert.deepEqual(calls, ['b']);

  clock.advance(10);
  assert.deepEqual(calls, ['b', 'a']);
});

test('manual clock runs intervals repeatedly', () => {
  const clock = createManualClock(0);
  const calls = [];

  clock.setInterval(() => calls.push(clock.now()), 5);

  clock.advance(16);
  assert.deepEqual(calls, [5, 10, 15]);
});
