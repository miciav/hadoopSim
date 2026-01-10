function getActiveNodes(nodes) {
  return nodes.filter((node) => !node.failed);
}

function getStorageUnitMb(storageUnitMb) {
  return storageUnitMb || 1;
}

export function allocateBlock({
  nodes,
  block,
  file,
  replicationFactor,
  storageUnitMb,
  notifier
}) {
  const activeNodes = getActiveNodes(nodes);
  const unitMb = getStorageUnitMb(storageUnitMb);

  if (activeNodes.length < replicationFactor && notifier?.warn) {
    notifier.warn(`⚠️ Warning: insufficient nodes for ${replicationFactor}x replication!`);
  }

  const sortedNodes = [...activeNodes].sort((a, b) => {
    const aAvail = a.storageTotal * unitMb - a.storageUsed * unitMb;
    const bAvail = b.storageTotal * unitMb - b.storageUsed * unitMb;
    return bAvail - aAvail;
  });

  let replicasCreated = 0;

  for (let i = 0; i < sortedNodes.length && replicasCreated < replicationFactor; i += 1) {
    const node = sortedNodes[i];
    const availableMb = node.storageTotal * unitMb - node.storageUsed * unitMb;

    if (availableMb >= block.size) {
      const isReplica = replicasCreated > 0;
      node.storageUsed += block.size / unitMb;
      node.blocks.push({
        ...block,
        isReplica
      });
      replicasCreated += 1;

      if (!isReplica) {
        file.blocks.push(block);
      }
    }
  }

  if (replicasCreated === 0) {
    return false;
  }

  if (replicasCreated < replicationFactor && notifier?.warn) {
    notifier.warn(`⚠️ Block ${block.id}: Only ${replicasCreated}/${replicationFactor} replicas created`);
  }

  return true;
}

export function rollbackFileAllocation({ nodes, fileName, storageUnitMb }) {
  const unitMb = getStorageUnitMb(storageUnitMb);

  nodes.forEach((node) => {
    let freedMb = 0;
    node.blocks = node.blocks.filter((block) => {
      if (block.fileName === fileName) {
        freedMb += block.size;
        return false;
      }
      return true;
    });

    if (freedMb > 0) {
      node.storageUsed = Math.max(0, node.storageUsed - freedMb / unitMb);
    }
  });
}

export function reReplicateBlocksSimple({ failedNode, nodes, storageUnitMb, notifier }) {
  const unitMb = getStorageUnitMb(storageUnitMb);
  const blocksToReReplicate = [...failedNode.blocks];
  const activeNodes = nodes.filter((node) => !node.failed && node.id !== failedNode.id);

  if (activeNodes.length === 0) {
    notifier?.error?.('❌ No active nodes available for re-replication!');
    return {
      reReplicatedCount: 0,
      totalBlocks: blocksToReReplicate.length
    };
  }

  let reReplicatedCount = 0;

  for (const block of blocksToReReplicate) {
    const targetNode = activeNodes.reduce((best, node) => {
      const bestSpace = best.storageTotal * unitMb - best.storageUsed * unitMb;
      const nodeSpace = node.storageTotal * unitMb - node.storageUsed * unitMb;
      return nodeSpace > bestSpace ? node : best;
    });

    const availableMb = targetNode.storageTotal * unitMb - targetNode.storageUsed * unitMb;

    if (availableMb >= block.size) {
      targetNode.storageUsed += block.size / unitMb;
      targetNode.blocks.push({ ...block });
      reReplicatedCount += 1;
    }
  }

  notifier?.success?.(
    `✅ Re-replication complete! ${reReplicatedCount}/${blocksToReReplicate.length} blocks recovered on other nodes`
  );

  return {
    reReplicatedCount,
    totalBlocks: blocksToReReplicate.length
  };
}

export function reReplicateBlocksDetailed({ failedNode, nodes, replicationFactor, storageUnitMb, notifier }) {
  const unitMb = getStorageUnitMb(storageUnitMb);
  const activeNodes = nodes.filter((node) => !node.failed && node.id !== failedNode.id);

  if (activeNodes.length === 0) {
    notifier?.error?.('❌ No active nodes available for re-replication!');
    return {
      totalLost: 0,
      underReplicated: 0,
      reReplicated: 0
    };
  }

  const blockReplicationStatus = {};

  nodes.forEach((node) => {
    node.blocks.forEach((block) => {
      if (!blockReplicationStatus[block.id]) {
        blockReplicationStatus[block.id] = {
          block,
          replicaCount: 0,
          sourceNodes: [],
          wasOnFailedNode: false
        };
      }

      if (!node.failed) {
        blockReplicationStatus[block.id].replicaCount += 1;
        blockReplicationStatus[block.id].sourceNodes.push(node);
      } else if (node.id === failedNode.id) {
        blockReplicationStatus[block.id].wasOnFailedNode = true;
      }
    });
  });

  let reReplicated = 0;
  let underReplicated = 0;
  let totalLost = 0;

  for (const [blockId, status] of Object.entries(blockReplicationStatus)) {
    if (status.replicaCount === 0) {
      totalLost += 1;
      continue;
    }

    if (status.replicaCount < replicationFactor) {
      underReplicated += 1;

      const candidateNodes = activeNodes
        .filter((node) => !node.blocks.some((block) => block.id === blockId))
        .sort((a, b) => {
          const aSpace = a.storageTotal * unitMb - a.storageUsed * unitMb;
          const bSpace = b.storageTotal * unitMb - b.storageUsed * unitMb;
          return bSpace - aSpace;
        });

      if (candidateNodes.length > 0) {
        const targetNode = candidateNodes[0];
        const availableMb = targetNode.storageTotal * unitMb - targetNode.storageUsed * unitMb;

        if (availableMb >= status.block.size) {
          targetNode.storageUsed += status.block.size / unitMb;
          targetNode.blocks.push({
            ...status.block,
            isReplica: true
          });
          reReplicated += 1;
        }
      }
    }
  }

  if (totalLost > 0) {
    notifier?.error?.(`❌ CRITICAL: ${totalLost} blocks PERMANENTLY LOST! Data corruption detected!`);
  } else if (underReplicated > 0) {
    notifier?.success?.(
      `✅ Re-replication complete! ${reReplicated} replicas added, ${underReplicated} under-replicated blocks recovered`
    );
  } else {
    notifier?.success?.(`✅ No blocks need re-replication (all have RF=${replicationFactor})`);
  }

  return {
    totalLost,
    underReplicated,
    reReplicated
  };
}

export function computeHdfsStats({ nodes, files, replicationFactor, storageUnitMb }) {
  const unitMb = getStorageUnitMb(storageUnitMb);
  const activeNodes = nodes.filter((node) => !node.failed).length;
  const totalBlocks = nodes.reduce((sum, node) => sum + node.blocks.length, 0);
  const totalStorage = nodes.reduce((sum, node) => sum + node.storageTotal * unitMb, 0);
  const usedStorage = nodes.reduce((sum, node) => sum + node.storageUsed * unitMb, 0);

  return {
    totalNodes: nodes.length,
    activeNodes,
    totalFiles: files.length,
    totalBlocks,
    storageUsagePercent: totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0,
    replicationFactor
  };
}
