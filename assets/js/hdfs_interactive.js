import { createTimerManager } from './core/timers.js';
import { createNotifier } from './core/notifications.js';
import { createColorCycle, randomInt } from './core/random.js';
import {
  allocateBlock,
  rollbackFileAllocation,
  reReplicateBlocksSimple,
  computeHdfsStats
} from './core/hdfs.js';

// HDFS Configuration
const BLOCK_SIZE = 128; // MB per block
const REPLICATION_FACTOR = 3;

// Color palette for files
const FILE_COLORS = [
  '#4299e1', // blue
  '#48bb78', // green
  '#ed8936', // orange
  '#9f7aea', // purple
  '#f56565', // red
  '#38b2ac', // teal
  '#d69e2e', // yellow
  '#e53e3e', // crimson
  '#667eea', // indigo
  '#fc8181', // pink
  '#4fd1c5', // cyan
  '#f6ad55' // light orange
];

const nextColor = createColorCycle(FILE_COLORS);
const timers = createTimerManager();
const notifier = createNotifier({ root: document.body, ttlMs: 4000 });

// Cluster state
const cluster = {
  datanodes: [],
  files: [],
  fileCounter: 1,
  blockCounter: 1
};

// Initialize cluster
function initializeCluster() {
  cluster.datanodes = [
    { id: 1, name: 'DataNode-1', storageTotal: 3000, storageUsed: 0, blocks: [], failed: false },
    { id: 2, name: 'DataNode-2', storageTotal: 3000, storageUsed: 0, blocks: [], failed: false },
    { id: 3, name: 'DataNode-3', storageTotal: 3000, storageUsed: 0, blocks: [], failed: false },
    { id: 4, name: 'DataNode-4', storageTotal: 3000, storageUsed: 0, blocks: [], failed: false }
  ];
  cluster.files = [];
  cluster.fileCounter = 1;
  cluster.blockCounter = 1;
  renderCluster();
}

