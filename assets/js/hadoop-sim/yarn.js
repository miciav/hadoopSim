import { shuffle } from './random.js';

function availableCpu(node) {
  return node.cpuTotal - node.cpuUsed;
}

function availableMemoryMb(node) {
  return node.memoryTotalMb - node.memoryUsedMb;
}

function canAllocate(node, request) {
  return (
    !node.failed &&
    availableCpu(node) >= request.cpu &&
    availableMemoryMb(node) >= request.memoryMb
  );
}

function sortCandidates(nodes) {
  return [...nodes].sort((a, b) => {
    const aLoad = a.cpuUsed / a.cpuTotal + a.memoryUsedMb / a.memoryTotalMb;
    const bLoad = b.cpuUsed / b.cpuTotal + b.memoryUsedMb / b.memoryTotalMb;
    if (aLoad !== bLoad) return aLoad - bLoad;
    return a.id - b.id;
  });
}

export function createYarnEngine({ state, rng = Math.random, emitter = null }) {
  const { config } = state;

  function emit(eventName, payload) {
    if (emitter && emitter.emit) {
      emitter.emit(eventName, payload);
    }
  }

  function allocateOnNode(node, request) {
    node.cpuUsed += request.cpu;
    node.memoryUsedMb += request.memoryMb;
    const container = {
      name: request.name,
      cpu: request.cpu,
      memoryMb: request.memoryMb,
      jobId: request.jobId || null,
      isMapReduce: Boolean(request.isMapReduce),
      isApplicationMaster: Boolean(request.isApplicationMaster),
      blockIds: request.blockIds ? [...request.blockIds] : []
    };
    node.containers.push(container);
    return container;
  }

  function selectNode(candidates) {
    if (candidates.length === 0) {
      return null;
    }
    if (config.yarn.placementPolicy === 'random') {
      return shuffle(candidates, rng)[0] || null;
    }
    return sortCandidates(candidates)[0] || null;
  }

  function allocateContainer(request, preferredNodeIds = null) {
    const activeNodes = state.nodes.filter((node) => !node.failed);
    let candidates = [];

    if (preferredNodeIds && preferredNodeIds.length > 0) {
      candidates = preferredNodeIds
        .map((id) => activeNodes.find((node) => node.id === id))
        .filter(Boolean)
        .filter((node) => canAllocate(node, request));
    }

    if (candidates.length === 0) {
      candidates = activeNodes.filter((node) => canAllocate(node, request));
    }

    const node = selectNode(candidates);
    if (!node) {
      return null;
    }

    const container = allocateOnNode(node, request);
    return { node, container };
  }

  function submitJob(request) {
    const entry = {
      ...request,
      name: request.name || `Job-${state.counters.job++}`
    };

    const allocation = allocateContainer(entry, request.preferredNodeIds || null);
    if (allocation) {
      emit('yarn:allocated', { container: allocation.container, nodeId: allocation.node.id });
      return { allocated: true, nodeId: allocation.node.id, container: allocation.container };
    }

    if (state.yarnQueue.length < config.yarn.queueLimit) {
      state.yarnQueue.push(entry);
      emit('yarn:queued', { request: entry });
      return { allocated: false, queued: true };
    }

    emit('yarn:queueFull', { request: entry });
    return { allocated: false, queued: false };
  }

  function submitDistributedJob(requests) {
    const results = [];
    requests.forEach((request) => {
      results.push(submitJob(request));
    });
    return results;
  }

  function releaseContainer(containerName) {
    let released = null;
    state.nodes.forEach((node) => {
      const index = node.containers.findIndex((container) => container.name === containerName);
      if (index !== -1) {
        const container = node.containers[index];
        node.cpuUsed = Math.max(0, node.cpuUsed - container.cpu);
        node.memoryUsedMb = Math.max(0, node.memoryUsedMb - container.memoryMb);
        node.containers.splice(index, 1);
        released = { nodeId: node.id, container };
      }
    });

    if (released) {
      emit('yarn:released', released);
      drainQueue();
    }

    return released;
  }

  function drainQueue() {
    if (state.yarnQueue.length === 0) {
      return [];
    }

    const started = [];
    let index = 0;

    while (index < state.yarnQueue.length) {
      const request = state.yarnQueue[index];
      const allocation = allocateContainer(request, request.preferredNodeIds || null);
      if (allocation) {
        state.yarnQueue.splice(index, 1);
        started.push(allocation);
        emit('yarn:allocated', { container: allocation.container, nodeId: allocation.node.id });
      } else {
        index += 1;
      }
    }

    return started;
  }

  function stats() {
    let totalCpu = 0;
    let usedCpu = 0;
    let totalMem = 0;
    let usedMem = 0;
    let activeContainers = 0;

    state.nodes.forEach((node) => {
      totalCpu += node.cpuTotal;
      usedCpu += node.cpuUsed;
      totalMem += node.memoryTotalMb;
      usedMem += node.memoryUsedMb;
      activeContainers += node.containers.length;
    });

    return {
      totalCpu,
      usedCpu,
      totalMemMb: totalMem,
      usedMemMb: usedMem,
      activeContainers,
      queuedRequests: state.yarnQueue.length,
      cpuUsagePercent: totalCpu > 0 ? (usedCpu / totalCpu) * 100 : 0,
      memoryUsagePercent: totalMem > 0 ? (usedMem / totalMem) * 100 : 0
    };
  }

  return {
    submitJob,
    submitDistributedJob,
    allocateContainer,
    releaseContainer,
    drainQueue,
    stats
  };
}
