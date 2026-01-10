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
            '#f6ad55'  // light orange
        ];
        
        let colorIndex = 0;
        
        // Get next color for a file
        function getNextColor() {
            const color = FILE_COLORS[colorIndex % FILE_COLORS.length];
            colorIndex++;
            return color;
        }
        
        // Cluster state
        const cluster = {
            datanodes: [],
            files: [],
            fileCounter: 1,
            blockCounter: 1
        };

        const clusterTimeouts = new Set();

        function scheduleClusterTimeout(callback, delay) {
            const timeoutId = setTimeout(() => {
                clusterTimeouts.delete(timeoutId);
                callback();
            }, delay);
            clusterTimeouts.add(timeoutId);
            return timeoutId;
        }

        function clearClusterTimeouts() {
            clusterTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            clusterTimeouts.clear();
        }
        
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
            colorIndex = 0;
            renderCluster();
        }
        
        // Render the cluster
        function renderCluster() {
            const datanodesEl = document.getElementById('datanodes');
            datanodesEl.innerHTML = cluster.datanodes.map(node => {
                const usagePercent = (node.storageUsed / node.storageTotal * 100).toFixed(1);
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
                            <div class="storage-fill" style="width: ${usagePercent}%">
                                ${usagePercent > 15 ? usagePercent + '%' : ''}
                            </div>
                        </div>
                        <div class="blocks-section">
                            <div class="blocks-title">Blocks (${node.blocks.length})</div>
                            <div class="blocks-container">
                                ${node.blocks.map(block => 
                                    `<div class="block ${block.isReplica ? 'replica' : ''}" 
                                          style="background-color: ${block.color};"
                                          title="${block.fileName} - Block ${block.blockNum}">
                                        ${block.isReplica ? '🔄' : '📦'} ${block.id}
                                    </div>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            updateStats();
            updateFilesList();
        }
        
        // Update statistics
        function updateStats() {
            const activeNodes = cluster.datanodes.filter(n => !n.failed).length;
            const totalBlocks = cluster.datanodes.reduce((sum, node) => sum + node.blocks.length, 0);
            const totalStorage = cluster.datanodes.reduce((sum, node) => sum + node.storageTotal, 0);
            const usedStorage = cluster.datanodes.reduce((sum, node) => sum + node.storageUsed, 0);
            
            document.getElementById('totalNodes').textContent = cluster.datanodes.length;
            document.getElementById('activeNodes').textContent = activeNodes;
            document.getElementById('totalFiles').textContent = cluster.files.length;
            document.getElementById('totalBlocks').textContent = totalBlocks;
            document.getElementById('storageUsage').textContent = ((usedStorage / totalStorage) * 100).toFixed(1) + '%';
            document.getElementById('replicationFactor').textContent = REPLICATION_FACTOR;
        }
        
        // Update files list
        function updateFilesList() {
            const filesContent = document.getElementById('filesContent');
            
            if (cluster.files.length === 0) {
                filesContent.innerHTML = '<p style="color: #718096; font-style: italic;">No files uploaded yet. Click "Upload File" to start!</p>';
                return;
            }
            
            filesContent.innerHTML = cluster.files.map(file => `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-name">📄 ${file.name}</div>
                        <div class="file-details">Size: ${file.size} MB</div>
                        <div class="file-blocks-visual">
                            ${file.blocks.map(block => `
                                <div class="file-block-chip" style="background-color: ${file.color};">
                                    📦 ${block.id}
                                </div>
                            `).join('')}
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
            `).join('');
        }
        
        // Upload a small file
        function uploadFile() {
            const size = Math.floor(Math.random() * 200) + 50; // 50-250 MB
            const numBlocks = Math.ceil(size / BLOCK_SIZE);
            
            const fileName = `file${cluster.fileCounter++}.dat`;
            const fileColor = getNextColor();
            const file = {
                name: fileName,
                size: size,
                color: fileColor,
                blocks: []
            };
            
            let success = true;
            for (let i = 0; i < numBlocks; i++) {
                const blockId = `B${cluster.blockCounter++}`;
                const block = {
                    id: blockId,
                    fileName: fileName,
                    blockNum: i + 1,
                    size: Math.min(BLOCK_SIZE, size - (i * BLOCK_SIZE)),
                    color: fileColor
                };
                
                if (!allocateBlock(block, file)) {
                    success = false;
                    showNotification(`❌ Failed to upload ${fileName}: Not enough space!`, 'error');
                    break;
                }
            }
            
            if (success) {
                cluster.files.push(file);
                showNotification(`✅ ${fileName} uploaded successfully! (${numBlocks} block${numBlocks > 1 ? 's' : ''}, ${numBlocks * REPLICATION_FACTOR} total with replicas)`, 'success');
            } else {
                rollbackFileAllocation(fileName);
            }
            
            renderCluster();
        }
        
        // Upload a large file
        function uploadLargeFile() {
            const size = Math.floor(Math.random() * 600) + 400; // 400-1000 MB
            const numBlocks = Math.ceil(size / BLOCK_SIZE);
            
            const fileName = `largefile${cluster.fileCounter++}.dat`;
            const fileColor = getNextColor();
            const file = {
                name: fileName,
                size: size,
                color: fileColor,
                blocks: []
            };
            
            let success = true;
            for (let i = 0; i < numBlocks; i++) {
                const blockId = `B${cluster.blockCounter++}`;
                const block = {
                    id: blockId,
                    fileName: fileName,
                    blockNum: i + 1,
                    size: Math.min(BLOCK_SIZE, size - (i * BLOCK_SIZE)),
                    color: fileColor
                };
                
                if (!allocateBlock(block, file)) {
                    success = false;
                    showNotification(`❌ Failed to upload ${fileName}: Not enough space!`, 'error');
                    break;
                }
            }
            
            if (success) {
                cluster.files.push(file);
                showNotification(`✅ ${fileName} uploaded! (${numBlocks} blocks, ${numBlocks * REPLICATION_FACTOR} replicas)`, 'success');
            } else {
                rollbackFileAllocation(fileName);
            }
            
            renderCluster();
        }
        
        // Allocate a block with replication
        function allocateBlock(block, file) {
            const activeNodes = cluster.datanodes.filter(n => !n.failed);
            
            if (activeNodes.length < REPLICATION_FACTOR) {
                showNotification(`⚠️ Warning: Not enough active nodes for ${REPLICATION_FACTOR}x replication!`, 'warning');
            }
            
            // Sort nodes by available space (descending)
            const sortedNodes = [...activeNodes].sort((a, b) => 
                (b.storageTotal - b.storageUsed) - (a.storageTotal - a.storageUsed)
            );
            
            let replicasCreated = 0;
            const selectedNodes = [];
            
            // Try to create replicas
            for (let i = 0; i < sortedNodes.length && replicasCreated < REPLICATION_FACTOR; i++) {
                const node = sortedNodes[i];
                const availableSpace = node.storageTotal - node.storageUsed;
                
                if (availableSpace >= block.size) {
                    const isReplica = replicasCreated > 0;
                    node.storageUsed += block.size;
                    node.blocks.push({
                        ...block,
                        isReplica: isReplica // First copy is primary, others are replicas
                    });
                    selectedNodes.push(node.name);
                    replicasCreated++;
                    
                    if (!isReplica) {
                        file.blocks.push(block);
                    }
                }
            }
            
            if (replicasCreated === 0) {
                return false; // Failed to allocate
            }
            
            if (replicasCreated < REPLICATION_FACTOR) {
                showNotification(`⚠️ Block ${block.id}: Only ${replicasCreated}/${REPLICATION_FACTOR} replicas created`, 'warning');
            }
            
            return true;
        }

        function rollbackFileAllocation(fileName) {
            cluster.datanodes.forEach(node => {
                let freedStorage = 0;
                node.blocks = node.blocks.filter(block => {
                    if (block.fileName === fileName) {
                        freedStorage += block.size;
                        return false;
                    }
                    return true;
                });
                if (freedStorage > 0) {
                    node.storageUsed = Math.max(0, node.storageUsed - freedStorage);
                }
            });
        }
        
        // Simulate node failure
        function simulateNodeFailure() {
            const activeNodes = cluster.datanodes.filter(n => !n.failed);
            
            if (activeNodes.length === 0) {
                showNotification('❌ All nodes are already failed!', 'error');
                return;
            }
            
            // Pick a random active node
            const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
            randomNode.failed = true;
            
            showNotification(`⚠️ ${randomNode.name} has failed! HDFS will re-replicate blocks...`, 'warning');
            
            // Simulate re-replication after a delay
            scheduleClusterTimeout(() => {
                reReplicateBlocks(randomNode);
            }, 2000);
            
            renderCluster();
        }
        
        // Re-replicate blocks from failed node
        function reReplicateBlocks(failedNode) {
            const blocksToReReplicate = [...failedNode.blocks];
            const activeNodes = cluster.datanodes.filter(n => !n.failed && n.id !== failedNode.id);
            
            if (activeNodes.length === 0) {
                showNotification('❌ No active nodes available for re-replication!', 'error');
                return;
            }
            
            let reReplicatedCount = 0;
            
            for (const block of blocksToReReplicate) {
                // Find node with most available space
                const targetNode = activeNodes.reduce((best, node) => {
                    const bestSpace = best.storageTotal - best.storageUsed;
                    const nodeSpace = node.storageTotal - node.storageUsed;
                    return nodeSpace > bestSpace ? node : best;
                });
                
                const availableSpace = targetNode.storageTotal - targetNode.storageUsed;
                
                if (availableSpace >= block.size) {
                    targetNode.storageUsed += block.size;
                    targetNode.blocks.push({...block});
                    reReplicatedCount++;
                }
            }
            
            showNotification(`✅ Re-replication complete! ${reReplicatedCount}/${blocksToReReplicate.length} blocks recovered on other nodes`, 'success');
            renderCluster();
        }
        
        // Reset cluster
        function resetCluster() {
            clearClusterTimeouts();
            initializeCluster();
            showNotification('🔄 Cluster reset!', 'info');
        }
        
        // Show notification
        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            notification.setAttribute('role', 'status');
            notification.setAttribute('aria-live', 'polite');
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }
        
        // Initialize
        initializeCluster();
