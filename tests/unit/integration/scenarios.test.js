import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../../assets/js/hadoop-sim/simulation.js';
import { CLUSTER_SCENARIOS } from '../../../assets/js/hadoop-sim/scenarios.js';

test('one cluster implementation retains both block-size and replication scenarios', () => {
  for (const [name, blocks, replicas] of [
    ['compact', 4, 8],
    ['replicated', 8, 24]
  ]) {
    const sim = createSimulation(CLUSTER_SCENARIOS[name]);
    assert.equal(sim.actions.uploadFile(1024).ok, true);
    assert.equal(sim.state.files[0].blocks.length, blocks);
    assert.equal(
      sim.state.nodes.reduce((sum, n) => sum + n.blocks.length, 0),
      replicas
    );
    sim.dispose();
  }
});
