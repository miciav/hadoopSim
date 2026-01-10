import { releaseContainerByName } from './yarn.js';

function buildBlockLocations(nodes, fileName) {
  const locations = {};
  nodes.forEach((node) => {
    if (!node.failed) {
      node.blocks.forEach((block) => {
        if (block.fileName === fileName) {
          if (!locations[block.id]) {
            locations[block.id] = [];
          }
          locations[block.id].push(node.id);
        }
      });
    }
  });
  return locations;
}

export function releaseMapReduceResources({ cluster, job }) {
  const mapperNames = new Set(job.mappers.map((mapper) => mapper.name));

  cluster.nodes.forEach((node) => {
    let freedCpu = 0;
    let freedMem = 0;
    node.containers = node.containers.filter((container) => {
      const isMapper = mapperNames.has(container.name);
      const isAppMaster = container.isApplicationMaster && container.jobName === job.name;
      if (isMapper || isAppMaster) {
        freedCpu += container.cpu || 0;
        freedMem += container.memory || 0;
        return false;
      }
      return true;
    });
    if (freedCpu || freedMem) {
      node.cpuUsed = Math.max(0, node.cpuUsed - freedCpu);
      node.memoryUsed = Math.max(0, node.memoryUsed - freedMem);
    }
  });
}

export function runMapReduceJob({
  cluster,
  rng = Math.random,
  notifier,
  timers,
  mapperCpu = 2,
  mapperMemory = 4,
  mapperProgressStep = 6.25,
  mapperIntervalMin = 600,
  mapperIntervalMax = 1000,
  onUpdate,
  allocateApplicationMaster,
  allocateContainerOnNodes
}) {
  if (cluster.files.length === 0) {
    notifier?.warn?.('⚠️ Upload an HDFS file first!');
    return null;
  }

  const file = cluster.files[Math.floor(rng() * cluster.files.length)];
  const jobName = `MapReduce-${cluster.mapReduceCounter++}`;
  const blockLocations = buildBlockLocations(cluster.nodes, file.name);

  const job = {
    name: jobName,
    fileName: file.name,
    numMappers: file.blocks.length,
    status: 'running',
    progress: 0,
    mappers: [],
    appMasterNode: null
  };

  cluster.mapReduceJobs.push(job);

  const amAllocated = allocateApplicationMaster(jobName, job);
  if (!amAllocated) {
    cluster.mapReduceJobs.pop();
    cluster.jobQueue.push({ type: 'mapreduce' });
    notifier?.warn?.(`⏳ ${jobName} queued: cannot allocate ApplicationMaster`);
    return null;
  }

  const nodeMapperCount = {};
  cluster.nodes.forEach((node) => {
    nodeMapperCount[node.id] = node.containers.filter((container) => container.isMapReduce).length;
  });

  let allocatedMappers = 0;
  let dataLocalityCount = 0;

  file.blocks.forEach((block, index) => {
    const mapperName = `${jobName}-M${index + 1}`;
    const nodesWithBlock = blockLocations[block.id] || [];

    if (nodesWithBlock.length === 0) {
      job.status = 'failed';
      notifier?.error?.(`❌ ${jobName} cannot start: block ${block.id} not found on any node!`);
      releaseMapReduceResources({ cluster, job });
      onUpdate?.();
      return;
    }

    const candidateNodes = nodesWithBlock
      .map((nodeId) => cluster.nodes.find((node) => node.id === nodeId))
      .filter((node) => node && !node.failed)
      .sort((a, b) => {
        const aMappers = nodeMapperCount[a.id];
        const bMappers = nodeMapperCount[b.id];
        if (aMappers !== bMappers) return aMappers - bMappers;
        const aCpuAvail = a.cpuTotal - a.cpuUsed;
        const bCpuAvail = b.cpuTotal - b.cpuUsed;
        return bCpuAvail - aCpuAvail;
      });

    let allocated = false;

    for (const targetNode of candidateNodes) {
      const container = {
        name: mapperName,
        cpu: mapperCpu,
        memory: mapperMemory,
        isMapReduce: true,
        blockIds: [block.id]
      };
      const node = allocateContainerOnNodes({
        nodes: cluster.nodes,
        container,
        preferredNodeIds: [targetNode.id]
      });

      if (node) {
        nodeMapperCount[node.id] += 1;
        allocatedMappers += 1;
        dataLocalityCount += 1;
        job.mappers.push({
          name: mapperName,
          blockId: block.id,
          nodeId: node.id,
          progress: 0
        });
        allocated = true;
        break;
      }
    }

    if (!allocated) {
      const activeNodes = cluster.nodes
        .filter((node) => !node.failed)
        .sort((a, b) => nodeMapperCount[a.id] - nodeMapperCount[b.id]);

      for (const node of activeNodes) {
        const container = {
          name: mapperName,
          cpu: mapperCpu,
          memory: mapperMemory,
          isMapReduce: true,
          blockIds: [block.id]
        };

        if (allocateContainerOnNodes({ nodes: [node], container })) {
          nodeMapperCount[node.id] += 1;
          allocatedMappers += 1;
          job.mappers.push({
            name: mapperName,
            blockId: block.id,
            nodeId: node.id,
            progress: 0
          });
          allocated = true;
          break;
        }
      }
    }
  });

  if (allocatedMappers === file.blocks.length) {
    notifier?.success?.(`✅ ${jobName} started`);
    onUpdate?.();

    job.mappers.forEach((mapper) => {
      const intervalMs = mapperIntervalMin + rng() * (mapperIntervalMax - mapperIntervalMin);
      const mapperInterval = timers.interval(() => {
        if (mapper.progress === -1 || job.status === 'failed') {
          timers.clearInterval(mapperInterval);
          return;
        }

        mapper.progress += mapperProgressStep;

        if (mapper.progress >= 100) {
          mapper.progress = 100;
          timers.clearInterval(mapperInterval);
        }

        const activeMappers = job.mappers.filter((entry) => entry.progress >= 0);
        const totalProgress = activeMappers.reduce((sum, entry) => sum + entry.progress, 0);
        job.progress = activeMappers.length > 0 ? totalProgress / activeMappers.length : 0;

        const allActiveDone = activeMappers.every((entry) => entry.progress >= 100);
        if (allActiveDone && activeMappers.length > 0) {
          job.status = 'completed';

          activeMappers.forEach((activeMapper) => {
            releaseContainerByName(cluster.nodes, activeMapper.name);
          });

          cluster.nodes.forEach((node) => {
            const amIndex = node.containers.findIndex(
              (container) => container.isApplicationMaster && container.jobName === jobName
            );
            if (amIndex !== -1) {
              const am = node.containers[amIndex];
              node.cpuUsed -= am.cpu;
              node.memoryUsed -= am.memory;
              node.containers.splice(amIndex, 1);
            }
          });

          const failedMappers = job.mappers.filter((entry) => entry.progress === -1).length;
          if (failedMappers > 0) {
            notifier?.success?.(`✅ ${jobName} completed with ${failedMappers} failed mapper(s)!`);
          } else {
            notifier?.success?.(`✅ ${jobName} completed!`);
          }
        }
        onUpdate?.();
      }, intervalMs);
    });
  } else {
    notifier?.warn?.(`⚠️ Only ${allocatedMappers}/${file.blocks.length} mappers allocated`);
    onUpdate?.();
  }

  return {
    job,
    allocatedMappers,
    localityPercent: allocatedMappers > 0 ? Math.round((dataLocalityCount / allocatedMappers) * 100) : 0
  };
}

