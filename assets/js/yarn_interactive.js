import { createSimulation } from './hadoop-sim/simulation.js';
import { randomInt } from './hadoop-sim/random.js';

const nodes = [
  { id: 1, name: 'Node-01', cpuTotal: 8, memoryTotalMb: 16 * 1024, storageTotalMb: 50000 },
  { id: 2, name: 'Node-02', cpuTotal: 8, memoryTotalMb: 16 * 1024, storageTotalMb: 50000 },
  { id: 3, name: 'Node-03', cpuTotal: 12, memoryTotalMb: 24 * 1024, storageTotalMb: 60000 },
  { id: 4, name: 'Node-04', cpuTotal: 12, memoryTotalMb: 24 * 1024, storageTotalMb: 60000 },
  { id: 5, name: 'Node-05', cpuTotal: 16, memoryTotalMb: 32 * 1024, storageTotalMb: 80000 },
  { id: 6, name: 'Node-06', cpuTotal: 16, memoryTotalMb: 32 * 1024, storageTotalMb: 80000 }
];

const sim = createSimulation({ nodes });
const completionTimers = new Map();

function notify(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.setAttribute('role', 'status');
  notification.setAttribute('aria-live', 'polite');
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function scheduleCompletion(container) {
  if (completionTimers.has(container.name)) {
    return;
  }
  const duration = randomInt(5000, 9000);
  const timeoutId = setTimeout(() => {
    completionTimers.delete(container.name);
    sim.yarn.releaseContainer(container.name);
    notify(`✅ ${container.name} completed`, 'success');
    renderCluster();
  }, duration);
  completionTimers.set(container.name, timeoutId);
}

sim.on('yarn:allocated', ({ container }) => {
  scheduleCompletion(container);
  renderCluster();
});

sim.on('yarn:queued', () => {
  renderCluster();
});

function renderCluster() {
  const grid = document.getElementById('nodesGrid');
  grid.innerHTML = '';

  sim.state.nodes.forEach((node) => {
    const cpuPercent = ((node.cpuUsed / node.cpuTotal) * 100).toFixed(0);
    const memPercent = ((node.memoryUsedMb / node.memoryTotalMb) * 100).toFixed(0);

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
            <span>${(node.memoryUsedMb / 1024).toFixed(0)} / ${(node.memoryTotalMb / 1024).toFixed(0)}</span>
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
            .map((container) => `<div class="container-item">${container.name}</div>`)
            .join('')}
        </div>
      </div>
    `;
    grid.appendChild(nodeEl);
  });

  updateStats();
  updateQueue();
}

function updateStats() {
  const stats = sim.yarn.stats();
  document.getElementById('totalNodes').textContent = sim.state.nodes.length;
  document.getElementById('activeApps').textContent = stats.activeContainers;
  document.getElementById('queuedJobs').textContent = stats.queuedRequests;
  document.getElementById('cpuUsage').textContent = `${stats.cpuUsagePercent.toFixed(1)}%`;
  document.getElementById('memoryUsage').textContent = `${stats.memoryUsagePercent.toFixed(1)}%`;
}

function updateQueue() {
  const queueEl = document.getElementById('jobQueue');
  const queueItems = document.getElementById('queueItems');

  if (sim.state.yarnQueue.length > 0) {
    queueEl.style.display = 'block';
    queueItems.innerHTML = sim.state.yarnQueue
      .map((job) => {
        const label = job.name || 'Job';
        return `<div class="queue-item">${label} (${job.cpu}C, ${(job.memoryMb / 1024).toFixed(0)}GB)</div>`;
      })
      .join('');
  } else {
    queueEl.style.display = 'none';
  }
}

function submitJob() {
  const cpu = randomInt(1, 4);
  const memoryMb = randomInt(2, 9) * 1024;
  const jobId = sim.state.counters.job++;
  const name = `Job-${jobId}`;

  const result = sim.actions.submitYarnJob({ name, cpu, memoryMb, jobId });
  if (result.allocated) {
    notify(`✅ ${name} allocated successfully!`, 'success');
  } else if (result.queued) {
    notify(`⏳ ${name} queued (waiting for resources)`, 'info');
  } else {
    notify(`❌ ${name} rejected (queue full)`, 'error');
  }

  renderCluster();
}

function submitBigJob() {
  const jobId = sim.state.counters.job++;
  const numContainers = randomInt(3, 5);
  const requests = [];

  for (let i = 0; i < numContainers; i += 1) {
    const cpu = randomInt(2, 4);
    const memoryMb = randomInt(4, 9) * 1024;
    requests.push({
      name: `Job-${jobId}[${i + 1}/${numContainers}]`,
      cpu,
      memoryMb,
      jobId
    });
  }

  const results = sim.actions.submitDistributedJob(requests);
  const allocated = results.filter((entry) => entry.allocated).length;
  const queued = results.filter((entry) => entry.queued).length;

  if (allocated === numContainers) {
    notify(`✅ Big Job-${jobId} distributed across ${allocated} nodes!`, 'success');
  } else if (allocated > 0) {
    notify(`⚠️ Big Job-${jobId}: ${allocated}/${numContainers} running, ${queued} queued`, 'info');
  } else {
    notify(`⏳ Big Job-${jobId} fully queued (${numContainers} containers)`, 'info');
  }

  renderCluster();
}

function resetCluster() {
  completionTimers.forEach((timeoutId) => clearTimeout(timeoutId));
  completionTimers.clear();
  sim.actions.reset();
  notify('🔄 Cluster reset!', 'info');
  renderCluster();
}

renderCluster();

window.simulation = sim;
window.cluster = sim.state;
window.submitJob = submitJob;
window.submitBigJob = submitBigJob;
window.resetCluster = resetCluster;
window.renderCluster = renderCluster;
