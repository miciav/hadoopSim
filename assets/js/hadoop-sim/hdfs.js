import { shuffle } from './random.js';

function getActiveNodes(nodes) {
  return nodes.filter((node) => !node.failed);
}

function availableStorageMb(node) {
  return node.storageTotalMb - node.storageUsedMb;
}

function selectTargets(nodes, blockSizeMb, replicaCount, policy, rng) {
  const candidates = nodes.filter((node) => availableStorageMb(node) >= blockSizeMb);
  if (policy === 'random') {
    return shuffle(candidates, rng).slice(0, replicaCount);
  }
  return [...candidates]
    .sort((a, b) => {
      const spaceDelta = availableStorageMb(b) - availableStorageMb(a);
      if (spaceDelta !== 0) return spaceDelta;
      return a.id - b.id;
    })
    .slice(0, replicaCount);
}

export function createHdfsEngine({ state, rng = Math.random, emitter = null }) {
  const { config } = state;

  function emit(eventName, payload) {
    if (emitter && emitter.emit) {
      emitter.emit(eventName, payload);
    }
  }

  function allocateBlock(block, fileRecord) {
    const activeNodes = getActiveNodes(state.nodes);
    const targets = selectTargets(
      activeNodes,
      block.sizeMb,
      config.replicationFactor,
      config.hdfs.placementPolicy,
      rng
    );

    const replicasCreated = targets.length;
    if (replicasCreated === 0) {
      return {
        placed: false,
        replicasCreated: 0,
        underReplicated: true,
        targetNodeIds: []
      };
    }

    targets.forEach((node, index) => {
      node.blocks.push({
        ...block,
        isReplica: index > 0
      });
      node.storageUsedMb += block.sizeMb;
    });

    fileRecord.blocks.push(block);

    return {
      placed: true,
      replicasCreated,
      underReplicated: replicasCreated < config.replicationFactor,
      targetNodeIds: targets.map((node) => node.id)
    };
  }

  function rollbackFile(fileName) {
    state.nodes.forEach((node) => {
      let released = 0;
      node.blocks = node.blocks.filter((block) => {
        if (block.fileName === fileName) {
          released += block.sizeMb;
          return false;
        }
        return true;
      });
      if (released > 0) {
        node.storageUsedMb = Math.max(0, node.storageUsedMb - released);
      }
    });
  }

  function uploadFile(sizeMb) {
    const fileId = state.counters.file++;
    const fileName = `file-${fileId}.dat`;
    const blockSize = config.blockSizeMb;
    const numBlocks = Math.ceil(sizeMb / blockSize);
    const fileRecord = {
      name: fileName,
      sizeMb,
      blocks: []
    };

    const results = [];
    for (let i = 0; i < numBlocks; i += 1) {
      const blockSizeMb = Math.min(blockSize, sizeMb - i * blockSize);
      const block = {
        id: `B${state.counters.block++}`,
        fileName,
        index: i,
        sizeMb: blockSizeMb
      };

      const result = allocateBlock(block, fileRecord);
      results.push(result);

      if (!result.placed) {
        rollbackFile(fileName);
        emit('hdfs:uploadFailed', { fileName, reason: 'no-replica' });
        return {
          ok: false,
          file: null,
          results
        };
      }
    }

    state.files.push(fileRecord);
    emit('hdfs:uploadComplete', { file: fileRecord, results });
    return {
      ok: true,
      file: fileRecord,
      results
    };
  }

  function failNode(nodeId) {
    const node = state.nodes.find((entry) => entry.id === nodeId);
    if (!node || node.failed) {
      return null;
    }
    node.failed = true;
    emit('hdfs:nodeFailed', { nodeId });
    return node;
  }

  function reReplicate() {
    const replicationFactor = config.replicationFactor;
    const activeNodes = getActiveNodes(state.nodes);
    const blockMap = new Map();

    state.nodes.forEach((node) => {
      node.blocks.forEach((block) => {
        if (!blockMap.has(block.id)) {
          blockMap.set(block.id, { block, holders: [] });
        }
        if (!node.failed) {
          blockMap.get(block.id).holders.push(node);
        }
      });
    });

    let reReplicated = 0;
    let underReplicated = 0;
    let lost = 0;

    blockMap.forEach(({ block, holders }) => {
      if (holders.length === 0) {
        lost += 1;
        return;
      }

      if (holders.length < replicationFactor) {
        underReplicated += 1;
        const eligible = activeNodes.filter(
          (node) => !holders.includes(node) && availableStorageMb(node) >= block.sizeMb
        );
        const needed = replicationFactor - holders.length;
        const targets = selectTargets(
          eligible,
          block.sizeMb,
          needed,
          config.hdfs.placementPolicy,
          rng
        );

        targets.forEach((node) => {
          node.blocks.push({ ...block, isReplica: true });
          node.storageUsedMb += block.sizeMb;
          reReplicated += 1;
        });
      }
    });

    const summary = { reReplicated, underReplicated, lost };
    emit('hdfs:reReplicated', summary);
    return summary;
  }

  function stats() {
    const activeNodes = getActiveNodes(state.nodes).length;
    const totalStorage = state.nodes.reduce((sum, node) => sum + node.storageTotalMb, 0);
    const usedStorage = state.nodes.reduce((sum, node) => sum + node.storageUsedMb, 0);
    const totalBlocks = state.nodes.reduce((sum, node) => sum + node.blocks.length, 0);

    return {
      totalNodes: state.nodes.length,
      activeNodes,
      totalFiles: state.files.length,
      totalBlocks,
      storageUsagePercent: totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0,
      replicationFactor: config.replicationFactor
    };
  }

  return {
    uploadFile,
    allocateBlock,
    rollbackFile,
    failNode,
    reReplicate,
    stats
  };
}
