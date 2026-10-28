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

test('reset stops previous job timers before new resources are allocated', () => {
  const clock = createManualClock();
  const sim = createSimulation({ mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(10);
  sim.actions.submitMapReduce({});
  clock.advance(10);
  sim.actions.reset();
  sim.actions.uploadFile(10);
  const job = sim.actions.submitMapReduce({});
  clock.advance(150);
  assert.equal(job.status, 'running');
  assert.ok(sim.state.nodes.flatMap(node => node.containers).some(c => c.jobId === job.id));
});

test('job fails when its input block has no live replica', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 2, replicationFactor: 1 }, { clock });
  sim.actions.uploadFile(10);
  const holder = sim.state.nodes.find(node => node.blocks.length);
  sim.actions.failNode(holder.id);
  const job = sim.actions.submitMapReduce({});
  assert.equal(job.status, 'failed');
});

test('job fails if the application master node fails', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 2 }, { clock });
  sim.actions.uploadFile(10);
  const job = sim.actions.submitMapReduce({});
  sim.actions.failNode(job.appMasterNodeId);
  assert.equal(job.status, 'failed');
  assert.equal(sim.state.nodes.flatMap(node => node.containers).length, 0);
});

test('queued job starts after an earlier job releases capacity', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 1, blockSizeMb: 10, nodeTemplate: { cpuTotal: 3 }, mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(10);
  const first = sim.actions.submitMapReduce({});
  const second = sim.actions.submitMapReduce({});
  assert.equal(second.status, 'queued');
  clock.advance(400);
  assert.equal(first.status, 'completed');
  assert.equal(second.status, 'completed');
  assert.equal(sim.state.mapReduceQueue.length, 0);
});

test('mappers execute in waves when only one fits at a time', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 1, blockSizeMb: 10, nodeTemplate: { cpuTotal: 3 }, mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(30);
  const job = sim.actions.submitMapReduce({});
  clock.advance(600);
  assert.equal(job.status, 'completed');
  assert.equal(job.mappers.length, 3);
  assert.ok(job.mappers.every(mapper => mapper.progress === 100));
});

test('impossible job fails without holding resources or occupying the queue', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 1, nodeTemplate: { cpuTotal: 2 }, mapReduce: { mapperCpu: 2 } }, { clock });
  sim.actions.uploadFile(10);
  const job = sim.actions.submitMapReduce({});
  assert.equal(job.status, 'failed');
  assert.equal(sim.state.mapReduceQueue.length, 0);
  assert.equal(sim.state.nodes[0].cpuUsed, 0);
});

test('invalid requests do not mutate the cluster', () => {
  const sim = createSimulation();
  const before = JSON.stringify(sim.state);
  assert.throws(() => sim.actions.uploadFile(-1), RangeError);
  assert.throws(() => sim.actions.submitYarnJob({ cpu: -1, memoryMb: 512 }), RangeError);
  assert.equal(JSON.stringify(sim.state), before);
});

test('seed zero produces the same placement after reset', () => {
  const sim = createSimulation({ nodeCount: 6, replicationFactor: 2, hdfs: { placementPolicy: 'random' } }, { seed: 0 });
  sim.actions.uploadFile(20);
  const placement = sim.state.nodes.map(node => node.blocks.map(block => block.id));
  sim.actions.reset();
  sim.actions.uploadFile(20);
  assert.deepEqual(sim.state.nodes.map(node => node.blocks.map(block => block.id)), placement);
});

test('mapper waits when a replica survives but compute is temporarily unavailable', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 2, replicationFactor: 2, nodeTemplate: { cpuTotal: 3 }, mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(10);
  const job = sim.actions.submitMapReduce({});
  const mapperNode = job.mappers[0].nodeId;
  assert.notEqual(mapperNode, job.appMasterNodeId);
  const master = sim.state.nodes.find(node => node.id === job.appMasterNodeId);
  const blocker = sim.yarn.allocateContainer({ name: 'blocker', cpu: 2, memoryMb: 1 }, [master.id]);
  assert.ok(blocker);
  let failureSummary;
  sim.on('mapreduce:nodeFailed', event => { failureSummary = event.summaries[0]; });
  sim.actions.failNode(mapperNode);
  assert.equal(failureSummary.rescheduled, 0);
  assert.equal(failureSummary.waiting, 1);
  assert.equal(job.status, 'running');
  sim.yarn.releaseContainer('blocker');
  clock.advance(200);
  assert.equal(job.status, 'completed');
});

