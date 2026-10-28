export const DEFAULT_NODE_TEMPLATE = {
  cpuTotal: 16,
  memoryTotalMb: 32768,
  storageTotalMb: 102400,
  namePrefix: 'Node-'
};

export const DEFAULT_CONFIG = {
  nodeCount: 6,
  replicationFactor: 3,
  blockSizeMb: 10,
  nodeTemplate: DEFAULT_NODE_TEMPLATE,
  hdfs: {
    placementPolicy: 'balanced'
  },
  yarn: {
    queueLimit: 200,
    placementPolicy: 'balanced'
  },
  mapReduce: {
    amCpu: 1,
    amMemoryMb: 1024,
    mapperCpu: 2,
    mapperMemoryMb: 4096,
    mapperProgressStep: 6.25,
    mapperIntervalMs: 800
  }
};

export function resolveConfig(config = {}) {
  const resolved = {
    ...DEFAULT_CONFIG,
    ...config,
    nodeTemplate: {
      ...DEFAULT_NODE_TEMPLATE,
      ...(config.nodeTemplate || {})
    },
    hdfs: {
      ...DEFAULT_CONFIG.hdfs,
      ...(config.hdfs || {})
    },
    yarn: {
      ...DEFAULT_CONFIG.yarn,
      ...(config.yarn || {})
    },
    mapReduce: {
      ...DEFAULT_CONFIG.mapReduce,
      ...(config.mapReduce || {})
    }
  };
  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!Number.isInteger(resolved.nodeCount) || resolved.nodeCount <= 0 ||
      !Number.isInteger(resolved.replicationFactor) || resolved.replicationFactor <= 0 ||
      !Number.isInteger(resolved.blockSizeMb) || resolved.blockSizeMb <= 0 ||
      !Number.isInteger(resolved.mapReduce.amCpu) || !Number.isInteger(resolved.mapReduce.mapperCpu) ||
      !Number.isInteger(resolved.yarn.queueLimit) || resolved.yarn.queueLimit < 0 ||
      Object.values(resolved.mapReduce).some((value) => !positive(value))) {
    throw new RangeError('Invalid simulation configuration');
  }
  const nodes = Array.isArray(config.nodes) && config.nodes.length ? config.nodes : [resolved.nodeTemplate];
  const ids = new Set();
  nodes.forEach((node, index) => {
    const id = node.id ?? index + 1;
    if (ids.has(id) || !Number.isInteger(node.cpuTotal ?? resolved.nodeTemplate.cpuTotal) ||
        !positive(node.cpuTotal ?? resolved.nodeTemplate.cpuTotal) ||
        !positive(node.memoryTotalMb ?? resolved.nodeTemplate.memoryTotalMb) ||
        !positive(node.storageTotalMb ?? resolved.nodeTemplate.storageTotalMb)) {
      throw new RangeError('Invalid node configuration');
    }
    ids.add(id);
  });
  return resolved;
}
