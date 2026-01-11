import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventEmitter } from '../../../assets/js/hadoop-sim/events.js';

test('event emitter subscribes and emits payloads', () => {
  const emitter = createEventEmitter();
  const calls = [];

  const off = emitter.on('tick', (payload) => calls.push(payload));
  emitter.emit('tick', { value: 1 });
  emitter.emit('tick', { value: 2 });
  off();
  emitter.emit('tick', { value: 3 });

  assert.deepEqual(calls, [{ value: 1 }, { value: 2 }]);
});

test('event emitter clears listeners', () => {
  const emitter = createEventEmitter();
  let count = 0;

  emitter.on('event', () => {
    count += 1;
  });
  emitter.clear();
  emitter.emit('event');

  assert.equal(count, 0);
});

test('event emitter supports wildcard listeners', () => {
  const emitter = createEventEmitter();
  const seen = [];

  emitter.on('*', ({ eventName, payload }) => {
    seen.push([eventName, payload]);
  });

  emitter.emit('alpha', { value: 1 });
  emitter.emit('beta', { value: 2 });

  assert.deepEqual(seen, [
    ['alpha', { value: 1 }],
    ['beta', { value: 2 }]
  ]);
});