test('queued job fails and leaves the queue when its only replica is lost', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodeCount: 2, replicationFactor: 1, nodeTemplate: { cpuTotal: 3 }, mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(10);
  for (const node of sim.state.nodes) sim.yarn.allocateContainer({ name: `blocker-${node.id}`, cpu: 3, memoryMb: 1 }, [node.id]);
  const job = sim.actions.submitMapReduce({});
  assert.equal(job.status, 'queued');
  const holder = sim.state.nodes.find(node => node.blocks.length);
  sim.actions.failNode(holder.id);
  assert.equal(job.status, 'failed');
  assert.equal(sim.state.mapReduceQueue.length, 0);
});

test('disposing a simulation prevents further job progress', () => {
  const clock = createManualClock();
  const sim = createSimulation({ mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(10);
  const job = sim.actions.submitMapReduce({});
  clock.advance(10);
  sim.dispose();
  const progress = job.progress;
  clock.advance(1000);
  assert.equal(job.progress, progress);
});

test('empty file job completes without allocating a container', () => {
  const sim = createSimulation();
  sim.actions.uploadFile(0);
  const job = sim.actions.submitMapReduce({});
  assert.equal(job.status, 'completed');
  assert.equal(job.progress, 100);
  assert.equal(sim.state.nodes.flatMap(node => node.containers).length, 0);
});

test('an explicitly missing file does not fall back to an existing file', () => {
  const sim = createSimulation();
  sim.actions.uploadFile(10);
  assert.equal(sim.actions.submitMapReduce({ fileName: 'missing.dat' }), null);
  assert.equal(sim.state.mapReduceJobs.length, 0);
});

test('queued job fails if node failure makes its resource needs impossible', () => {
  const sim = createSimulation({ nodes: [
    { id: 1, cpuTotal: 2, memoryTotalMb: 8192, storageTotalMb: 100 },
    { id: 2, cpuTotal: 2, memoryTotalMb: 8192, storageTotalMb: 100 }
  ], replicationFactor: 2 });
  sim.actions.uploadFile(10);
  sim.yarn.allocateContainer({ name: 'blocker-1', cpu: 2, memoryMb: 1 }, [1]);
  sim.yarn.allocateContainer({ name: 'blocker-2', cpu: 2, memoryMb: 1 }, [2]);
  const job = sim.actions.submitMapReduce({});
  assert.equal(job.status, 'queued');
  sim.actions.failNode(2);
  assert.equal(job.status, 'failed');
  assert.equal(job.failureReason, 'insufficient-capacity');
  assert.equal(sim.state.mapReduceQueue.length, 0);
});

test('a running job fails if its remaining node can never run a mapper beside its master', () => {
  const clock = createManualClock();
  const sim = createSimulation({ nodes: [
    { id: 1, cpuTotal: 2, memoryTotalMb: 8192, storageTotalMb: 100 },
    { id: 2, cpuTotal: 2, memoryTotalMb: 8192, storageTotalMb: 100 }
  ], replicationFactor: 2, mapReduce: { mapperIntervalMs: 10 } }, { clock });
  sim.actions.uploadFile(10);
  const job = sim.actions.submitMapReduce({});
  assert.notEqual(job.appMasterNodeId, job.mappers[0].nodeId);
  sim.actions.failNode(job.mappers[0].nodeId);
  assert.equal(job.status, 'failed');
  assert.equal(job.failureReason, 'insufficient-capacity');
  assert.equal(sim.state.nodes.filter(node => !node.failed).flatMap(node => node.containers).length, 0);
});

test('reset from a progress listener cannot release a newly created job', () => {
  const clock = createManualClock();
  const sim = createSimulation({ mapReduce: { mapperIntervalMs: 10, mapperProgressStep: 100 } }, { clock });
  sim.actions.uploadFile(10);
  let replacement;
  sim.on('mapreduce:progress', () => {
    if (replacement) return;
    sim.actions.reset();
    sim.actions.uploadFile(10);
    replacement = sim.actions.submitMapReduce({});
  });
  sim.actions.submitMapReduce({});
  clock.advance(10);
  assert.equal(replacement.status, 'running');
  assert.equal(sim.state.nodes.flatMap(node => node.containers).length, 2);
});

test('reset from a started listener schedules the replacement job', () => {
  const clock = createManualClock();
  const sim = createSimulation({}, { clock });
  sim.actions.uploadFile(10);
  let replacement;
  let reset = false;
  sim.on('mapreduce:started', () => {
    if (reset) return;
    reset = true;
    sim.actions.reset();
    sim.actions.uploadFile(10);
    replacement = sim.actions.submitMapReduce({});
  });
  sim.actions.submitMapReduce({});
  assert.equal(replacement.status, 'running');
  assert.equal(sim.state.nodes.flatMap(node => node.containers).length, 2);
});
