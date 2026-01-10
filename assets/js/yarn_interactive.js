import { createTimerManager } from './core/timers.js';
import { createNotifier } from './core/notifications.js';
import { randomInt } from './core/random.js';
import {
  allocateContainer,
  releaseContainerByName,
  computeYarnStats
} from './core/yarn.js';

const timers = createTimerManager();
const notifier = createNotifier({ root: document.body, ttlMs: 3000 });

// Cluster state
const cluster = {
  nodes: [],
  jobQueue: [],
  jobCounter: 1
};

// Initialize nodes
function initializeCluster() {
  cluster.nodes = [
    { id: 1, name: 'Node-01', cpuTotal: 8, cpuUsed: 0, memoryTotal: 16, memoryUsed: 0, containers: [] },
    { id: 2, name: 'Node-02', cpuTotal: 8, cpuUsed: 0, memoryTotal: 16, memoryUsed: 0, containers: [] },
    { id: 3, name: 'Node-03', cpuTotal: 12, cpuUsed: 0, memoryTotal: 24, memoryUsed: 0, containers: [] },
    { id: 4, name: 'Node-04', cpuTotal: 12, cpuUsed: 0, memoryTotal: 24, memoryUsed: 0, containers: [] },
    { id: 5, name: 'Node-05', cpuTotal: 16, cpuUsed: 0, memoryTotal: 32, memoryUsed: 0, containers: [] },
    { id: 6, name: 'Node-06', cpuTotal: 16, cpuUsed: 0, memoryTotal: 32, memoryUsed: 0, containers: [] }
  ];
  renderCluster();
}

// Render the cluster
function renderCluster() {
  const grid = document.getElementById('nodesGrid');
  grid.innerHTML = '';

  cluster.nodes.forEach((node) => {
    const cpuPercent = ((node.cpuUsed / node.cpuTotal) * 100).toFixed(0);
    const memPercent = ((node.memoryUsed / node.memoryTotal) * 100).toFixed(0);

    let status = 'idle';
    let statusClass = 'active';
    if (cpuPercent >= 100 || memPercent >= 100) {
      status = 'full';
      statusClass = 'full';
    } else if (cpuPercent > 0 || memPercent > 0) {
      status = 'busy';
      statusClass = 'busy';
    }

    const nodeEl = document.createElement('div');
    nodeEl.className = `node ${statusClass}`;
    nodeEl.innerHTML = `
      <div class="node-header">
        <div class="node-title">💻 ${node.name}</div>
        <div class="node-status status-${status}">${status.toUpperCase()}</div>
      </div>
      <div class="node-resources">
        <div class="resource-bar">
          <div class="resource-label">
            <span>🔥 CPU Cores</span>
            <span>${node.cpuUsed} / ${node.cpuTotal}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill cpu-fill" style="width: ${cpuPercent}%">
              ${cpuPercent}%
            </div>
          </div>
        </div>
        <div class="resource-bar">
          <div class="resource-label">
            <span>💾 Memory (GB)</span>
            <span>${node.memoryUsed} / ${node.memoryTotal}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill memory-fill" style="width: ${memPercent}%">
              ${memPercent}%
            </div>
          </div>
        </div>
      </div>
      <div class="containers">
        <div class="containers-title">📦 Running Containers: ${node.containers.length}</div>
        <div class="container-list">
          ${node.containers
            .map((container) => {
              const label = typeof container === 'string' ? container : container.name;
              return `<div class="container-item">${label}</div>`;
            })
            .join('')}
        </div>
      </div>
    `;
    grid.appendChild(nodeEl);
  });

  updateStats();
  updateQueue();
}

// Update statistics
function updateStats() {
  const stats = computeYarnStats(cluster.nodes);

  document.getElementById('totalNodes').textContent = cluster.nodes.length;
  document.getElementById('activeApps').textContent = stats.activeApps;
  document.getElementById('queuedJobs').textContent = cluster.jobQueue.length;
  document.getElementById('cpuUsage').textContent = `${stats.cpuUsagePercent.toFixed(1)}%`;
  document.getElementById('memoryUsage').textContent = `${stats.memoryUsagePercent.toFixed(1)}%`;
}

// Update queue display
function updateQueue() {
  const queueEl = document.getElementById('jobQueue');
  const queueItems = document.getElementById('queueItems');

  if (cluster.jobQueue.length > 0) {
    queueEl.style.display = 'block';
    queueItems.innerHTML = cluster.jobQueue
      .map((job) => {
        if (job.jobId) {
          return `<div class="queue-item">Job-${job.jobId}[${job.containerNum}/${job.totalContainers}] (${job.cpu}C, ${job.memory}GB)</div>`;
        }
        return `<div class="queue-item">Job-${job.id} (${job.cpu}C, ${job.memory}GB)</div>`;
      })
      .join('');
  } else {
    queueEl.style.display = 'none';
  }
}