// Render the cluster
function renderCluster() {
  const datanodesEl = document.getElementById('datanodes');
  datanodesEl.innerHTML = cluster.datanodes
    .map((node) => {
      const usagePercent = (node.storageUsed / node.storageTotal) * 100;
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
            <span><strong>${node.storageUsed} MB</strong> / ${node.storageTotal} MB</span>
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
                  (block) => `
                    <div class="block ${block.isReplica ? 'replica' : ''}"
                      style="background-color: ${block.color};"
                      title="${block.fileName} - Block ${block.blockNum}">
                      ${block.isReplica ? '🔄' : '📦'} ${block.id}
                    </div>
                  `
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

// Update statistics
function updateStats() {
  const stats = computeHdfsStats({
    nodes: cluster.datanodes,
    files: cluster.files,
    replicationFactor: REPLICATION_FACTOR,
    storageUnitMb: 1
  });

  document.getElementById('totalNodes').textContent = stats.totalNodes;
  document.getElementById('activeNodes').textContent = stats.activeNodes;
  document.getElementById('totalFiles').textContent = stats.totalFiles;
  document.getElementById('totalBlocks').textContent = stats.totalBlocks;
  document.getElementById('storageUsage').textContent = `${stats.storageUsagePercent.toFixed(1)}%`;
  document.getElementById('replicationFactor').textContent = stats.replicationFactor;
}

// Update files list
function updateFilesList() {
  const filesContent = document.getElementById('filesContent');

  if (cluster.files.length === 0) {
    filesContent.innerHTML =
      '<p style="color: #718096; font-style: italic;">No files uploaded yet. Click "Upload File" to start!</p>';
    return;
  }

  filesContent.innerHTML = cluster.files
    .map(
      (file) => `
        <div class="file-item">
          <div class="file-info">
            <div class="file-name">📄 ${file.name}</div>
            <div class="file-details">Size: ${file.size} MB</div>
            <div class="file-blocks-visual">
              ${file.blocks
                .map(
                  (block) => `
                    <div class="file-block-chip" style="background-color: ${file.color};">
                      📦 ${block.id}
                    </div>
                  `
                )
                .join('')}
            </div>
            <div class="file-blocks" style="margin-top: 6px;">
              ${file.blocks.length} block${file.blocks.length > 1 ? 's' : ''}
              (${file.blocks.length * REPLICATION_FACTOR} total with replicas)
            </div>
          </div>
          <div class="replica-badge">
            ${REPLICATION_FACTOR}x Replicated
          </div>
        </div>
      `
    )
    .join('');
}

// Upload a small file
function uploadFile() {
  const size = randomInt(50, 250);
  const numBlocks = Math.ceil(size / BLOCK_SIZE);

  const fileName = `file${cluster.fileCounter++}.dat`;
  const fileColor = nextColor();
  const file = {
    name: fileName,
    size,
    color: fileColor,
    blocks: []
  };

  let success = true;
  for (let i = 0; i < numBlocks; i += 1) {
    const blockId = `B${cluster.blockCounter++}`;
    const block = {
      id: blockId,
      fileName,
      blockNum: i + 1,
      size: Math.min(BLOCK_SIZE, size - i * BLOCK_SIZE),
      color: fileColor
    };

    if (!allocateBlock({
      nodes: cluster.datanodes,
      block,
      file,
      replicationFactor: REPLICATION_FACTOR,
      storageUnitMb: 1,
      notifier
    })) {
      success = false;
      notifier.error(`❌ Failed to upload ${fileName}: Not enough space!`);
      break;
    }
  }

  if (success) {
    cluster.files.push(file);
    notifier.success(
      `✅ ${fileName} uploaded successfully! (${numBlocks} block${numBlocks > 1 ? 's' : ''}, ${
        numBlocks * REPLICATION_FACTOR
      } total with replicas)`
    );
  } else {
    rollbackFileAllocation({ nodes: cluster.datanodes, fileName, storageUnitMb: 1 });
  }

  renderCluster();
}

// Upload a large file
function uploadLargeFile() {
  const size = randomInt(400, 1000);
  const numBlocks = Math.ceil(size / BLOCK_SIZE);

  const fileName = `largefile${cluster.fileCounter++}.dat`;
  const fileColor = nextColor();
  const file = {
    name: fileName,
    size,
    color: fileColor,
    blocks: []
  };

  let success = true;
  for (let i = 0; i < numBlocks; i += 1) {
    const blockId = `B${cluster.blockCounter++}`;
    const block = {
      id: blockId,
      fileName,
      blockNum: i + 1,
      size: Math.min(BLOCK_SIZE, size - i * BLOCK_SIZE),
      color: fileColor
    };

    if (!allocateBlock({
      nodes: cluster.datanodes,
      block,
      file,
      replicationFactor: REPLICATION_FACTOR,
      storageUnitMb: 1,
      notifier
    })) {
      success = false;
      notifier.error(`❌ Failed to upload ${fileName}: Not enough space!`);
      break;
    }
  }

  if (success) {
    cluster.files.push(file);
    notifier.success(
      `✅ ${fileName} uploaded! (${numBlocks} blocks, ${numBlocks * REPLICATION_FACTOR} replicas)`
    );
  } else {
    rollbackFileAllocation({ nodes: cluster.datanodes, fileName, storageUnitMb: 1 });
  }

  renderCluster();
}

// Simulate node failure
function simulateNodeFailure() {
  const activeNodes = cluster.datanodes.filter((node) => !node.failed);

  if (activeNodes.length === 0) {
    notifier.error('❌ All nodes are already failed!');
    return;
  }

  const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
  randomNode.failed = true;

  notifier.warn(`⚠️ ${randomNode.name} has failed! HDFS will re-replicate blocks...`);

  timers.timeout(() => {
    reReplicateBlocksSimple({
      failedNode: randomNode,
      nodes: cluster.datanodes,
      storageUnitMb: 1,
      notifier
    });
    renderCluster();
  }, 2000);

  renderCluster();
}

// Reset cluster
function resetCluster() {
  timers.clearAll();
  initializeCluster();
  notifier.info('🔄 Cluster reset!');
}

initializeCluster();

window.cluster = cluster;
window.REPLICATION_FACTOR = REPLICATION_FACTOR;
window.renderCluster = renderCluster;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.simulateNodeFailure = simulateNodeFailure;
window.resetCluster = resetCluster;
