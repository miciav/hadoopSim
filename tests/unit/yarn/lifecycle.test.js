import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../../assets/js/hadoop-sim/simulation.js';
import { createManualClock } from '../../../assets/js/hadoop-sim/clock.js';
import { createYarnAutoCompletion } from '../../../assets/js/hadoop-sim/yarn-lifecycle.js';

function setup(callbacks = {}) {
  const clock = createManualClock();
  const sim = createSimulation(
    { nodeCount: 1, nodeTemplate: { cpuTotal: 2, memoryTotalMb: 4096 } },
    { clock }
  );
  const lifecycle = createYarnAutoCompletion(sim, {
    clock,
    durationMs: () => 100,
    ...callbacks
  });
  const submit = (name) =>
    sim.actions.submitYarnJob({ name, cpu: 2, memoryMb: 1024 });
  return { sim, clock, lifecycle, submit };
}

test('shared YARN completion releases capacity and admits the queued request', () => {
  const completed = [];
  const { sim, clock, submit } = setup({
    onComplete: (c) => completed.push(c.name)
  });
  assert.equal(submit('first').allocated, true);
  assert.equal(submit('second').queued, true);
  clock.advance(100);
  assert.deepEqual(completed, ['first']);
  assert.equal(sim.state.nodes[0].containers[0].name, 'second');
  clock.advance(100);
  assert.deepEqual(completed, ['first', 'second']);
  assert.equal(sim.state.nodes[0].cpuUsed, 0);
});

test('reset cancels the old completion even if the new container reuses its name', () => {
  const completed = [];
  const { sim, clock, submit } = setup({
    onComplete: (c) => completed.push(c.name)
  });
  submit('same');
  clock.advance(50);
  sim.actions.reset();
  submit('same');
  clock.advance(50);
  assert.equal(sim.state.nodes[0].containers.length, 1);
  assert.deepEqual(completed, []);
  clock.advance(50);
  assert.deepEqual(completed, ['same']);
});

test('failed-node containers are failed once and never reported as completed', () => {
  const completed = [],
    failed = [];
  const { sim, clock, submit } = setup({
    onComplete: (c) => completed.push(c.name),
    onFailed: (c) => failed.push(c.name)
  });
  submit('lost');
  sim.actions.failNode(1);
  clock.advance(200);
  assert.deepEqual(failed, ['lost']);
  assert.deepEqual(completed, []);
});

test('disposing the scheduler cancels timers and detaches allocation listeners', () => {
  const completed = [];
  const { clock, lifecycle, submit } = setup({
    onComplete: (c) => completed.push(c.name)
  });
  submit('first');
  lifecycle.dispose();
  clock.advance(200);
  assert.deepEqual(completed, []);
});
