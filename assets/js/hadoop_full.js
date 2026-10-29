import { createNotifier } from './hadoop-sim/notifications.js';
import { createSimulation } from './hadoop-sim/simulation.js';
import { describeMapReduceFailure } from './hadoop-sim/mapreduce.js';
import { randomInt } from './hadoop-sim/random.js';

const COLORS = Array.from(
  { length: 8 },
  (_, index) => `var(--sim-file-${index})`
);
let colorIndex = 0;
const fileColors = new Map();

const sim = createSimulation({
  nodeCount: 6,
  replicationFactor: 2,
  blockSizeMb: 256,
  nodeTemplate: {
    cpuTotal: 16,
    memoryTotalMb: 32 * 1024,
    storageTotalMb: 10 * 1024,
    namePrefix: 'Node-'
  }
});

const yarnCompletionTimers = new Map();
const yarnJobsByContainer = new Map();

function nextColor() {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex += 1;
  return color;
}

function ensureFileColor(fileName) {
  if (!fileColors.has(fileName)) {
    fileColors.set(fileName, nextColor());
  }
}

const { notify, clear: clearNotifications } = createNotifier(4000);

function scheduleYarnCompletion(containerName, jobRecord = null) {
  if (yarnCompletionTimers.has(containerName)) {
    return;
  }
  const duration = randomInt(8000, 13000);
  const timerId = setTimeout(() => {
    yarnCompletionTimers.delete(containerName);
    sim.yarn.releaseContainer(containerName);

    if (jobRecord) {
      jobRecord.completedContainers += 1;
      if (
        !jobRecord.failed &&
        jobRecord.completedContainers === jobRecord.numContainers
      ) {
        notify(`✅ ${jobRecord.name} completed!`, 'success');
      }
    }

    renderCluster();
  }, duration);

  yarnCompletionTimers.set(containerName, timerId);
}

sim.on('mapreduce:started', renderCluster);
sim.on('mapreduce:progress', renderCluster);
sim.on('mapreduce:completed', renderCluster);
sim.on('mapreduce:failed', renderCluster);
sim.on('hdfs:uploadComplete', renderCluster);
sim.on('hdfs:reReplicated', renderCluster);

// Render entire cluster
function renderCluster() {
  renderUnifiedNodes();
  renderFilesList();
  updateStats();
  checkDataLocality();
  renderMapReduceJobs();
}

