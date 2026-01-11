import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRng } from '../../../assets/js/hadoop-sim/random.js';
import { createManualClock } from '../../../assets/js/hadoop-sim/clock.js';
import { createSimulation } from '../../../assets/js/hadoop-sim/simulation.js';

test('simulation runs upload + mapreduce to completion', () => {
  const clock = createManualClock(0);
  const rng = createSeededRng(50);

  const sim = createSimulation(
    {
      nodeCount: 3,
      replicationFactor: 2,
      blockSizeMb: 100,
      nodeTemplate: {
        cpuTotal: 8,
        memoryTotalMb: 16384,
        storageTotalMb: 10000
      },
      mapReduce: {
        mapperIntervalMs: 50
      }
    },
    { clock, rng }
  );

  const upload = sim.actions.uploadFile(200);
  assert.equal(upload.ok, true);

  const job = sim.actions.submitMapReduce({});
  assert.ok(job);

  clock.advance(2000);
  assert.equal(job.status, 'completed');
});
