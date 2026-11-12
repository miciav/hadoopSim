import { createHdfsRecovery } from './hadoop-sim/failure-recovery.js';
import { CLUSTER_SCENARIOS } from './hadoop-sim/scenarios.js';
import { createNotifier } from './hadoop-sim/notifications.js';
import { createSimulation } from './hadoop-sim/simulation.js';
import { describeMapReduceFailure } from './hadoop-sim/mapreduce.js';
import { createYarnAutoCompletion } from './hadoop-sim/yarn-lifecycle.js';
import { randomInt } from './hadoop-sim/random.js';

const COLORS = Array.from(
  { length: 8 },
  (_, index) => `var(--sim-file-${index})`
);
let colorIndex = 0;
const fileColors = new Map();

const requestedScenario = new URLSearchParams(location.search).get('scenario');
const scenario = Object.hasOwn(CLUSTER_SCENARIOS, requestedScenario)
  ? requestedScenario
  : 'compact';
const sim = createSimulation(CLUSTER_SCENARIOS[scenario]);
const scenarioSelect = document.getElementById('clusterScenario');
scenarioSelect.value = scenario;
scenarioSelect.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('scenario', scenarioSelect.value);
  location.assign(url.href);
});
document.getElementById('scenarioSummary').textContent =
  `6 nodes · ${sim.state.config.blockSizeMb} MB blocks · ${sim.state.config.replicationFactor} replicas · ${CLUSTER_SCENARIOS[scenario].nodeTemplate.storageTotalMb / 1024} GB per node`;
document.getElementById('nodeCapacity').textContent =
  `${CLUSTER_SCENARIOS[scenario].nodeTemplate.storageTotalMb / 1024} GB`;
document.getElementById('hdfsBlockSize').textContent =
  `${sim.state.config.blockSizeMb} MB`;

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

