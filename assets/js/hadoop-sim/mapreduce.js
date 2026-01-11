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

function sortByMapperLoad(nodes, mapperCounts) {
  return [...nodes].sort((a, b) => {
    const countDelta = mapperCounts[a.id] - mapperCounts[b.id];
    if (countDelta !== 0) return countDelta;
    const aCpuAvail = a.cpuTotal - a.cpuUsed;
    const bCpuAvail = b.cpuTotal - b.cpuUsed;
    if (aCpuAvail !== bCpuAvail) return bCpuAvail - aCpuAvail;
    return a.id - b.id;
  });
}

export function createMapReduceEngine({
  state,
  rng = Math.random,
  clock,
  emitter = null,
  allocateContainer,
  releaseContainer
}) {
  const { config } = state;

  function emit(eventName, payload) {
    if (emitter && emitter.emit) {
      emitter.emit(eventName, payload);
    }
  }

  function allocateApplicationMaster(job) {
    const request = {
      name: `AM-${job.name}`,
      cpu: config.mapReduce.amCpu || 1,
      memoryMb: config.mapReduce.amMemoryMb || 1024,
      jobId: job.id,
      isMapReduce: false,
      isApplicationMaster: true
    };
    const allocation = allocateContainer(request, null);
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

  function scheduleProgress(job) {
    job.mappers.forEach((mapper) => {
      mapper.intervalId = clock.setInterval(() => {
        if (mapper.progress < 0 || job.status !== 'running') {
          if (mapper.intervalId) {
            clock.clearInterval(mapper.intervalId);
            mapper.intervalId = null;
          }
          return;
        }

        mapper.progress = Math.min(100, mapper.progress + config.mapReduce.mapperProgressStep);
        const active = job.mappers.filter((entry) => entry.progress >= 0);
        const totalProgress = active.reduce((sum, entry) => sum + entry.progress, 0);
        job.progress = active.length > 0 ? totalProgress / active.length : 0;
        emit('mapreduce:progress', { job });

        if (active.length > 0 && active.every((entry) => entry.progress >= 100)) {
          job.status = 'completed';
          job.mappers.forEach((entry) => {
            if (entry.intervalId) {
              clock.clearInterval(entry.intervalId);
              entry.intervalId = null;
            }
          });
          releaseJobResources(job);
          emit('mapreduce:completed', { job });
        }
      }, config.mapReduce.mapperIntervalMs);
    });
  }

  function runJob({ fileName }) {
    const file = state.files.find((entry) => entry.name === fileName) || state.files[0];
    if (!file) {
      emit('mapreduce:failed', { reason: 'no-file' });
      return null;
    }

    const jobId = state.counters.mapReduce++;
    const job = {
      id: jobId,
      name: `MapReduce-${jobId}`,
      fileName: file.name,
      status: 'running',
      progress: 0,
      mappers: [],
      appMasterNodeId: null
    };

    state.mapReduceJobs.push(job);

    const amAllocation = allocateApplicationMaster(job);
    if (!amAllocation) {
      job.status = 'queued';
      state.mapReduceQueue.push(job.id);
      emit('mapreduce:queued', { job });
      return job;
    }

    const blockLocations = buildBlockLocations(state.nodes, file.name);
    const mapperCounts = {};
    state.nodes.forEach((node) => {
      mapperCounts[node.id] = node.containers.filter((container) => container.isMapReduce).length;
    });

    let allocatedMappers = 0;
    let localityHits = 0;

    file.blocks.forEach((block, index) => {
      const mapperName = `${job.name}-M${index + 1}`;
      const preferredNodes = blockLocations.get(block.id) || [];
      let allocation = null;

      if (preferredNodes.length > 0) {
        const sortedPreferred = sortByMapperLoad(
          preferredNodes
            .map((id) => state.nodes.find((node) => node.id === id))
            .filter(Boolean),
          mapperCounts
        );
        allocation = allocateContainer(
          {
            name: mapperName,
            cpu: config.mapReduce.mapperCpu,
            memoryMb: config.mapReduce.mapperMemoryMb,
            jobId: job.id,
            isMapReduce: true,
            blockIds: [block.id]
          },
          sortedPreferred.map((node) => node.id)
        );
      }

      if (!allocation) {
        const candidates = sortByMapperLoad(
          state.nodes.filter((node) => !node.failed),
          mapperCounts
        );
        allocation = allocateContainer(
          {
            name: mapperName,
            cpu: config.mapReduce.mapperCpu,
            memoryMb: config.mapReduce.mapperMemoryMb,
            jobId: job.id,
            isMapReduce: true,
            blockIds: [block.id]
          },
          candidates.map((node) => node.id)
        );
      }

      if (allocation) {
        mapperCounts[allocation.node.id] += 1;
        allocatedMappers += 1;
        if (preferredNodes.includes(allocation.node.id)) {
          localityHits += 1;
        }
        job.mappers.push({
          name: mapperName,
          blockId: block.id,
          nodeId: allocation.node.id,
          progress: 0,
          intervalId: null
        });
      }
    });

    if (allocatedMappers !== file.blocks.length) {
      job.status = 'queued';
      releaseJobResources(job);
      emit('mapreduce:queued', { job });
      return job;
    }

    job.localityPercent = allocatedMappers > 0 ? Math.round((localityHits / allocatedMappers) * 100) : 0;
    emit('mapreduce:started', { job });
    scheduleProgress(job);
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

    state.mapReduceJobs.forEach((job) => {
      if (job.status !== 'running') {
        return;
      }

      const affected = job.mappers.filter((mapper) => mapper.nodeId === nodeId);
      if (affected.length === 0) {
        return;
      }

      let rescheduled = 0;
      let failed = 0;

      affected.forEach((mapper) => {
        const nodesWithBlock = state.nodes.filter(
          (node) => !node.failed && node.blocks.some((block) => block.id === mapper.blockId)
        );
        const candidates = nodesWithBlock.length > 0 ? nodesWithBlock : state.nodes.filter((node) => !node.failed);
        const allocation = allocateContainer(
          {
            name: mapper.name,
            cpu: config.mapReduce.mapperCpu,
            memoryMb: config.mapReduce.mapperMemoryMb,
            jobId: job.id,
            isMapReduce: true,
            blockIds: [mapper.blockId]
          },
          candidates.map((node) => node.id)
        );

        if (allocation) {
          mapper.nodeId = allocation.node.id;
          mapper.progress = 0;
          rescheduled += 1;
        } else {
          mapper.progress = -1;
          failed += 1;
        }
      });

      summaries.push({ jobId: job.id, rescheduled, failed, affected: affected.length });
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
    handleNodeFailure,
    releaseJobResources,
    stats
  };
}
