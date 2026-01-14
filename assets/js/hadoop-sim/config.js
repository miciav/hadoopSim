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
  return {
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
}
