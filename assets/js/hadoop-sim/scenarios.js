// Former Unified and Ecosystem presets, served by the same cluster view.
export const CLUSTER_SCENARIOS = {
  compact: {
    nodeCount: 6,
    replicationFactor: 2,
    blockSizeMb: 256,
    nodeTemplate: {
      cpuTotal: 16,
      memoryTotalMb: 32 * 1024,
      storageTotalMb: 10 * 1024,
      namePrefix: 'Node-'
    }
  },
  replicated: {
    nodeCount: 6,
    replicationFactor: 3,
    blockSizeMb: 128,
    nodeTemplate: {
      cpuTotal: 16,
      memoryTotalMb: 32 * 1024,
      storageTotalMb: 100 * 1024,
      namePrefix: 'Node-'
    }
  }
};
