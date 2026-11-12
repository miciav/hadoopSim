import test from 'node:test';
import assert from 'node:assert/strict';
import { createPauseGate } from '../../../assets/js/lecture-pause.js';

test('pause holds pending delays and resume completes them', async () => {
  const gate = createPauseGate();
  let complete = false;
  const pending = gate.wait(30).then(() => {
    complete = true;
  });
  gate.pause();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(complete, false);
  gate.resume();
  await pending;
  assert.equal(complete, true);
});

test('abort cancels a delay while paused and permits fresh playback', async () => {
  const gate = createPauseGate();
  const controller = new AbortController();
  gate.pause();
  const pending = gate.wait(20, controller.signal);
  controller.abort(new Error('reset'));
  await assert.rejects(pending, /reset/);
  gate.resume();
  await gate.wait(1);
});
