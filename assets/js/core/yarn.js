import { randomFloat } from './random.js';

export function shuffleNodes(nodes, rng = Math.random) {
  return [...nodes].sort(() => rng() - 0.5);
}

export function canAllocate(node, cpu, memory) {
  return node.cpuTotal - node.cpuUsed >= cpu && node.memoryTotal - node.memoryUsed >= memory;
}

export function allocateContainerOnNode(node, container) {
  node.cpuUsed += container.cpu;
  node.memoryUsed += container.memory;
  node.containers.push(container);
}

export function allocateContainer({ nodes, container, rng = Math.random, preferredNodeIds = null }) {
  const candidates = preferredNodeIds
    ? preferredNodeIds
        .map((id) => nodes.find((node) => node.id === id))
        .filter(Boolean)
    : shuffleNodes(nodes, rng);

  for (const node of candidates) {
    if (canAllocate(node, container.cpu, container.memory)) {
      allocateContainerOnNode(node, container);
      return node;
    }
  }
  return null;
}

export function releaseContainerByName(nodes, containerName) {
  let released = null;
  nodes.forEach((node) => {
    const index = node.containers.findIndex((container) => container.name === containerName);
    if (index !== -1) {
      const container = node.containers[index];
      node.cpuUsed = Math.max(0, node.cpuUsed - container.cpu);
      node.memoryUsed = Math.max(0, node.memoryUsed - container.memory);
      node.containers.splice(index, 1);
      released = container;
    }
  });
  return released;
}

export function computeYarnStats(nodes) {
  let totalCpu = 0;
  let usedCpu = 0;
  let totalMem = 0;
  let usedMem = 0;
  let activeApps = 0;

  nodes.forEach((node) => {
    totalCpu += node.cpuTotal;
    usedCpu += node.cpuUsed;
    totalMem += node.memoryTotal;
    usedMem += node.memoryUsed;
    activeApps += node.containers.length;
  });

  return {
    totalCpu,
    usedCpu,
    totalMem,
    usedMem,
    activeApps,
    cpuUsagePercent: totalCpu > 0 ? (usedCpu / totalCpu) * 100 : 0,
    memoryUsagePercent: totalMem > 0 ? (usedMem / totalMem) * 100 : 0
  };
}

export function createJobResources({ cpuMin, cpuMax, memMin, memMax, rng = Math.random }) {
  return {
    cpu: Math.floor(randomFloat(cpuMin, cpuMax + 1, rng)),
    memory: Math.floor(randomFloat(memMin, memMax + 1, rng))
  };
}
