import { createJobActor } from './job-machine.js';

function buildBlockLocations(nodes, fileName) {
  const locations = new Map();
  nodes.forEach((node) => {
    if (node.failed) {
      return;
    }
    node.blocks.forEach((block) => {
      if (block.fileName === fileName) {
        if (!locations.has(block.id)) {
          locations.set(block.id, []);
        }
        locations.get(block.id).push(node.id);
      }
    });
  });
  return locations;
}

export function createMapReduceEngine({
  state,
  clock,
  emitter = null,
  allocateContainer,
  releaseContainer
}) {
  const { config } = state;
  const actors = new Map();

  function emit(eventName, payload) {
    if (emitter && emitter.emit) {
      emitter.emit(eventName, payload);
    }
  }

  function allocateApplicationMaster(job, preferredNodeIds) {
    const request = {
      name: `AM-${job.name}`,
      cpu: config.mapReduce.amCpu || 1,
      memoryMb: config.mapReduce.amMemoryMb || 1024,
      jobId: job.id,
      isMapReduce: false,
      isApplicationMaster: true
    };
    const allocation = allocateContainer(request, preferredNodeIds);
    if (!allocation) {
      return null;
    }
    job.appMasterNodeId = allocation.node.id;
    return allocation;
  }

  function releaseJobResources(job) {
    job.mappers.forEach((mapper) => {
      releaseContainer(mapper.name);
    });
    releaseContainer(`AM-${job.name}`);
  }

  function transitionJob(job, type) {
    const actor = actors.get(job.id);
    actor.send({ type });
    job.status = actor.getSnapshot().value;
  }

  function stopJobTimers(job) {
    job.mappers.forEach((mapper) => {
      if (mapper.intervalId != null) {
        clock.clearInterval(mapper.intervalId);
        mapper.intervalId = null;
      }
    });
  }

  function failJob(job, reason) {
    transitionJob(job, 'FAIL');
    job.failureReason = reason;
    state.mapReduceQueue = state.mapReduceQueue.filter((id) => id !== job.id);
    stopJobTimers(job);
    releaseJobResources(job);
    emit('mapreduce:failed', { job, reason });
  }

  function stopAll() {
    state.mapReduceJobs.forEach(stopJobTimers);
    actors.forEach((actor) => actor.stop());
    actors.clear();
  }

  function possibleMasterNodes(useTotals = false) {
    const amCpu = config.mapReduce.amCpu || 1;
    const amMemory = config.mapReduce.amMemoryMb || 1024;
    const active = state.nodes.filter((node) => !node.failed);
    const cpu = (node) => node.cpuTotal - (useTotals ? 0 : node.cpuUsed);
    const memory = (node) => node.memoryTotalMb - (useTotals ? 0 : node.memoryUsedMb);
    return active.filter((master) => cpu(master) >= amCpu && memory(master) >= amMemory &&
      active.some((mapper) => cpu(mapper) - (mapper === master ? amCpu : 0) >= config.mapReduce.mapperCpu &&
        memory(mapper) - (mapper === master ? amMemory : 0) >= config.mapReduce.mapperMemoryMb));
  }

  let draining = false;

  function scheduleProgress(job, mapper) {
    mapper.intervalId = clock.setInterval(() => {
      if (job.status !== 'running') return;
      mapper.progress = Math.min(100, mapper.progress + config.mapReduce.mapperProgressStep);
      job.progress = job.mappers.reduce((sum, entry) => sum + entry.progress, 0) / job.mappers.length;
      emit('mapreduce:progress', { job });
      if (mapper.progress === 100) {
        clock.clearInterval(mapper.intervalId);
        mapper.intervalId = null;
        mapper.completed = true;
        releaseContainer(mapper.name);
        if (job.mappers.every((entry) => entry.completed)) {
          transitionJob(job, 'COMPLETE');
          releaseContainer(`AM-${job.name}`);
          emit('mapreduce:completed', { job });
        }
        drain();
      }
    }, config.mapReduce.mapperIntervalMs);
  }

  function drain() {
    if (draining) return;
    draining = true;
    try {
      for (const job of state.mapReduceJobs) {
        if (job.status !== 'queued' && job.status !== 'running') continue;
        if (job.status === 'queued') {
          const masters = possibleMasterNodes();
          if (!masters.length || !allocateApplicationMaster(job, masters.map((node) => node.id))) break;
          transitionJob(job, 'START');
          state.mapReduceQueue = state.mapReduceQueue.filter((id) => id !== job.id);
          emit('mapreduce:started', { job });
        }
        const locations = buildBlockLocations(state.nodes, job.fileName);
        for (const mapper of job.mappers) {
          if (mapper.completed || mapper.intervalId != null) continue;
          const preferred = locations.get(mapper.blockId) || [];
          if (!preferred.length) {
            failJob(job, 'lost-block');
            break;
          }
          const allocation = allocateContainer({
            name: mapper.name,
            cpu: config.mapReduce.mapperCpu,
            memoryMb: config.mapReduce.mapperMemoryMb,
            jobId: job.id,
            isMapReduce: true,
            blockIds: [mapper.blockId]
          }, preferred);
          if (!allocation) break;
          mapper.nodeId = allocation.node.id;
          scheduleProgress(job, mapper);
        }
      }
    } finally {
      draining = false;
    }
  }

  const unsubscribeRelease = emitter && emitter.on ? emitter.on('yarn:released', drain) : null;

  function dispose() {
    stopAll();
    if (unsubscribeRelease) unsubscribeRelease();
  }

  function runJob({ fileName }) {
    const file = fileName ? state.files.find((entry) => entry.name === fileName) : state.files[0];
    if (!file) {
      emit('mapreduce:failed', { reason: 'no-file' });
      return null;
    }
    const jobId = state.counters.mapReduce++;
    const job = {
      id: jobId,
      name: `MapReduce-${jobId}`,
      fileName: file.name,
      status: 'queued',
      progress: 0,
      mappers: file.blocks.map((block, index) => ({
        name: `MapReduce-${jobId}-M${index + 1}`,
        blockId: block.id,
        nodeId: null,
        progress: 0,
        intervalId: null,
        completed: false
      })),
      appMasterNodeId: null
    };
    actors.set(job.id, createJobActor());
    state.mapReduceJobs.push(job);
    const locations = buildBlockLocations(state.nodes, file.name);
    if (file.blocks.some((block) => !locations.has(block.id))) {
      failJob(job, 'lost-block');
      return job;
    }
    if (!job.mappers.length) {
      transitionJob(job, 'COMPLETE');
      job.progress = 100;
      emit('mapreduce:completed', { job });
      return job;
    }
    if (!possibleMasterNodes(true).length) {
      failJob(job, 'insufficient-capacity');
      return job;
    }
    state.mapReduceQueue.push(job.id);
    drain();
    if (job.status === 'queued') emit('mapreduce:queued', { job });
    return job;
  }

  function handleNodeFailure(nodeId) {
    const failedNode = state.nodes.find((node) => node.id === nodeId);
    if (!failedNode) {
      return [];
    }

    failedNode.failed = true;
    failedNode.cpuUsed = 0;
    failedNode.memoryUsedMb = 0;
    failedNode.containers = [];

    const summaries = [];
    const affectedByJob = new Map();

    state.mapReduceJobs.forEach((job) => {
      if (job.status === 'queued') {
        const locations = buildBlockLocations(state.nodes, job.fileName);
        if (job.mappers.some((mapper) => !locations.has(mapper.blockId))) failJob(job, 'lost-block');
        else if (!possibleMasterNodes(true).length) failJob(job, 'insufficient-capacity');
        return;
      }
      if (job.status !== 'running') {
        return;
      }

      if (job.appMasterNodeId === nodeId) {
        failJob(job, 'application-master-failed');
        return;
      }
      const affected = job.mappers.filter((mapper) => !mapper.completed && mapper.nodeId === nodeId);
      const needsMapper = job.mappers.some((mapper) => !mapper.completed && (mapper.nodeId == null || mapper.nodeId === nodeId));
      const canFitMapper = state.nodes.some((node) => {
        if (node.failed) return false;
        const masterHere = node.id === job.appMasterNodeId;
        return node.cpuTotal - (masterHere ? config.mapReduce.amCpu : 0) >= config.mapReduce.mapperCpu &&
          node.memoryTotalMb - (masterHere ? config.mapReduce.amMemoryMb : 0) >= config.mapReduce.mapperMemoryMb;
      });
      if (needsMapper && !canFitMapper) {
        failJob(job, 'insufficient-capacity');
        return;
      }
      if (affected.length === 0) {
        return;
      }

      let failed = 0;
      affected.forEach((mapper) => {
        if (mapper.intervalId != null) clock.clearInterval(mapper.intervalId);
        mapper.intervalId = null;
        mapper.nodeId = null;
        mapper.progress = 0;
        const hasReplica = state.nodes.some(
          (node) => !node.failed && node.blocks.some((block) => block.id === mapper.blockId)
        );
        if (!hasReplica) failed += 1;
      });
      if (failed > 0) failJob(job, 'lost-block');
      affectedByJob.set(job.id, affected);
      summaries.push({ jobId: job.id, rescheduled: 0, waiting: 0, failed, affected: affected.length });

    });

    drain();
    summaries.forEach((summary) => {
      const job = state.mapReduceJobs.find((entry) => entry.id === summary.jobId);
      if (!job || job.status !== 'running') return;
      const affected = affectedByJob.get(summary.jobId);
      summary.rescheduled = affected.filter((mapper) => mapper.nodeId != null).length;
      summary.waiting = affected.length - summary.rescheduled;
    });
    emit('mapreduce:nodeFailed', { nodeId, summaries });
    return summaries;
  }

  function stats() {
    const runningJobs = state.mapReduceJobs.filter((job) => job.status === 'running').length;
    const completedJobs = state.mapReduceJobs.filter((job) => job.status === 'completed').length;

    return {
      runningJobs,
      completedJobs
    };
  }

  return {
    runJob,
    stopAll,
    dispose,
    handleNodeFailure,
    releaseJobResources,
    stats
  };
}

export function describeMapReduceFailure(reason) {
  return {
    'application-master-failed': 'ApplicationMaster failed; restart is not simulated.',
    'lost-block': 'An input block has no available replica.',
    'insufficient-capacity': 'The cluster cannot fit an ApplicationMaster and a mapper.',
    'mapper-failed': 'A mapper could not be restarted.'
  }[reason] || 'The job could not be completed.';
}