export function handleMapReduceNodeFailure({ cluster, failedNode, notifier, allocateApplicationMaster }) {
  const remainingNodes = cluster.nodes.filter((node) => !node.failed && node.id !== failedNode.id);
  const affectedJobs = [];

  cluster.mapReduceJobs.forEach((job) => {
    if (job.status !== 'running') {
      return;
    }

    const mappersOnFailedNode = job.mappers.filter((mapper) => mapper.nodeId === failedNode.id);
    if (mappersOnFailedNode.length === 0) {
      return;
    }

    let rescheduled = 0;
    let notRescheduled = 0;

    mappersOnFailedNode.forEach((mapper) => {
      const containerIndex = failedNode.containers.findIndex((container) => container.name === mapper.name);
      let cpu = 2;
      let memory = 4;

      if (containerIndex !== -1) {
        const container = failedNode.containers[containerIndex];
        cpu = container.cpu;
        memory = container.memory;
        failedNode.cpuUsed -= container.cpu;
        failedNode.memoryUsed -= container.memory;
        failedNode.containers.splice(containerIndex, 1);
      }

      const nodesWithBlock = remainingNodes.filter((node) => node.blocks.some((block) => block.id === mapper.blockId));
      const candidates = nodesWithBlock.length > 0 ? nodesWithBlock : remainingNodes;

      let allocated = false;
      for (const node of candidates) {
        if (node.cpuTotal - node.cpuUsed >= cpu && node.memoryTotal - node.memoryUsed >= memory) {
          node.cpuUsed += cpu;
          node.memoryUsed += memory;
          node.containers.push({
            name: mapper.name,
            cpu,
            memory,
            isMapReduce: true,
            blockIds: [mapper.blockId]
          });
          mapper.nodeId = node.id;
          mapper.progress = 0;
          allocated = true;
          rescheduled += 1;
          break;
        }
      }

      if (!allocated) {
        mapper.progress = -1;
        notRescheduled += 1;
      }
    });

    let summary = `${job.name}: ${mappersOnFailedNode.length} mapper(s) on failed node`;
    if (rescheduled > 0) {
      summary += `, ${rescheduled} restarted on other nodes`;
    }
    if (notRescheduled > 0) {
      summary += `, ${notRescheduled} could not be restarted`;
    }
    affectedJobs.push(summary);

    const amIndex = failedNode.containers.findIndex(
      (container) => container.isApplicationMaster && container.jobName === job.name
    );
    if (amIndex !== -1) {
      const am = failedNode.containers[amIndex];
      failedNode.cpuUsed -= am.cpu;
      failedNode.memoryUsed -= am.memory;
      failedNode.containers.splice(amIndex, 1);

      const reallocated = allocateApplicationMaster(job.name, job);
      if (!reallocated) {
        job.status = 'failed';
        releaseMapReduceResources({ cluster, job });
      }
    }
  });

  if (affectedJobs.length > 0) {
    notifier?.error?.(`💥 ${failedNode.name} failed! MapReduce job(s) affected: ${affectedJobs.join(' | ')}`);
  }

  return affectedJobs;
}