createYarnAutoCompletion(sim, {
  durationMs: () => randomInt(8000, 13000),
  onComplete(container) {
    const job = yarnJobsByContainer.get(container.name);
    if (job) {
      job.completedContainers++;
      if (!job.failed && job.completedContainers === job.numContainers) {
        notify(`${job.name} completed!`, 'success');
      }
    }
    renderCluster();
  },
  onFailed(container) {
    const job = yarnJobsByContainer.get(container.name);
    if (job) job.failed = true;
    notify(`${container.name} lost with its node`, 'error');
  }
});

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
                    ${block.id}${block.isReplica ? '' : ''}
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
                    <div class="container-kind"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3m6-3v3m-6 14v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/></svg>${isAM ? 'ApplicationMaster' : container.isMapReduce ? 'Map task' : 'YARN task'}</div>
                    <div class="container-name">${container.name}</div>
                    <div class="container-resources">${container.cpu} ${container.cpu === 1 ? 'core' : 'cores'} · ${(container.memoryMb / 1024).toFixed(0)} GB RAM</div>
                    ${mapperFailed ? ' ' : ''}
                    ${
                      mapperProgress !== null && !mapperFailed
                        ? ` (${Math.round(mapperProgress)}%)`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')
          : '<span class="empty-note">No active containers</span>';

      return `
        <div class="node ${status} ${hasDataLocality ? 'data-locality' : ''}">
          <div class="node-header">
            <div class="node-name"> ${node.name}</div>
            <div class="node-status status-${status}">
              ${node.failed ? 'Failed' : storagePercent > 80 || cpuPercent > 70 ? 'Busy' : 'Active'}
            </div>
          </div>

          <div class="node-resources">
            <div class="resource-bar">
              <div class="resource-label">
                <span> Storage</span>
                <span>${(node.storageUsedMb / 1024).toFixed(1)}/${(node.storageTotalMb / 1024).toFixed(0)} GB</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill storage-fill ${storagePercent > 80 ? 'danger' : ''}" style="width: ${storagePercent}%"></div>
              </div>
            </div>

            <div class="resource-bar">
              <div class="resource-label">
                <span> CPU</span>
                <span>${node.cpuUsed.toFixed(1)}/${node.cpuTotal} cores</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill cpu-fill ${cpuPercent > 70 ? 'warning' : ''}" style="width: ${cpuPercent}%"></div>
              </div>
            </div>

            <div class="resource-bar">
              <div class="resource-label">
                <span> Memory</span>
                <span>${(node.memoryUsedMb / 1024).toFixed(1)}/${(node.memoryTotalMb / 1024).toFixed(0)} GB</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill memory-fill ${memPercent > 70 ? 'warning' : ''}" style="width: ${memPercent}%"></div>
              </div>
            </div>
          </div>

          <div class="blocks-section">
            <div class="section-title"> HDFS Blocks (${node.blocks.length})</div>
            <div class="blocks-container">${blocksHTML}</div>
          </div>

          <div class="containers-section">
            <div class="section-title"> YARN Containers (${node.containers.length})</div>
            <div class="container-list">${containersHTML}</div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = nodesHTML;
}

function isLocalMapper(node, container) {
  return (
    container.isMapReduce &&
    !container.isApplicationMaster &&
    container.blockIds.some((id) =>
      node.blocks.some((block) => block.id === id)
    )
  );
}
function checkNodeDataLocality(node) {
  return node.containers.some((container) => isLocalMapper(node, container));
}

function checkDataLocality() {
  let localityCount = 0;
  let totalContainers = 0;

  sim.state.nodes.forEach((node) => {
    node.containers.forEach((container) => {
      if (container.isMapReduce && !container.isApplicationMaster) {
        totalContainers++;
        if (isLocalMapper(node, container)) localityCount++;
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
  const fileSelect = document.getElementById('mapReduceFile');
  if (fileSelect.options.length !== sim.state.files.length) {
    const selected = fileSelect.value;
    fileSelect.replaceChildren(
      ...sim.state.files.map((file) => new Option(file.name, file.name))
    );
    if (sim.state.files.some((file) => file.name === selected))
      fileSelect.value = selected;
  }
  fileSelect.disabled = sim.state.files.length === 0;
  document.getElementById('mapReduceHint').hidden = sim.state.files.length > 0;

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
          <div class="file-name"> ${file.name} - ${file.sizeMb} MB</div>
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
            ${file.blocks.length} block${file.blocks.length === 1 ? '' : 's'} × ${sim.state.config.replicationFactor} replicas = ${
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
            <div class="job-name"> ${job.name}</div>
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
            <div class="job-name"> ${job.name}</div>
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
  const activeJobs = sim.yarn.stats().activeContainers;
  const mapReduceJobs = sim.mapreduce.stats().runningJobs;

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

function uploadFile(
  size = Number(document.getElementById('uploadSizeMb').value)
) {
  if (!Number.isInteger(size) || size <= 0) {
    notify('Enter a positive whole number of MB.', 'warning');
    return;
  }
  const result = sim.actions.uploadFile(size);

  if (!result.ok) {
    notify(` Failed to upload ${size} MB: insufficient space!`, 'error');
    return;
  }

  ensureFileColor(result.file.name);

  if (result.results.some((entry) => entry.underReplicated)) {
    notify(
      ` ${result.file.name} uploaded with under-replicated blocks`,
      'warning'
    );
  } else {
    notify(` ${result.file.name} uploaded!`, 'success');
  }

  renderCluster();
}

function uploadLargeFile() {
  uploadFile(1024);
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
    notify(` ${name} allocated (${cpu} CPU, ${memoryGb} GB RAM)`, 'success');
  } else if (result.queued) {
    notify(`⏳ ${name} queued (insufficient resources)`, 'warning');
  } else if (!result.reason) {
    notify(` ${name} rejected (queue full)`, 'error');
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
      ` Big YARN ${jobRecord.name} started (${allocated} containers)`,
      'success'
    );
  } else if (allocated > 0) {
    notify(
      ` ${jobRecord.name}: ${allocated}/${numContainers} containers running`,
      'warning'
    );
  } else if (results.some((entry) => entry.queued)) {
    notify(`⏳ ${jobRecord.name} queued: insufficient resources`, 'warning');
  }

  renderCluster();
}

sim.on('yarn:rejected', ({ request }) => {
  const job = yarnJobsByContainer.get(request.name);
  if (job) job.failed = true;
  notify(
    ` ${request.name} rejected: no active node can fit its CPU and memory request.`,
    'error'
  );
  renderCluster();
});

sim.on('yarn:allocated', () => {
  renderCluster();
});

function runMapReduce() {
  const job = sim.actions.submitMapReduce({
    fileName: document.getElementById('mapReduceFile').value
  });
  if (!job) {
    notify(' Upload an HDFS file first!', 'warning');
    return;
  }

  if (job.status === 'failed') {
    notify(` ${job.name} failed: ${job.failureReason}`, 'error');
    return;
  }
  if (job.status === 'queued') {
    notify(`⏳ ${job.name} queued: insufficient resources`, 'warning');
  } else {
    notify(` ${job.name} started`, 'success');
  }

  renderCluster();
}

createHdfsRecovery(sim, {
  delayMs: 2000,
  onRecovered(summary) {
    if (summary.lost > 0) notify(`${summary.lost} blocks lost.`, 'error');
    else if (summary.reReplicated > 0)
      notify(`Re-replicated ${summary.reReplicated} replicas.`, 'success');
    renderCluster();
  }
});

function simulateFailure() {
  const activeNodes = sim.state.nodes.filter((node) => !node.failed);
  if (activeNodes.length === 0) {
    notify(' All nodes are already failed!', 'error');
    return;
  }

  const randomNode =
    activeNodes[Math.floor(Math.random() * activeNodes.length)];
  sim.actions.failNode(randomNode.id);
  notify(
    ` ${randomNode.name} failed! HDFS will re-replicate blocks...`,
    'warning'
  );

  renderCluster();
}

function resetCluster() {
  clearNotifications();
  yarnJobsByContainer.clear();
  fileColors.clear();
  colorIndex = 0;

  sim.actions.reset();
  sim.state.yarnJobs = [];
  notify(' Cluster reset!', 'info');
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
