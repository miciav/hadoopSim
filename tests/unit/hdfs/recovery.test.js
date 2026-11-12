import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../../assets/js/hadoop-sim/simulation.js';
import { createManualClock } from '../../../assets/js/hadoop-sim/clock.js';
import { createHdfsRecovery } from '../../../assets/js/hadoop-sim/failure-recovery.js';

test('both views recover through the shared HDFS rules after their configured delay', () => {
  const clock = createManualClock();
  const sim = createSimulation(
    { nodeCount: 3, replicationFactor: 2 },
    { clock }
  );
  const recovered = [];
  createHdfsRecovery(sim, {
    clock,
    delayMs: 100,
    onRecovered: (s) => recovered.push(s)
  });
  sim.actions.uploadFile(10);
  sim.actions.failNode(sim.state.nodes.find((n) => n.blocks.length).id);
  clock.advance(99);
  assert.equal(recovered.length, 0);
  clock.advance(1);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].reReplicated, 1);
});

test('reset cancels delayed recovery before a replacement cluster is created', () => {
  const clock = createManualClock();
  const sim = createSimulation({}, { clock });
  let recovered = 0;
  createHdfsRecovery(sim, {
    clock,
    delayMs: 100,
    onRecovered: () => recovered++
  });
  sim.actions.failNode(1);
  sim.actions.reset();
  sim.actions.uploadFile(10);
  clock.advance(100);
  assert.equal(recovered, 0);
});
