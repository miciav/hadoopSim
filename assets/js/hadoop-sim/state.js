import { resolveConfig } from './config.js';

export function createInitialState(config = {}) {
  const resolved = resolveConfig(config);
  const nodes = [];

  if (Array.isArray(config.nodes) && config.nodes.length > 0) {
    config.nodes.forEach((node, index) => {
      const id = node.id ?? index + 1;
      nodes.push({
        id,
        name: node.name || `${resolved.nodeTemplate.namePrefix}${id}`,
        cpuTotal: node.cpuTotal ?? resolved.nodeTemplate.cpuTotal,
        cpuUsed: 0,
        memoryTotalMb: node.memoryTotalMb ?? resolved.nodeTemplate.memoryTotalMb,
        memoryUsedMb: 0,
        storageTotalMb: node.storageTotalMb ?? resolved.nodeTemplate.storageTotalMb,
        storageUsedMb: 0,
        blocks: [],
        containers: [],
        failed: false
      });
    });
  } else {
    for (let i = 1; i <= resolved.nodeCount; i += 1) {
      nodes.push({
        id: i,
        name: `${resolved.nodeTemplate.namePrefix}${i}`,
        cpuTotal: resolved.nodeTemplate.cpuTotal,
        cpuUsed: 0,
        memoryTotalMb: resolved.nodeTemplate.memoryTotalMb,
        memoryUsedMb: 0,
        storageTotalMb: resolved.nodeTemplate.storageTotalMb,
        storageUsedMb: 0,
        blocks: [],
        containers: [],
        failed: false
      });
    }
  }

  return {
    config: resolved,
    nodes,
    files: [],
    yarnJobs: [],
    mapReduceJobs: [],
    yarnQueue: [],
    mapReduceQueue: [],
    counters: {
      file: 1,
      block: 1,
      job: 1,
      mapReduce: 1
    }
  };
}
