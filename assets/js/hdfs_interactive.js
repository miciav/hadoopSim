import { createSimulation } from './hadoop-sim/simulation.js';
import { randomInt } from './hadoop-sim/random.js';

const sim = createSimulation({
  nodeCount: 4,
  replicationFactor: 3,
  blockSizeMb: 128,
  nodeTemplate: {
    cpuTotal: 4,
    memoryTotalMb: 8192,
    storageTotalMb: 3000,
    namePrefix: 'DataNode-'
  }
});

const FILE_COLORS = [
  '#4299e1',
  '#48bb78',
  '#ed8936',
  '#9f7aea',
  '#f56565',
  '#38b2ac',
  '#d69e2e',
  '#667eea'
];
let colorIndex = 0;
const fileColors = new Map();

function nextColor() {
  const color = FILE_COLORS[colorIndex % FILE_COLORS.length];
  colorIndex += 1;
  return color;
}

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
  }, 3500);
}

function renderCluster() {
  const datanodesEl = document.getElementById('datanodes');
  datanodesEl.innerHTML = sim.state.nodes
    .map((node) => {
      const usagePercent = (node.storageUsedMb / node.storageTotalMb) * 100;
      let statusClass = 'active';
      let statusBadge = 'healthy';

      if (node.failed) {
        statusClass = 'failed';
        statusBadge = 'failed';
      } else if (usagePercent >= 90) {
        statusClass = 'full';
      } else if (usagePercent >= 60) {
        statusClass = 'busy';
      }

      return `
        <div class="datanode ${statusClass}">
          <div class="node-header">
            <div class="node-name">${node.name}</div>
            <div class="node-status-badge ${statusBadge}">
              ${node.failed ? '❌ FAILED' : '✅ HEALTHY'}
            </div>
          </div>
          <div class="storage-info">
            <span>Storage</span>
            <span><strong>${node.storageUsedMb} MB</strong> / ${node.storageTotalMb} MB</span>
          </div>
          <div class="storage-bar">
            <div class="storage-fill" style="width: ${usagePercent.toFixed(1)}%">
              ${usagePercent > 15 ? `${usagePercent.toFixed(1)}%` : ''}
            </div>
          </div>
          <div class="blocks-section">
            <div class="blocks-title">Blocks (${node.blocks.length})</div>
            <div class="blocks-container">
              ${node.blocks
                .map(
                  (block) => {
                    const color = fileColors.get(block.fileName) || '#a0aec0';
                    return `
                    <div class="block ${block.isReplica ? 'replica' : ''}"
                      style="background-color: ${color};"
                      title="${block.fileName} - Block ${block.index + 1}">
                      ${block.isReplica ? '🔄' : '📦'} ${block.id}
                    </div>
                  `;
                  }
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  updateStats();
  updateFilesList();
}

function updateStats() {
  const stats = sim.hdfs.stats();
  document.getElementById('totalNodes').textContent = stats.totalNodes;
  document.getElementById('activeNodes').textContent = stats.activeNodes;
  document.getElementById('totalFiles').textContent = stats.totalFiles;
  document.getElementById('totalBlocks').textContent = stats.totalBlocks;
  document.getElementById('storageUsage').textContent = `${stats.storageUsagePercent.toFixed(1)}%`;
  document.getElementById('replicationFactor').textContent = stats.replicationFactor;
}

function updateFilesList() {
  const filesContent = document.getElementById('filesContent');

  if (sim.state.files.length === 0) {
    filesContent.innerHTML =
      '<p style="color: #718096; font-style: italic;">No files uploaded yet. Click "Upload File" to start!</p>';
    return;
  }

  filesContent.innerHTML = sim.state.files
    .map(
      (file) => `
        <div class="file-item">
          <div class="file-info">
            <div class="file-name">📄 ${file.name}</div>
            <div class="file-details">Size: ${file.sizeMb} MB</div>
            <div class="file-blocks-visual">
              ${file.blocks
                .map(
                  (block) => `
                    <div class="file-block-chip" style="background-color: ${fileColors.get(file.name) || '#a0aec0'};">
                      📦 ${block.id}
                    </div>
                  `
                )
                .join('')}
            </div>
            <div class="file-blocks" style="margin-top: 6px;">
              ${file.blocks.length} block${file.blocks.length > 1 ? 's' : ''}
              (${file.blocks.length * sim.state.config.replicationFactor} total with replicas)
            </div>
          </div>
          <div class="replica-badge">
            ${sim.state.config.replicationFactor}x Replicated
          </div>
        </div>
      `
    )
    .join('');
}

function uploadFile() {
  const size = randomInt(50, 250);
  const result = sim.actions.uploadFile(size);

  if (!result.ok) {
    notify(`❌ Failed to upload file (${size} MB). Not enough space.`, 'error');
  } else if (result.results.some((entry) => entry.underReplicated)) {
    fileColors.set(result.file.name, nextColor());
    notify(`⚠️ Uploaded ${result.file.name} with under-replicated blocks`, 'warning');
  } else {
    fileColors.set(result.file.name, nextColor());
    notify(`✅ ${result.file.name} uploaded (${size} MB).`, 'success');
  }

  renderCluster();
}

function uploadLargeFile() {
  const size = randomInt(400, 1000);
  const result = sim.actions.uploadFile(size);

  if (!result.ok) {
    notify(`❌ Failed to upload file (${size} MB). Not enough space.`, 'error');
  } else if (result.results.some((entry) => entry.underReplicated)) {
    fileColors.set(result.file.name, nextColor());
    notify(`⚠️ Uploaded ${result.file.name} with under-replicated blocks`, 'warning');
  } else {
    fileColors.set(result.file.name, nextColor());
    notify(`✅ ${result.file.name} uploaded (${size} MB).`, 'success');
  }

  renderCluster();
}

function simulateNodeFailure() {
  const activeNodes = sim.state.nodes.filter((node) => !node.failed);
  if (activeNodes.length === 0) {
    notify('❌ All nodes are already failed!', 'error');
    return;
  }

  const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
  sim.actions.failNode(randomNode.id);
  notify(`⚠️ ${randomNode.name} failed. Re-replicating...`, 'warning');

  setTimeout(() => {
    const summary = sim.actions.reReplicate();
    if (summary.lost > 0) {
      notify(`❌ ${summary.lost} blocks lost.`, 'error');
    } else if (summary.reReplicated > 0) {
      notify(`✅ Re-replicated ${summary.reReplicated} replicas.`, 'success');
    }
    renderCluster();
  }, 1500);

  renderCluster();
}

function resetCluster() {
  sim.actions.reset();
  fileColors.clear();
  colorIndex = 0;
  notify('🔄 Cluster reset!', 'info');
  renderCluster();
}

renderCluster();

window.simulation = sim;
window.cluster = sim.state;
window.REPLICATION_FACTOR = sim.state.config.replicationFactor;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.simulateNodeFailure = simulateNodeFailure;
window.resetCluster = resetCluster;
window.renderCluster = renderCluster;