function renderUnifiedNodes() {
  const container = document.getElementById('hdfsNodes');

  const nodesHTML = sim.state.nodes
    .map((node) => {
      const storagePercent = (node.storageUsedMb / node.storageTotalMb) * 100;
      const cpuPercent = (node.cpuUsed / node.cpuTotal) * 100;
      const memPercent = (node.memoryUsedMb / node.memoryTotalMb) * 100;
      const status = node.failed
        ? 'failed'
        : storagePercent > 80 || cpuPercent > 70
          ? 'busy'
          : 'active';

      const hasDataLocality = checkNodeDataLocality(node);

      const blocksHTML =
        node.blocks.length > 0
          ? node.blocks
              .map((block) => {
                const color =
                  fileColors.get(block.fileName) || 'var(--sim-muted)';
                return `
                  <div class="block-chip" style="background-color: ${color};">
                    ${block.id}${block.isReplica ? '★' : ''}
                  </div>
                `;
              })
              .join('')
          : '<span class="render-detail-0">No blocks</span>';

      const containersHTML =
        node.containers.length > 0
          ? node.containers
              .map((container) => {
                const isAM = container.isApplicationMaster;
                let mapperProgress = null;
                let mapperFailed = false;

                if (container.isMapReduce && !isAM) {
                  for (const job of sim.state.mapReduceJobs) {
                    const mapper = job.mappers.find(
                      (entry) => entry.name === container.name
                    );
                    if (mapper) {
                      if (mapper.progress === -1) {
                        mapperFailed = true;
                      } else {
                        mapperProgress = mapper.progress;
                      }
                      break;
                    }
                  }
                }

                return `
                  <div class="render-detail-1 container-chip ${container.isMapReduce ? 'mapreduce' : ''} ${
                    isAM ? 'appmaster' : ''
                  } ${mapperFailed ? 'failed' : ''}">
                    ${
                      mapperProgress !== null && !mapperFailed
                        ? `
                          <div style="position: absolute; bottom: 0; left: 0; height: 3px; width: ${
                            mapperProgress
                          }%; background: var(--sim-success); transition: width 0.3s;"></div>
                        `
                        : ''
                    }
                    ${isAM ? '👑 ' : ''}${container.name}
                    ${mapperFailed ? ' ❌' : ''}
                    ${
                      mapperProgress !== null && !mapperFailed
                        ? ` (${Math.round(mapperProgress)}%)`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')
          : '<span class="render-detail-2">No containers</span>';

      return `
        <div class="node ${status} ${hasDataLocality ? 'data-locality' : ''}">
          <div class="node-header">
            <div class="node-name">🖥️ ${node.name}</div>
            <div class="node-status status-${status}">
              ${node.failed ? 'Failed' : storagePercent > 80 || cpuPercent > 70 ? 'Busy' : 'Active'}
            </div>
          </div>

          <div class="node-resources">
            <div class="resource-bar">
              <div class="resource-label">
                <span>💾 Storage</span>
                <span>${(node.storageUsedMb / 1024).toFixed(1)}/${(node.storageTotalMb / 1024).toFixed(0)} GB</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${storagePercent > 80 ? 'danger' : ''}" style="width: ${storagePercent}%"></div>
              </div>
            </div>

            <div class="resource-bar">
              <div class="resource-label">
                <span>⚙️ CPU</span>
                <span>${node.cpuUsed.toFixed(1)}/${node.cpuTotal} cores</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill yarn ${cpuPercent > 70 ? 'warning' : ''}" style="width: ${cpuPercent}%"></div>
              </div>
            </div>

            <div class="resource-bar">
              <div class="resource-label">
                <span>🧠 Memory</span>
                <span>${(node.memoryUsedMb / 1024).toFixed(1)}/${(node.memoryTotalMb / 1024).toFixed(0)} GB</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill yarn ${memPercent > 70 ? 'warning' : ''}" style="width: ${memPercent}%"></div>
              </div>
            </div>
          </div>

          <div class="blocks-section">
            <div class="section-title">📦 HDFS Blocks (${node.blocks.length})</div>
            <div class="blocks-container">${blocksHTML}</div>
          </div>

          <div class="containers-section">
            <div class="section-title">🔷 YARN Containers (${node.containers.length})</div>
            ${containersHTML}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = nodesHTML;
}

function checkNodeDataLocality(node) {
  if (node.containers.length === 0 || node.blocks.length === 0) return false;
  for (const container of node.containers) {
    if (container.isMapReduce && container.blockIds) {
      for (const blockId of container.blockIds) {
        if (node.blocks.some((block) => block.id === blockId)) {
          return true;
        }
      }
    }
  }
  return false;
}

function checkDataLocality() {
  let localityCount = 0;
  let totalContainers = 0;

  sim.state.nodes.forEach((node) => {
    node.containers.forEach((container) => {
      if (container.isMapReduce) {
        totalContainers += 1;
        if (container.blockIds) {
          for (const blockId of container.blockIds) {
            if (node.blocks.some((block) => block.id === blockId)) {
              localityCount += 1;
              break;
            }
          }
        }
      }
    });
  });

  const summaryEl = document.getElementById('dataLocalitySummary');
  if (!summaryEl) return;

  if (totalContainers === 0) {
    summaryEl.textContent = '-';
    return;
  }

  const percentage = ((localityCount / totalContainers) * 100).toFixed(0);
  summaryEl.textContent = `${localityCount}/${totalContainers} (${percentage}%)`;
}

function renderFilesList() {
  const container = document.getElementById('filesList');

  if (sim.state.files.length === 0) {
    container.innerHTML =
      '<p class="render-detail-3">No files uploaded yet. Upload a file to start!</p>';
    document.getElementById('mapReduceBtn').disabled = true;
    return;
  }

  document.getElementById('mapReduceBtn').disabled = false;

  container.innerHTML = sim.state.files
    .map((file) => {
      ensureFileColor(file.name);
      const color = fileColors.get(file.name);
      return `
        <div class="file-item">
          <div class="file-name">📄 ${file.name} - ${file.sizeMb} MB</div>
          <div class="file-blocks-visual">
            ${file.blocks
              .map(
                (block) => `
                  <div class="block-chip" style="background-color: ${color};">
                    ${block.id}
                  </div>
                `
              )
              .join('')}
          </div>
          <div class="render-detail-4">
            ${file.blocks.length} blocks × ${sim.state.config.replicationFactor} replicas = ${
              file.blocks.length * sim.state.config.replicationFactor
            } total blocks
          </div>
        </div>
      `;
    })
    .join('');
}

function renderMapReduceJobs() {
  const section = document.getElementById('mapReduceSection');
  const container = document.getElementById('mapReduceJobs');

  const hasActiveJobs =
    sim.state.mapReduceJobs.length > 0 || sim.state.yarnJobs.length > 0;

  if (!hasActiveJobs) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  let html = '';

  html += sim.state.mapReduceJobs
    .map((job) => {
      const statusLabel =
        job.status === 'failed'
          ? 'Failed'
          : job.status === 'running'
            ? 'Running'
            : job.status === 'queued'
              ? 'Queued'
              : 'Completed';
      const localityPercent =
        job.localityPercent ??
        (job.mappers.length > 0
          ? Math.round(
              (job.mappers.filter((mapper) => {
                const node = sim.state.nodes.find(
                  (n) => n.id === mapper.nodeId
                );
                return node && node.blocks.some((b) => b.id === mapper.blockId);
              }).length /
                job.mappers.length) *
                100
            )
          : 0);

      return `
        <div class="mapreduce-job">
          <div class="job-header">
            <div class="job-name">🔄 ${job.name}</div>
            <div class="job-status status-${job.status}">
              ${statusLabel}
            </div>
          </div>
          <div class="render-detail-5">
            File: ${job.fileName}
          </div>
          <div class="render-detail-6">
            ${job.mappers.length} mappers (${localityPercent}% data locality)
          </div>
          ${job.status === 'failed' ? `<div>${describeMapReduceFailure(job.failureReason)}</div>` : ''}
          <div class="job-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${job.progress}%; background: var(--sim-warning);"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  html += sim.state.yarnJobs
    .map((job) => {
      const progress = (job.completedContainers / job.numContainers) * 100;
      const status = job.failed
        ? 'failed'
        : job.completedContainers === job.numContainers
          ? 'completed'
          : 'running';

      return `
        <div class="mapreduce-job">
          <div class="job-header">
            <div class="job-name">🎯 ${job.name}</div>
            <div class="job-status status-${status}">
              ${status === 'failed' ? 'Failed' : status === 'running' ? 'Running' : 'Completed'}
            </div>
          </div>
          <div class="render-detail-7">
            Distributed YARN Job
          </div>
          <div class="render-detail-8">
            ${job.completedContainers}/${job.numContainers} containers completed
          </div>
          <div class="job-progress">
            <div class="progress-bar">
              <div class="progress-fill yarn" style="width: ${progress}%;"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;
}

function updateStats() {
  const activeNodes = sim.state.nodes.filter((node) => !node.failed).length;
  const totalBlocks = sim.state.nodes.reduce(
    (sum, node) => sum + node.blocks.length,
    0
  );
  const activeJobs = sim.state.nodes.reduce(
    (sum, node) => sum + node.containers.filter((c) => !c.isMapReduce).length,
    0
  );
  const mapReduceJobs = sim.state.mapReduceJobs.filter(
    (job) => job.status === 'running'
  ).length;

  document.getElementById('totalNodes').textContent = sim.state.nodes.length;
  document.getElementById('activeNodes').textContent = activeNodes;
  document.getElementById('totalFiles').textContent = sim.state.files.length;
  document.getElementById('totalBlocks').textContent = totalBlocks;
  document.getElementById('activeJobs').textContent = activeJobs;
  document.getElementById('mapReduceJobsCount').textContent = mapReduceJobs;

  const queuedJobsEl = document.getElementById('queuedJobs');
  if (queuedJobsEl) {
    queuedJobsEl.textContent =
      sim.state.yarnQueue.length + sim.state.mapReduceQueue.length;
  }
}

function uploadFile() {
  const size = randomInt(100, 300);
  const result = sim.actions.uploadFile(size);

  if (!result.ok) {
    notify(`❌ Failed to upload ${size} MB: insufficient space!`, 'error');
    return;
  }

  ensureFileColor(result.file.name);

  if (result.results.some((entry) => entry.underReplicated)) {
    notify(
      `⚠️ ${result.file.name} uploaded with under-replicated blocks`,
      'warning'
    );
  } else {
    notify(`✅ ${result.file.name} uploaded!`, 'success');
  }

  renderCluster();
}

function uploadLargeFile() {
  const size = randomInt(400, 800);
  const result = sim.actions.uploadFile(size);

  if (!result.ok) {
    notify(`❌ Failed to upload ${size} MB: insufficient space!`, 'error');
    return;
  }

  ensureFileColor(result.file.name);

  if (result.results.some((entry) => entry.underReplicated)) {
    notify(
      `⚠️ ${result.file.name} uploaded with under-replicated blocks`,
      'warning'
    );
  } else {
    notify(`✅ ${result.file.name} uploaded!`, 'success');
  }

  renderCluster();
}

function submitYarnJob() {
  const cpu = randomInt(2, 5);
  const memoryGb = randomInt(4, 12);
  const jobId = sim.state.counters.job++;
  const name = `Job-${jobId}`;

  const result = sim.actions.submitYarnJob({
    name,
    cpu,
    memoryMb: memoryGb * 1024,
    jobId
  });

  if (result.allocated && result.container) {
    notify(`✅ ${name} allocated (${cpu} CPU, ${memoryGb} GB RAM)`, 'success');
    scheduleYarnCompletion(result.container.name, null);
  } else if (result.queued) {
    notify(`⏳ ${name} queued (insufficient resources)`, 'warning');
  } else if (!result.reason) {
    notify(`❌ ${name} rejected (queue full)`, 'error');
  }

  renderCluster();
}

function submitBigYarnJob() {
  const jobId = sim.state.counters.job++;
  const numContainers = randomInt(3, 4);
  const jobRecord = {
    id: jobId,
    name: `BigJob-${jobId}`,
    numContainers,
    completedContainers: 0
  };

  sim.state.yarnJobs.push(jobRecord);

  const requests = [];
  for (let i = 0; i < numContainers; i += 1) {
    const cpu = randomInt(2, 4);
    const memoryGb = randomInt(4, 9);
    const name = `Job-${jobId}[${i + 1}/${numContainers}]`;
    requests.push({
      name,
      cpu,
      memoryMb: memoryGb * 1024,
      jobId
    });
    yarnJobsByContainer.set(name, jobRecord);
  }

  const results = sim.actions.submitDistributedJob(requests);
  const allocated = results.filter((entry) => entry.allocated).length;

  if (allocated === numContainers) {
    notify(
      `✅ Big YARN ${jobRecord.name} started (${allocated} containers)`,
      'success'
    );
  } else if (allocated > 0) {
    notify(
      `⚠️ ${jobRecord.name}: ${allocated}/${numContainers} containers running`,
      'warning'
    );
  } else if (results.some((entry) => entry.queued)) {
    notify(`⏳ ${jobRecord.name} queued: insufficient resources`, 'warning');
  }

  results.forEach((entry, index) => {
    if (entry.allocated && entry.container) {
      const containerName = entry.container.name || requests[index].name;
      scheduleYarnCompletion(containerName, jobRecord);
    }
  });

  renderCluster();
}

sim.on('yarn:rejected', ({ request }) => {
  const job = yarnJobsByContainer.get(request.name);
  if (job) job.failed = true;
  notify(
    `❌ ${request.name} rejected: no active node can fit its CPU and memory request.`,
    'error'
  );
  renderCluster();
});

sim.on('yarn:allocated', ({ container }) => {
  const jobRecord = yarnJobsByContainer.get(container.name) || null;
  scheduleYarnCompletion(container.name, jobRecord);
  renderCluster();
});

function runMapReduce() {
  const job = sim.actions.submitMapReduce({});
  if (!job) {
    notify('⚠️ Upload an HDFS file first!', 'warning');
    return;
  }

  if (job.status === 'failed') {
    notify(`❌ ${job.name} failed: ${job.failureReason}`, 'error');
    return;
  }
  if (job.status === 'queued') {
    notify(`⏳ ${job.name} queued: insufficient resources`, 'warning');
  } else {
    notify(`✅ ${job.name} started`, 'success');
  }

  renderCluster();
}

const recoveryTimers = new Set();

function simulateFailure() {
  const activeNodes = sim.state.nodes.filter((node) => !node.failed);
  if (activeNodes.length === 0) {
    notify('❌ All nodes are already failed!', 'error');
    return;
  }

  const randomNode =
    activeNodes[Math.floor(Math.random() * activeNodes.length)];
  sim.actions.failNode(randomNode.id);
  notify(
    `💥 ${randomNode.name} failed! HDFS will re-replicate blocks...`,
    'warning'
  );

  const timerId = setTimeout(() => {
    recoveryTimers.delete(timerId);
    const summary = sim.actions.reReplicate();
    if (summary.lost > 0) {
      notify(`❌ ${summary.lost} blocks permanently lost!`, 'error');
    } else if (summary.reReplicated > 0) {
      notify(
        `✅ Re-replication complete! ${summary.reReplicated} replicas added`,
        'success'
      );
    }
    renderCluster();
  }, 2000);
  recoveryTimers.add(timerId);

  renderCluster();
}

function resetCluster() {
  clearNotifications();
  recoveryTimers.forEach((timerId) => clearTimeout(timerId));
  recoveryTimers.clear();
  yarnCompletionTimers.forEach((timerId) => clearTimeout(timerId));
  yarnCompletionTimers.clear();
  yarnJobsByContainer.clear();
  fileColors.clear();
  colorIndex = 0;

  sim.actions.reset();
  sim.state.yarnJobs = [];
  notify('🔄 Cluster reset!', 'info');
  renderCluster();
}

renderCluster();

window.simulation = sim;
window.cluster = sim.state;
window.REPLICATION_FACTOR = sim.state.config.replicationFactor;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.submitYarnJob = submitYarnJob;
window.submitBigYarnJob = submitBigYarnJob;
window.runMapReduce = runMapReduce;
window.simulateFailure = simulateFailure;
window.resetCluster = resetCluster;
window.renderCluster = renderCluster;
