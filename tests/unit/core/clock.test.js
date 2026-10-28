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

test('manual clock does not rearm a cancelled interval', () => {
  const clock = createManualClock();
  let calls = 0;
  const id = clock.setInterval(() => { calls++; clock.clearInterval(id); }, 10);
  clock.advance(40);
  assert.equal(calls, 1);
});

test('manual clock skips an interval cancelled at the same time', () => {
  const clock = createManualClock();
  const calls = [];
  clock.setInterval(() => { calls.push('first'); clock.clearInterval(second); }, 10);
  const second = clock.setInterval(() => calls.push('second'), 10);
  clock.advance(10);
  assert.deepEqual(calls, ['first']);
});

test('manual clock skips a timeout cancelled at the same time', () => {
  const clock = createManualClock();
  const calls = [];
  clock.setTimeout(() => { calls.push('first'); clock.clearTimeout(second); }, 10);
  const second = clock.setTimeout(() => calls.push('second'), 10);
  clock.advance(10);
  assert.deepEqual(calls, ['first']);
});
