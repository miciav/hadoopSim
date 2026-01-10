import { createTimerManager } from './core/timers.js';
import { createNotifier } from './core/notifications.js';
import { createColorCycle } from './core/random.js';
import {
  allocateBlock as coreAllocateBlock,
  rollbackFileAllocation as coreRollbackFileAllocation,
  reReplicateBlocksDetailed
} from './core/hdfs.js';
import { allocateContainer as coreAllocateContainer, releaseContainerByName } from './core/yarn.js';
import { runMapReduceJob, handleMapReduceNodeFailure } from './core/mapreduce.js';

// Configuration
        const BLOCK_SIZE = 256; // MB
        const REPLICATION_FACTOR = 2;
        const NUM_NODES = 6;
        
        // Colors for blocks
        const COLORS = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20'];
        let nextColor = createColorCycle(COLORS);
        
        // Cluster state
        let cluster = {
            nodes: [],
            files: [],
            yarnJobs: [],
            mapReduceJobs: [],
            fileCounter: 1,
            jobCounter: 1,
            mapReduceCounter: 1,
            blockCounter: 1,
            jobQueue: []
        };

        const timers = createTimerManager();
        const notifier = createNotifier({ root: document.body, ttlMs: 4000 });

        function scheduleClusterTimeout(callback, delay) {
            return timers.timeout(callback, delay);
        }

        function scheduleClusterInterval(callback, delay) {
            return timers.interval(callback, delay);
        }

        function clearClusterInterval(intervalId) {
            timers.clearInterval(intervalId);
        }

        function clearClusterTimers() {
            timers.clearAll();
        }
        
        // Initialize cluster
        function initializeCluster() {
            cluster.nodes = [];
            cluster.files = [];
            cluster.yarnJobs = [];
            cluster.mapReduceJobs = [];
            cluster.jobQueue = [];
            
            for (let i = 1; i <= NUM_NODES; i++) {
                cluster.nodes.push({
                    id: i,
                    name: `Node-${i}`,
                    storageTotal: 10, // GB
                    storageUsed: 0,
                    cpuTotal: 16, // cores
                    cpuUsed: 0,
                    memoryTotal: 32, // GB
                    memoryUsed: 0,
                    blocks: [],
                    containers: [],
                    failed: false
                });
            }
            
            renderCluster();
        }
        
        // Get next color
        function getNextColor() {
            return nextColor();
        }
        
        // Render entire cluster
        function renderCluster() {
            renderUnifiedNodes();
            renderFilesList();
            updateStats();
            checkDataLocality();
            renderMapReduceJobs();
        }
        
        // Render unified nodes (HDFS + YARN together)
        function renderUnifiedNodes() {
            const container = document.getElementById('hdfsNodes');
            
            const nodesHTML = cluster.nodes.map(node => {
                const storagePercent = (node.storageUsed / node.storageTotal) * 100;
                const cpuPercent = (node.cpuUsed / node.cpuTotal) * 100;
                const memPercent = (node.memoryUsed / node.memoryTotal) * 100;
                const status = node.failed ? 'failed' : (storagePercent > 80 || cpuPercent > 70 ? 'busy' : 'active');
                
                // Check if this node has data locality
                const hasDataLocality = checkNodeDataLocality(node);
                
                return `
                    <div class="node ${status} ${hasDataLocality ? 'data-locality' : ''}">
                        <div class="node-header">
                            <div class="node-name">🖥️ ${node.name}</div>
                            <div class="node-status status-${status}">
                                ${node.failed ? 'Failed' : (storagePercent > 80 || cpuPercent > 70 ? 'Busy' : 'Active')}
                            </div>
                        </div>
                        
                        <div class="node-resources">
                            <div class="resource-bar">
                                <div class="resource-label">
                                    <span>💾 Storage</span>
                                    <span>${node.storageUsed.toFixed(0)}/${node.storageTotal} GB</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill ${storagePercent > 80 ? 'danger' : ''}" 
                                         style="width: ${storagePercent}%"></div>
                                </div>
                            </div>
                            
                            <div class="resource-bar">
                                <div class="resource-label">
                                    <span>⚙️ CPU</span>
                                    <span>${node.cpuUsed.toFixed(1)}/${node.cpuTotal} cores</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill yarn ${cpuPercent > 70 ? 'warning' : ''}" 
                                         style="width: ${cpuPercent}%"></div>
                                </div>
                            </div>
                            
                            <div class="resource-bar">
                                <div class="resource-label">
                                    <span>🧠 Memory</span>
                                    <span>${node.memoryUsed.toFixed(1)}/${node.memoryTotal} GB</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill yarn ${memPercent > 70 ? 'warning' : ''}" 
                                         style="width: ${memPercent}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="blocks-section">
                            <div class="section-title">
                                📦 HDFS Blocks (${node.blocks.length})
                            </div>
                            <div class="blocks-container">
                                ${node.blocks.length > 0 ? node.blocks.map(block => `
                                    <div class="block-chip" style="background-color: ${block.color};">
                                        ${block.id}${block.isReplica ? '★' : ''}
                                    </div>
                                `).join('') : '<span style="font-size: 0.8em; color: #a0aec0;">No blocks</span>'}
                            </div>
                        </div>
                        
                        <div class="containers-section">
                            <div class="section-title">
                                🔷 YARN Containers (${node.containers.length})
                            </div>
                            ${node.containers.length > 0 ? node.containers.map(container => {
                                // Check if this is an ApplicationMaster
                                const isAM = container.isApplicationMaster;
                                
                                // Find mapper progress if this is a MapReduce container
                                let mapperProgress = null;
                                let mapperFailed = false;
                                if (container.isMapReduce && !isAM) {
                                    for (let job of cluster.mapReduceJobs) {
                                        if (job.status === 'running' || job.status === 'completed') {
                                            const mapper = job.mappers.find(m => m.name === container.name);
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
                                }
                                
                                return `
                                    <div class="container-chip ${container.isMapReduce ? 'mapreduce' : ''} ${isAM ? 'appmaster' : ''} ${mapperFailed ? 'failed' : ''}" style="position: relative; overflow: hidden;">
                                        ${mapperProgress !== null && !mapperFailed ? `
                                            <div style="position: absolute; bottom: 0; left: 0; height: 3px; width: ${mapperProgress}%; background: #22543d; transition: width 0.3s;"></div>
                                        ` : ''}
                                        ${isAM ? '👑 ' : ''}${container.name}
                                        ${mapperFailed ? ' ❌' : ''}
                                        ${mapperProgress !== null && !mapperFailed ? ` (${Math.round(mapperProgress)}%)` : ''}
                                    </div>
                                `;
                            }).join('') : '<span style="font-size: 0.8em; color: #a0aec0;">No containers</span>'}
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = nodesHTML;
        }
        
        // Check if a node has data locality
        function checkNodeDataLocality(node) {
            if (node.containers.length === 0 || node.blocks.length === 0) return false;
            
            // Check if any container is processing blocks on this node
            for (let container of node.containers) {
                if (container.isMapReduce && container.blockIds) {
                    // Check if any of the blocks this container processes are on this node
                    for (let blockId of container.blockIds) {
                        if (node.blocks.some(b => b.id === blockId)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        
        // Check data locality across cluster
        
        
        function checkDataLocality() {
            let localityCount = 0;
            let totalContainers = 0;
            
            cluster.nodes.forEach(node => {
                node.containers.forEach(container => {
                    if (container.isMapReduce) {
                        totalContainers++;
                        if (container.blockIds) {
                            for (let blockId of container.blockIds) {
                                if (node.blocks.some(b => b.id === blockId)) {
                                    localityCount++;
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
        

        // Try to schedule queued jobs when resources free up
        
        // Try to schedule queued jobs from a single unified queue
        
        // Try to schedule queued jobs from a single unified queue
        function trySchedulePendingJobs() {
            if (!cluster.jobQueue || cluster.jobQueue.length === 0) {
                updateStats();
                return;
            }
            
            let progressed = true;
            while (progressed) {
                progressed = false;
                
                for (let i = 0; i < cluster.jobQueue.length; i++) {
                    const entry = cluster.jobQueue[i];
                    let started = false;
                    
                    if (entry.type === 'simple-yarn') {
                        const cpu = Math.floor(Math.random() * 4) + 2;
                        const memory = Math.floor(Math.random() * 8) + 4;
                        const jobId = cluster.jobCounter++;
                        
                        if (allocateYarnContainer(`Job-${jobId}`, cpu, memory, false, null)) {
                            showNotification(`✅ Queued YARN job started (${cpu} CPU, ${memory} GB RAM)`, 'success');
                            started = true;
                        }
                    } else if (entry.type === 'big-yarn') {
                        const jobId = cluster.jobCounter++;
                        const numContainers = Math.floor(Math.random() * 2) + 3;
                        
                        const yarnJob = {
                            id: jobId,
                            name: `BigJob-${jobId}`,
                            numContainers: numContainers,
                            completedContainers: 0,
                            containers: [],
                            appMasterNode: null
                        };
                        
                        cluster.yarnJobs.push(yarnJob);
                        
                        const amAllocated = allocateApplicationMaster(`BigJob-${jobId}`, yarnJob);
                        if (!amAllocated) {
                            cluster.yarnJobs.pop();
                            cluster.jobCounter--; // rollback id
                        } else {
                            let allocated = 0;
                            for (let j = 0; j < numContainers; j++) {
                                const cpu = Math.floor(Math.random() * 3) + 2;
                                const memory = Math.floor(Math.random() * 6) + 4;
                                const containerName = `Job-${jobId}[${j+1}/${numContainers}]`;
                                
                                if (allocateYarnContainer(containerName, cpu, memory, false, null)) {
                                    allocated++;
                                    yarnJob.containers.push({
                                        name: containerName,
                                        cpu: cpu,
                                        memory: memory,
                                        completed: false
                                    });
                                    
                                    scheduleClusterTimeout(() => completeYarnJobContainer(jobId, containerName, cpu, memory), Math.random() * 5000 + 8000);
                                }
                            }
                            
                            if (allocated === 0) {
                                // Could not place any container: rollback
                                cluster.yarnJobs.pop();
                                cluster.jobCounter--;
                            } else {
                                showNotification(`✅ Queued Big YARN Job-${jobId} started (${allocated} containers)`, 'success');
                                started = true;
                            }
                        }
                    } else if (entry.type === 'mapreduce') {
                        const prevJobs = cluster.mapReduceJobs.length;
                        const prevCounter = cluster.mapReduceCounter;
                        runMapReduce();
                        if (cluster.mapReduceJobs.length > prevJobs) {
                            showNotification('✅ Queued MapReduce job started', 'success');
                            started = true;
                        } else {
                            // If runMapReduce couldn't start, restore counter to avoid skipping ids
                            cluster.mapReduceCounter = prevCounter;
                        }
                    }
                    
                    if (started) {
                        cluster.jobQueue.splice(i, 1);
                        progressed = true;
                        break; // restart scanning from the beginning
                    }
                }
            }
            
            updateStats();
        }


        // Render files list
        function renderFilesList() {
            const container = document.getElementById('filesList');
            
            if (cluster.files.length === 0) {
                container.innerHTML = '<p style="color: #718096; font-style: italic;">No files uploaded yet. Upload a file to start!</p>';
                document.getElementById('mapReduceBtn').disabled = true;
                return;
            }
            
            document.getElementById('mapReduceBtn').disabled = false;
            
            container.innerHTML = cluster.files.map(file => `
                <div class="file-item">
                    <div class="file-name">📄 ${file.name} - ${file.size} MB</div>
                    <div class="file-blocks-visual">
                        ${file.blocks.map(block => `
                            <div class="block-chip" style="background-color: ${block.color};">
                                ${block.id}
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 8px; font-size: 0.85em; color: #718096;">
                        ${file.blocks.length} blocks × ${REPLICATION_FACTOR} replicas = ${file.blocks.length * REPLICATION_FACTOR} total blocks
                    </div>
                </div>
            `).join('');
        }
        
        // Render MapReduce jobs
        function renderMapReduceJobs() {
            const section = document.getElementById('mapReduceSection');
            const container = document.getElementById('mapReduceJobs');
            
            const hasActiveJobs = cluster.mapReduceJobs.length > 0 || cluster.yarnJobs.length > 0;
            
            if (!hasActiveJobs) {
                section.style.display = 'none';
                return;
            }
            
            section.style.display = 'block';
            
            let html = '';
            
            // Render MapReduce jobs
            html += cluster.mapReduceJobs.map(job => {
                // Compute locality: for each mapper, check if its node actually holds the block
                let localityCount = 0;
                job.mappers.forEach(m => {
                    const node = cluster.nodes.find(n => n.id === m.nodeId);
                    if (node && node.blocks.some(b => b.id === m.blockId)) {
                        localityCount++;
                    }
                });
                const localityPercent = job.numMappers > 0 ? Math.round((localityCount / job.numMappers) * 100) : 0;
                const statusLabel = job.status === 'failed' ? 'Failed' : (job.status === 'running' ? 'Running' : 'Completed');
                
                return `
                    <div class="mapreduce-job">
                        <div class="job-header">
                            <div class="job-name">🔄 ${job.name}</div>
                            <div class="job-status status-${job.status}">
                                ${statusLabel}
                            </div>
                        </div>
                        <div style="font-size: 0.85em; color: #4a5568; margin-top: 4px;">
                            File: ${job.fileName}
                        </div>
                        <div style="font-size: 0.85em; color: #4a5568;">
                            ${job.numMappers} mappers in parallel (${localityPercent}% data locality)
                        </div>
                        <div class="job-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${job.progress}%; background: #f6ad55;"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Render YARN jobs
            html += cluster.yarnJobs.map(job => {
                const progress = (job.completedContainers / job.numContainers) * 100;
                const status = job.completedContainers === job.numContainers ? 'completed' : 'running';
                
                return `
                    <div class="mapreduce-job">
                        <div class="job-header">
                            <div class="job-name">🎯 ${job.name}</div>
                            <div class="job-status status-${status}">
                                ${status === 'running' ? 'Running' : 'Completed'}
                            </div>
                        </div>
                        <div style="font-size: 0.85em; color: #4a5568; margin-top: 4px;">
                            Distributed YARN Job
                        </div>
                        <div style="font-size: 0.85em; color: #4a5568;">
                            ${job.completedContainers}/${job.numContainers} containers completed
                        </div>
                        <div class="job-progress">
                            <div class="progress-bar">
                                <div class="progress-fill yarn" style="width: ${progress}%;"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = html;
        }
        
        // Update statistics
        function updateStats() {
            const activeNodes = cluster.nodes.filter(n => !n.failed).length;
            const totalBlocks = cluster.nodes.reduce((sum, n) => sum + n.blocks.length, 0);
            const activeJobs = cluster.nodes.reduce((sum, n) => sum + n.containers.filter(c => !c.isMapReduce).length, 0);
            const mapReduceJobs = cluster.mapReduceJobs.filter(j => j.status === 'running').length;
            
            document.getElementById('totalNodes').textContent = cluster.nodes.length;
            document.getElementById('activeNodes').textContent = activeNodes;
            document.getElementById('totalFiles').textContent = cluster.files.length;
            document.getElementById('totalBlocks').textContent = totalBlocks;
            document.getElementById('activeJobs').textContent = activeJobs;
            document.getElementById('mapReduceJobsCount').textContent = mapReduceJobs;
        
            const queuedJobsEl = document.getElementById('queuedJobs');
            if (queuedJobsEl && cluster.jobQueue) {
                queuedJobsEl.textContent = cluster.jobQueue.length;
            }
        }
        
        // Upload file
        function uploadFile() {
            const size = Math.floor(Math.random() * 200) + 100; // 100-300 MB
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
                    showNotification(`❌ Failed to upload ${fileName}: insufficient space!`, 'error');
                    break;
                }
            }
            
            if (success) {
                cluster.files.push(file);
                showNotification(`✅ ${fileName} uploaded! ${numBlocks} blocks distributed with ${REPLICATION_FACTOR}x replication`, 'success');
            } else {
                rollbackFileAllocation(fileName);
            }
            
            renderCluster();
        }
        
        // Upload large file
        function uploadLargeFile() {
            const size = Math.floor(Math.random() * 400) + 400; // 400-800 MB
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
                    showNotification(`❌ Failed to upload ${fileName}: insufficient space!`, 'error');
                    break;
                }
            }
            
            if (success) {
                cluster.files.push(file);
                showNotification(`✅ ${fileName} uploaded! ${numBlocks} blocks, ${numBlocks * REPLICATION_FACTOR} total replicas`, 'success');
            } else {
                rollbackFileAllocation(fileName);
            }
            
            renderCluster();
        }
        
        // Allocate block with replication
        function allocateBlock(block, file) {
            return coreAllocateBlock({
                nodes: cluster.nodes,
                block,
                file,
                replicationFactor: REPLICATION_FACTOR,
                storageUnitMb: 1024,
                notifier
            });
        }

        function rollbackFileAllocation(fileName) {
            coreRollbackFileAllocation({ nodes: cluster.nodes, fileName, storageUnitMb: 1024 });
        }

        
        // Submit YARN job
        function submitYarnJob() {
            const cpu = Math.floor(Math.random() * 4) + 2;
            const memory = Math.floor(Math.random() * 8) + 4;
            const jobId = cluster.jobCounter++;
            
            if (allocateYarnContainer(`Job-${jobId}`, cpu, memory, false, null)) {
                showNotification(`✅ YARN Job-${jobId} allocated (${cpu} CPU, ${memory} GB RAM)`, 'success');
            } else {
                // enqueue simple YARN job request into unified queue
                cluster.jobQueue.push({ type: 'simple-yarn' });
                showNotification(`⏳ Job-${jobId} queued (insufficient resources)`, 'warning');
            }
            
            renderCluster();
        }
        
        // Submit big YARN job
        function submitBigYarnJob() {
            const jobId = cluster.jobCounter++;
            const numContainers = Math.floor(Math.random() * 2) + 3; // 3-4 containers
            
            // Track the job
            const yarnJob = {
                id: jobId,
                name: `BigJob-${jobId}`,
                numContainers: numContainers,
                completedContainers: 0,
                containers: [],
                appMasterNode: null
            };
            
            cluster.yarnJobs.push(yarnJob);
            
            // First, allocate ApplicationMaster
            const amAllocated = allocateApplicationMaster(`BigJob-${jobId}`, yarnJob);
            
            if (!amAllocated) {
                cluster.yarnJobs.pop();
                cluster.jobQueue.push({ type: 'big-yarn' });
                showNotification(`⏳ BigJob-${jobId} queued: cannot allocate ApplicationMaster`, 'warning');
                return;
            }
            
            let allocated = 0;
            for (let i = 0; i < numContainers; i++) {
                const cpu = Math.floor(Math.random() * 3) + 2;
                const memory = Math.floor(Math.random() * 6) + 4;
                const containerName = `Job-${jobId}[${i+1}/${numContainers}]`;
                
                if (allocateYarnContainer(containerName, cpu, memory, false, null)) {
                    allocated++;
                    yarnJob.containers.push({
                        name: containerName,
                        cpu: cpu,
                        memory: memory,
                        completed: false
                    });
                    
                    // Schedule completion
                    scheduleClusterTimeout(() => completeYarnJobContainer(jobId, containerName, cpu, memory), Math.random() * 5000 + 8000);
                }
            }
            
            if (allocated === numContainers) {
                showNotification(`✅ Big YARN Job-${jobId} distributed across ${allocated} nodes!`, 'success');
            } else if (allocated > 0) {
                showNotification(`⚠️ Big Job-${jobId}: only ${allocated}/${numContainers} containers allocated`, 'warning');
            } else {
                cluster.jobQueue.push({ type: 'big-yarn' });
                showNotification(`⏳ Big Job-${jobId} queued: insufficient resources`, 'warning');
            }
            
            renderCluster();
        }
        
        // Complete a YARN job container
        function completeYarnJobContainer(jobId, containerName, cpu, memory) {
            const job = cluster.yarnJobs.find(j => j.id === jobId);
            if (!job) return;
            
            const container = job.containers.find(c => c.name === containerName);
            if (container) {
                container.completed = true;
                job.completedContainers++;
                
                // Free container resources
                releaseContainerByName(cluster.nodes, containerName);
                
                // Check if job is complete
                if (job.completedContainers === job.numContainers) {
                    // Free ApplicationMaster
                    releaseContainerByName(cluster.nodes, `AM-${job.name}`);
                    
                    showNotification(`✅ ${job.name} completed!`, 'success');
                }
                
                renderCluster();
            }
        }
        
        // Allocate ApplicationMaster
        function allocateApplicationMaster(jobName, job) {
            const container = {
                name: `AM-${jobName}`,
                cpu: 1,
                memory: 2,
                isApplicationMaster: true,
                jobName: jobName
            };

            const node = coreAllocateContainer({
                nodes: cluster.nodes.filter(n => !n.failed),
                container
            });

            if (node) {
                job.appMasterNode = node.id;
                return true;
            }

            return false;
        }
        
        // Allocate YARN container
        function allocateYarnContainer(name, cpu, memory, isMapReduce, blockIds) {
            const container = {
                name: name,
                cpu: cpu,
                memory: memory,
                isMapReduce: isMapReduce,
                blockIds: blockIds
            };

            const activeNodes = cluster.nodes.filter(n => !n.failed);

            if (isMapReduce && blockIds && blockIds.length > 0) {
                const preferredNodeIds = [];
                blockIds.forEach(blockId => {
                    activeNodes.forEach(node => {
                        if (node.blocks.some(b => b.id === blockId) && !preferredNodeIds.includes(node.id)) {
                            preferredNodeIds.push(node.id);
                        }
                    });
                });

                if (preferredNodeIds.length > 0) {
                    const node = coreAllocateContainer({
                        nodes: activeNodes,
                        container,
                        preferredNodeIds
                    });

                    if (node) {
                        scheduleClusterTimeout(() => completeContainer(node.id, name, cpu, memory), Math.random() * 5000 + 8000);
                        return true;
                    }
                }
            }

            const node = coreAllocateContainer({ nodes: activeNodes, container });
            if (node) {
                scheduleClusterTimeout(() => completeContainer(node.id, name, cpu, memory), Math.random() * 5000 + 8000);
                return true;
            }

            return false;
        }
        
        // Complete a container
        function completeContainer(nodeId, containerName, cpu, memory) {
            releaseContainerByName(cluster.nodes, containerName);
            renderCluster();
        }
        
        // Run MapReduce job
        function runMapReduce() {
            const result = runMapReduceJob({
                cluster,
                notifier,
                timers,
                allocateApplicationMaster,
                allocateContainerOnNodes: ({ nodes, container, preferredNodeIds }) => {
                    return coreAllocateContainer({
                        nodes: nodes.filter(node => !node.failed),
                        container,
                        preferredNodeIds
                    });
                },
                onUpdate: renderCluster
            });

            if (result) {
                renderCluster();
            }
        }
        
        // Simulate node failure
        function simulateFailure() {
            const activeNodes = cluster.nodes.filter(n => !n.failed);
            if (activeNodes.length === 0) {
                showNotification('❌ All nodes are already failed!', 'error');
                return;
            }

            // Pick a random active node to fail
            const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
            randomNode.failed = true;

            const affectedJobs = handleMapReduceNodeFailure({
                cluster,
                failedNode: randomNode,
                notifier,
                allocateApplicationMaster
            });

            if (affectedJobs.length === 0) {
                showNotification(`💥 ${randomNode.name} has failed! HDFS will re-replicate blocks...`, 'warning');
            }

            // Simulate re-replication after failure
            scheduleClusterTimeout(() => {
                reReplicateBlocks(randomNode);
            }, 2000);

            renderCluster();
        }

        // Re-replicate blocks
        function reReplicateBlocks(failedNode) {
            reReplicateBlocksDetailed({
                failedNode,
                nodes: cluster.nodes,
                replicationFactor: REPLICATION_FACTOR,
                storageUnitMb: 1024,
                notifier
            });

            renderCluster();
        }

        
        // Reset cluster
        function resetCluster() {
            clearClusterTimers();
            nextColor = createColorCycle(COLORS);
            cluster.fileCounter = 1;
            cluster.jobCounter = 1;
            cluster.mapReduceCounter = 1;
            cluster.blockCounter = 1;
            initializeCluster();
            showNotification('🔄 Cluster reset!', 'info');
        }
        
        // Show notification
        function showNotification(message, type) {
            notifier.raw(message, type);
        }
        
        // Initialize
        initializeCluster();

        window.cluster = cluster;
        window.REPLICATION_FACTOR = REPLICATION_FACTOR;
        window.renderCluster = renderCluster;
        window.uploadFile = uploadFile;
        window.uploadLargeFile = uploadLargeFile;
        window.submitYarnJob = submitYarnJob;
        window.submitBigYarnJob = submitBigYarnJob;
        window.runMapReduce = runMapReduce;
        window.simulateFailure = simulateFailure;
        window.resetCluster = resetCluster;