// Submit a job
function submitJob() {
  const cpu = randomInt(1, 4);
  const memory = randomInt(2, 9);
  const job = { id: cluster.jobCounter++, cpu, memory };

  if (allocateJob(job)) {
    notifier.success(`✅ Job-${job.id} allocated successfully!`);
  } else {
    cluster.jobQueue.push(job);
    notifier.info(`⏳ Job-${job.id} queued (waiting for resources)`);
  }

  renderCluster();
}

// Submit a big job (distributed across multiple nodes)
function submitBigJob() {
  const jobId = cluster.jobCounter++;
  const numContainers = randomInt(3, 5);

  const containers = [];
  for (let i = 0; i < numContainers; i += 1) {
    const cpu = randomInt(2, 4);
    const memory = randomInt(4, 9);
    containers.push({
      id: `${jobId}-${i + 1}`,
      cpu,
      memory,
      jobId,
      containerNum: i + 1,
      totalContainers: numContainers
    });
  }

  let allocatedContainers = 0;
  const queuedContainers = [];

  containers.forEach((container) => {
    if (allocateBigJobContainer(container)) {
      allocatedContainers += 1;
    } else {
      queuedContainers.push(container);
    }
  });

  if (allocatedContainers === containers.length) {
    notifier.success(`✅ Big Job-${jobId} distributed across ${allocatedContainers} nodes!`);
  } else if (allocatedContainers > 0) {
    queuedContainers.forEach((container) => cluster.jobQueue.push(container));
    notifier.info(
      `⚠️ Big Job-${jobId}: ${allocatedContainers}/${containers.length} containers running, ${queuedContainers.length} queued`
    );
  } else {
    queuedContainers.forEach((container) => cluster.jobQueue.push(container));
    notifier.info(`⏳ Big Job-${jobId} fully queued (${containers.length} containers waiting)`);
  }

  renderCluster();
}

function allocateJob(job) {
  const container = {
    name: `Job-${job.id}`,
    cpu: job.cpu,
    memory: job.memory,
    jobId: job.id
  };

  const node = allocateContainer({ nodes: cluster.nodes, container });
  if (node) {
    timers.timeout(() => completeJob(node.id, job), Math.random() * 5000 + 5000);
    return true;
  }
  return false;
}

function allocateBigJobContainer(container) {
  const containerRecord = {
    name: `Job-${container.jobId}[${container.containerNum}/${container.totalContainers}]`,
    cpu: container.cpu,
    memory: container.memory,
    jobId: container.jobId
  };

  const node = allocateContainer({ nodes: cluster.nodes, container: containerRecord });
  if (node) {
    timers.timeout(() => completeBigJobContainer(node.id, container), Math.random() * 7000 + 8000);
    return true;
  }
  return false;
}

function completeJob(nodeId, job) {
  releaseContainerByName(cluster.nodes, `Job-${job.id}`);
  const node = cluster.nodes.find((entry) => entry.id === nodeId);
  if (node) {
    notifier.success(`✅ Job-${job.id} completed on ${node.name}!`);
  }

  drainQueue();
  renderCluster();
}

function completeBigJobContainer(nodeId, container) {
  releaseContainerByName(
    cluster.nodes,
    `Job-${container.jobId}[${container.containerNum}/${container.totalContainers}]`
  );

  const node = cluster.nodes.find((entry) => entry.id === nodeId);
  if (node) {
    notifier.success(
      `✅ Job-${container.jobId}[${container.containerNum}/${container.totalContainers}] completed on ${node.name}!`
    );
  }

  drainQueue();
  renderCluster();
}

function drainQueue() {
  if (cluster.jobQueue.length === 0) {
    return;
  }

  const queuedJob = cluster.jobQueue[0];
  if (queuedJob.jobId) {
    if (allocateBigJobContainer(queuedJob)) {
      cluster.jobQueue.shift();
      notifier.info(`🚀 Queued container Job-${queuedJob.jobId}[${queuedJob.containerNum}] now running!`);
    }
  } else if (allocateJob(queuedJob)) {
    cluster.jobQueue.shift();
    notifier.info(`🚀 Queued Job-${queuedJob.id} now running!`);
  }
}

// Reset cluster
function resetCluster() {
  timers.clearAll();
  cluster.jobQueue = [];
  initializeCluster();
  notifier.info('🔄 Cluster reset!');
}

initializeCluster();

window.cluster = cluster;
window.submitJob = submitJob;
window.submitBigJob = submitBigJob;
window.resetCluster = resetCluster;
window.renderCluster = renderCluster;
