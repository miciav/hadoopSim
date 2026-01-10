// Configuration
        const BLOCK_SIZE = 256; // MB
        const REPLICATION_FACTOR = 2;
        const NUM_NODES = 6;
        
        // Colors for blocks
        const COLORS = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20'];
        let colorIndex = 0;
        
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

        const clusterTimeouts = new Set();
        const clusterIntervals = new Set();

        function scheduleClusterTimeout(callback, delay) {
            const timeoutId = setTimeout(() => {
                clusterTimeouts.delete(timeoutId);
                callback();
            }, delay);
            clusterTimeouts.add(timeoutId);
            return timeoutId;
        }

        function scheduleClusterInterval(callback, delay) {
            const intervalId = setInterval(callback, delay);
            clusterIntervals.add(intervalId);
            return intervalId;
        }

        function clearClusterInterval(intervalId) {
            clearInterval(intervalId);
            clusterIntervals.delete(intervalId);
        }

        function clearClusterTimers() {
            clusterTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            clusterTimeouts.clear();
            clusterIntervals.forEach(intervalId => clearInterval(intervalId));
            clusterIntervals.clear();
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
            const color = COLORS[colorIndex % COLORS.length];
            colorIndex++;
            return color;
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
            const activeNodes = cluster.nodes.filter(n => !n.failed);

            if (activeNodes.length < REPLICATION_FACTOR) {
                showNotification(`⚠️ Warning: insufficient nodes for ${REPLICATION_FACTOR}x replication!`, 'warning');
            }

            // block.size è in MB → convertiamo in GB per lo storage dei nodi
            const blockSizeGB = block.size / 1024;

            const sortedNodes = [...activeNodes].sort((a, b) => 
                (b.storageTotal - b.storageUsed) - (a.storageTotal - a.storageUsed)
            );

            let replicasCreated = 0;

            for (let i = 0; i < sortedNodes.length && replicasCreated < REPLICATION_FACTOR; i++) {
                const node = sortedNodes[i];
                const availableSpaceGB = node.storageTotal - node.storageUsed;

                if (availableSpaceGB >= blockSizeGB) {
                    const isReplica = replicasCreated > 0;
                    node.storageUsed += blockSizeGB;
                    node.blocks.push({
                        ...block,
                        isReplica: isReplica
                    });
                    replicasCreated++;

                    if (!isReplica) {
                        // salviamo il blocco logico nel file (dimensione resta in MB, solo per visualizzazione)
                        file.blocks.push(block);
                    }
                }
            }

            return replicasCreated > 0;
        }

        function rollbackFileAllocation(fileName) {
            cluster.nodes.forEach(node => {
                let freedStorageMb = 0;
                node.blocks = node.blocks.filter(block => {
                    if (block.fileName === fileName) {
                        freedStorageMb += block.size;
                        return false;
                    }
                    return true;
                });
                if (freedStorageMb > 0) {
                    node.storageUsed = Math.max(0, node.storageUsed - freedStorageMb / 1024);
                }
            });
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
                cluster.nodes.forEach(node => {
                    const containerIndex = node.containers.findIndex(c => c.name === containerName);
                    if (containerIndex !== -1) {
                        node.cpuUsed -= cpu;
                        node.memoryUsed -= memory;
                        node.containers.splice(containerIndex, 1);
                    }
                });
                
                // Check if job is complete
                if (job.completedContainers === job.numContainers) {
                    // Free ApplicationMaster
                    cluster.nodes.forEach(node => {
                        const amIndex = node.containers.findIndex(c => c.isApplicationMaster && c.jobName === job.name);
                        if (amIndex !== -1) {
                            const am = node.containers[amIndex];
                            node.cpuUsed -= am.cpu;
                            node.memoryUsed -= am.memory;
                            node.containers.splice(amIndex, 1);
                        }
                    });
                    
                    showNotification(`✅ ${job.name} completed!`, 'success');
                }
                
                renderCluster();
            }
        }
        
        // Allocate ApplicationMaster
        function allocateApplicationMaster(jobName, job) {
            const cpu = 1;
            const memory = 2;
            const amName = `AM-${jobName}`;
            
            const activeNodes = cluster.nodes.filter(n => !n.failed);
            
            // Try to allocate on a node with available resources
            for (let node of activeNodes) {
                const cpuAvailable = node.cpuTotal - node.cpuUsed;
                const memAvailable = node.memoryTotal - node.memoryUsed;
                
                if (cpuAvailable >= cpu && memAvailable >= memory) {
                    node.cpuUsed += cpu;
                    node.memoryUsed += memory;
                    node.containers.push({
                        name: amName,
                        cpu: cpu,
                        memory: memory,
                        isApplicationMaster: true,
                        jobName: jobName
                    });
                    
                    job.appMasterNode = node.id;
                    return true;
                }
            }
            
            return false;
        }
        
        // Allocate YARN container
        function allocateYarnContainer(name, cpu, memory, isMapReduce, blockIds) {
            const activeNodes = cluster.nodes.filter(n => !n.failed);
            
            // If MapReduce and blockIds provided, try data locality first
            if (isMapReduce && blockIds && blockIds.length > 0) {
                // Try to find a node that has one of the blocks
                for (let blockId of blockIds) {
                    for (let node of activeNodes) {
                        if (node.blocks.some(b => b.id === blockId)) {
                            const cpuAvailable = node.cpuTotal - node.cpuUsed;
                            const memAvailable = node.memoryTotal - node.memoryUsed;
                            
                            if (cpuAvailable >= cpu && memAvailable >= memory) {
                                node.cpuUsed += cpu;
                                node.memoryUsed += memory;
                                node.containers.push({
                                    name: name,
                                    cpu: cpu,
                                    memory: memory,
                                    isMapReduce: isMapReduce,
                                    blockIds: blockIds
                                });
                                
                                // Auto-complete after timeout
                                scheduleClusterTimeout(() => completeContainer(node.id, name, cpu, memory), Math.random() * 5000 + 8000);
                                return true;
                            }
                        }
                    }
                }
            }
            
            // Fallback: random allocation
            const shuffledNodes = [...activeNodes].sort(() => Math.random() - 0.5);
            
            for (let node of shuffledNodes) {
                const cpuAvailable = node.cpuTotal - node.cpuUsed;
                const memAvailable = node.memoryTotal - node.memoryUsed;
                
                if (cpuAvailable >= cpu && memAvailable >= memory) {
                    node.cpuUsed += cpu;
                    node.memoryUsed += memory;
                    node.containers.push({
                        name: name,
                        cpu: cpu,
                        memory: memory,
                        isMapReduce: isMapReduce,
                        blockIds: blockIds
                    });
                    
                    // Auto-complete after timeout
                    scheduleClusterTimeout(() => completeContainer(node.id, name, cpu, memory), Math.random() * 5000 + 8000);
                    return true;
                }
            }
            
            return false;
        }

        function releaseMapReduceResources(job) {
            const mapperNames = new Set(job.mappers.map(mapper => mapper.name));

            cluster.nodes.forEach(node => {
                let freedCpu = 0;
                let freedMemory = 0;
                node.containers = node.containers.filter(container => {
                    const isMapper = mapperNames.has(container.name);
                    const isAppMaster = container.isApplicationMaster && container.jobName === job.name;
                    if (isMapper || isAppMaster) {
                        freedCpu += container.cpu || 0;
                        freedMemory += container.memory || 0;
                        return false;
                    }
                    return true;
                });
                if (freedCpu || freedMemory) {
                    node.cpuUsed = Math.max(0, node.cpuUsed - freedCpu);
                    node.memoryUsed = Math.max(0, node.memoryUsed - freedMemory);
                }
            });
        }
        
        // Complete a container
        function completeContainer(nodeId, containerName, cpu, memory) {
            const node = cluster.nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            const containerIndex = node.containers.findIndex(c => c.name === containerName);
            if (containerIndex !== -1) {
                node.cpuUsed -= cpu;
                node.memoryUsed -= memory;
                node.containers.splice(containerIndex, 1);
                renderCluster();
            }
        }
        
        // Run MapReduce job
        function runMapReduce() {
            if (cluster.files.length === 0) {
                showNotification('⚠️ Upload an HDFS file first!', 'warning');
                return;
            }
            
            // Pick a random file
            const file = cluster.files[Math.floor(Math.random() * cluster.files.length)];
            const jobName = `MapReduce-${cluster.mapReduceCounter++}`;
            
            // Build a map of which nodes have which blocks
            const blockLocations = {}; // blockId -> [nodeIds that have it]
            cluster.nodes.forEach(node => {
                if (!node.failed) {
                    node.blocks.forEach(block => {
                        if (block.fileName === file.name) {
                            if (!blockLocations[block.id]) {
                                blockLocations[block.id] = [];
                            }
                            blockLocations[block.id].push(node.id);
                        }
                    });
                }
            });
            
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
            
            // First, allocate ApplicationMaster
            const amAllocated = allocateApplicationMaster(jobName, job);
            
            if (!amAllocated) {
                cluster.mapReduceJobs.pop();
                cluster.jobQueue.push({ type: 'mapreduce' });
                showNotification(`⏳ ${jobName} queued: cannot allocate ApplicationMaster`, 'warning');
                return;
            }
            
            // Track how many mappers are allocated per node for load balancing
            const nodeMapperCount = {};
            cluster.nodes.forEach(node => {
                nodeMapperCount[node.id] = node.containers.filter(c => c.isMapReduce).length;
            });
            
            // Allocate ONE mapper per logical block, choosing the best replica
            let allocatedMappers = 0;
            let dataLocalityCount = 0;
            
            file.blocks.forEach((block, index) => {
                const cpu = 2;
                const memory = 4;
                const mapperName = `${jobName}-M${index+1}`;
                
                // Get all nodes that have this block
                const nodesWithBlock = blockLocations[block.id] || [];
                
                if (nodesWithBlock.length === 0) {
                    // Block is completely lost: mark job as failed and free its ApplicationMaster
                    job.status = 'failed';
                    showNotification(`❌ ${jobName} cannot start: block ${block.id} not found on any node!`, 'error');

                    releaseMapReduceResources(job);
                    renderCluster();
                    return;
                }
                
                // Sort candidate nodes by:
                // 1. Number of mappers already allocated (ascending - prefer nodes with fewer mappers)
                // 2. Available resources
                const candidateNodes = nodesWithBlock
                    .map(nodeId => cluster.nodes.find(n => n.id === nodeId))
                    .filter(node => node && !node.failed)
                    .sort((a, b) => {
                        // First priority: balance mapper count
                        const aMappers = nodeMapperCount[a.id];
                        const bMappers = nodeMapperCount[b.id];
                        if (aMappers !== bMappers) return aMappers - bMappers;
                        
                        // Second priority: available CPU
                        const aCpuAvail = a.cpuTotal - a.cpuUsed;
                        const bCpuAvail = b.cpuTotal - b.cpuUsed;
                        return bCpuAvail - aCpuAvail;
                    });
                
                // Try to allocate on the best candidate node (with data locality)
                let allocated = false;
                for (let targetNode of candidateNodes) {
                    const cpuAvailable = targetNode.cpuTotal - targetNode.cpuUsed;
                    const memAvailable = targetNode.memoryTotal - targetNode.memoryUsed;
                    
                    if (cpuAvailable >= cpu && memAvailable >= memory) {
                        targetNode.cpuUsed += cpu;
                        targetNode.memoryUsed += memory;
                        targetNode.containers.push({
                            name: mapperName,
                            cpu: cpu,
                            memory: memory,
                            isMapReduce: true,
                            blockIds: [block.id]
                        });
                        
                        nodeMapperCount[targetNode.id]++;
                        allocatedMappers++;
                        dataLocalityCount++;
                        
                        job.mappers.push({
                            name: mapperName,
                            blockId: block.id,
                            nodeId: targetNode.id,
                            progress: 0
                        });
                        
                        allocated = true;
                        break;
                    }
                }
                
                // Fallback: allocate on any available node (without data locality)
                if (!allocated) {
                    const activeNodes = cluster.nodes
                        .filter(n => !n.failed)
                        .sort((a, b) => {
                            const aMappers = nodeMapperCount[a.id];
                            const bMappers = nodeMapperCount[b.id];
                            return aMappers - bMappers;
                        });
                    
                    for (let node of activeNodes) {
                        const cpuAvailable = node.cpuTotal - node.cpuUsed;
                        const memAvailable = node.memoryTotal - node.memoryUsed;
                        
                        if (cpuAvailable >= cpu && memAvailable >= memory) {
                            node.cpuUsed += cpu;
                            node.memoryUsed += memory;
                            node.containers.push({
                                name: mapperName,
                                cpu: cpu,
                                memory: memory,
                                isMapReduce: true,
                                blockIds: [block.id]
                            });
                            
                            nodeMapperCount[node.id]++;
                            allocatedMappers++;
                            
                            job.mappers.push({
                                name: mapperName,
                                blockId: block.id,
                                nodeId: node.id, // No data locality, but we track the node
                                progress: 0
                            });
                            
                            allocated = true;
                            break;
                        }
                    }
                }
            });
            
            if (allocatedMappers === file.blocks.length) {
                const localityPercent = Math.round((dataLocalityCount / allocatedMappers) * 100);
                showNotification(`✅ ${jobName} started`, 'success');
                
                // Simulate individual mapper progress (all in parallel)
                job.mappers.forEach(mapper => {
                    const mapperInterval = scheduleClusterInterval(() => {
                        // Skip failed mappers (progress = -1)
                        if (mapper.progress === -1) {
                            clearClusterInterval(mapperInterval);
                            return;
                        }
                        
                        // Skip if job has failed
                        if (job.status === 'failed') {
                            clearClusterInterval(mapperInterval);
                            return;
                        }
                        
                        mapper.progress += 6.25; // 16 steps to completion (doubled duration)
                        
                        if (mapper.progress >= 100) {
                            mapper.progress = 100;
                            clearClusterInterval(mapperInterval);
                        }
                        
                        // Calculate progress only from active mappers (not failed ones)
                        const activeMappers = job.mappers.filter(m => m.progress >= 0);
                        const totalProgress = activeMappers.reduce((sum, m) => sum + m.progress, 0);
                        job.progress = activeMappers.length > 0 ? totalProgress / activeMappers.length : 0;
                        
                        // Job completes when all active mappers are done
                        const allActiveDone = activeMappers.every(m => m.progress >= 100);
                        if (allActiveDone && activeMappers.length > 0) {
                            job.status = 'completed';
                            
                            // Free resources (only active mappers)
                            cluster.nodes.forEach(node => {
                                activeMappers.forEach(mapper => {
                                    const containerIndex = node.containers.findIndex(c => c.name === mapper.name);
                                    if (containerIndex !== -1) {
                                        const container = node.containers[containerIndex];
                                        node.cpuUsed -= container.cpu;
                                        node.memoryUsed -= container.memory;
                                        node.containers.splice(containerIndex, 1);
                                    }
                                });
                                
                                // Free ApplicationMaster
                                const amIndex = node.containers.findIndex(c => c.isApplicationMaster && c.jobName === jobName);
                                if (amIndex !== -1) {
                                    const am = node.containers[amIndex];
                                    node.cpuUsed -= am.cpu;
                                    node.memoryUsed -= am.memory;
                                    node.containers.splice(amIndex, 1);
                                }
                            });
                            
                            const failedMappers = job.mappers.filter(m => m.progress === -1).length;
                            if (failedMappers > 0) {
                                showNotification(`✅ ${jobName} completed with ${failedMappers} failed mapper(s)!`, 'success');
                            } else {
                                showNotification(`✅ ${jobName} completed!`, 'success');
                            }
                        }
                        
                        renderCluster();
                    }, 600 + Math.random() * 400);
                });
            } else {
                showNotification(`⚠️ Only ${allocatedMappers}/${file.blocks.length} mappers allocated`, 'warning');
            }
            
            renderCluster();
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

    // Remaining nodes that can host rescheduled tasks
    const remainingNodes = cluster.nodes.filter(n => !n.failed && n.id !== randomNode.id);

    let affectedJobs = [];
    cluster.mapReduceJobs.forEach(job => {
        if (job.status === 'running') {
            const mappersOnFailedNode = job.mappers.filter(m => m.nodeId === randomNode.id);

            if (mappersOnFailedNode.length > 0) {
                let rescheduled = 0;
                let notRescheduled = 0;

                mappersOnFailedNode.forEach(mapper => {
                    // Remove mapper container from the failed node (if present)
                    const containerIndex = randomNode.containers.findIndex(c => c.name === mapper.name);
                    let cpu = 2;
                    let memory = 4;

                    if (containerIndex !== -1) {
                        const container = randomNode.containers[containerIndex];
                        cpu = container.cpu;
                        memory = container.memory;
                        randomNode.cpuUsed -= container.cpu;
                        randomNode.memoryUsed -= container.memory;
                        randomNode.containers.splice(containerIndex, 1);
                    }

                    // Try to reschedule mapper on another node that has the same block
                    const nodesWithBlock = remainingNodes.filter(node =>
                        node.blocks.some(b => b.id === mapper.blockId)
                    );

                    // Prefer nodes with the block, otherwise any remaining node
                    const candidateNodes = nodesWithBlock.length > 0 ? nodesWithBlock : remainingNodes;

                    let allocated = false;
                    for (let node of candidateNodes) {
                        const cpuAvailable = node.cpuTotal - node.cpuUsed;
                        const memAvailable = node.memoryTotal - node.memoryUsed;

                        if (cpuAvailable >= cpu && memAvailable >= memory) {
                            node.cpuUsed += cpu;
                            node.memoryUsed += memory;
                            node.containers.push({
                                name: mapper.name,
                                cpu: cpu,
                                memory: memory,
                                isMapReduce: true,
                                blockIds: [mapper.blockId]
                            });

                            // Restart mapper on the new node
                            mapper.nodeId = node.id;
                            mapper.progress = 0;

                            allocated = true;
                            rescheduled++;
                            break;
                        }
                    }

                    // If we cannot reschedule, mark mapper as failed
                    if (!allocated) {
                        mapper.progress = -1;
                        notRescheduled++;
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

                // Handle ApplicationMaster on the failed node: try to reallocate
                const amIndex = randomNode.containers.findIndex(c => c.isApplicationMaster && c.jobName === job.name);
                if (amIndex !== -1) {
                    const am = randomNode.containers[amIndex];
                    randomNode.cpuUsed -= am.cpu;
                    randomNode.memoryUsed -= am.memory;
                    randomNode.containers.splice(amIndex, 1);

                    const reallocated = allocateApplicationMaster(job.name, job);
                    if (!reallocated) {
                        job.status = 'failed';
                        releaseMapReduceResources(job);
                    }
                }
            }
        }
    });

    if (affectedJobs.length > 0) {
        showNotification(`💥 ${randomNode.name} failed! MapReduce job(s) affected: ${affectedJobs.join(' | ')}`, 'error');
    } else {
        showNotification(`💥 ${randomNode.name} has failed! HDFS will re-replicate blocks...`, 'warning');
    }

    // Simulate re-replication after failure
    scheduleClusterTimeout(() => {
        reReplicateBlocks(randomNode);
    }, 2000);

    renderCluster();
}

        
        // Re-replicate blocks (IMPROVED)
        function reReplicateBlocks(failedNode) {
            const activeNodes = cluster.nodes.filter(n => !n.failed && n.id !== failedNode.id);
            
            if (activeNodes.length === 0) {
                showNotification('❌ No active nodes available for re-replication!', 'error');
                return;
            }
            
            // Step 1: Build replication status for ALL blocks
            const blockReplicationStatus = {};
            
            // Include blocks from ALL nodes to track what existed
            cluster.nodes.forEach(node => {
                node.blocks.forEach(block => {
                    if (!blockReplicationStatus[block.id]) {
                        blockReplicationStatus[block.id] = {
                            block: block,
                            replicaCount: 0,
                            sourceNodes: [],
                            wasOnFailedNode: false
                        };
                    }
                    
                    if (!node.failed) {
                        blockReplicationStatus[block.id].replicaCount++;
                        blockReplicationStatus[block.id].sourceNodes.push(node);
                    } else if (node.id === failedNode.id) {
                        blockReplicationStatus[block.id].wasOnFailedNode = true;
                    }
                });
            });
            
            // Step 2: Identify under-replicated blocks and completely lost blocks
            let reReplicated = 0;
            let underReplicated = 0;
            let totalLost = 0;
            
            for (const [blockId, status] of Object.entries(blockReplicationStatus)) {
                // Check if block is completely lost (no replicas on active nodes)
                if (status.replicaCount === 0) {
                    totalLost++;
                    continue;
                }
                
                // Check if block is under-replicated
                if (status.replicaCount < REPLICATION_FACTOR) {
                    underReplicated++;
                    
                    // Find best source node (one that has the block)
                    const sourceNode = status.sourceNodes[0];
                    
                    // Find best target node (has space, doesn't have this block)
                    const candidateNodes = activeNodes
                        .filter(node => !node.blocks.some(b => b.id === blockId))
                        .sort((a, b) => {
                            const aSpace = a.storageTotal - a.storageUsed;
                            const bSpace = b.storageTotal - b.storageUsed;
                            return bSpace - aSpace;
                        });
                    

                    if (candidateNodes.length > 0) {
                        const targetNode = candidateNodes[0];
                        const availableSpaceGB = targetNode.storageTotal - targetNode.storageUsed;
                        const blockSizeGB = status.block.size / 1024; // MB → GB

                        if (availableSpaceGB >= blockSizeGB) {
                            // Copy block from sourceNode to targetNode
                            targetNode.storageUsed += blockSizeGB;
                            targetNode.blocks.push({
                                ...status.block,
                                isReplica: true
                            });
                            reReplicated++;
                        }
                    }
                }
            }

            // Show comprehensive notification
            if (totalLost > 0) {
                showNotification(`❌ CRITICAL: ${totalLost} blocks PERMANENTLY LOST! Data corruption detected!`, 'error');
            } else if (underReplicated > 0) {
                showNotification(`✅ Re-replication complete! ${reReplicated} replicas added, ${underReplicated} under-replicated blocks recovered`, 'success');
            } else {
                showNotification(`✅ No blocks need re-replication (all have RF=${REPLICATION_FACTOR})`, 'success');
            }

            renderCluster();
        }

        
        // Reset cluster
        function resetCluster() {
            clearClusterTimers();
            colorIndex = 0;
            cluster.fileCounter = 1;
            cluster.jobCounter = 1;
            cluster.mapReduceCounter = 1;
            cluster.blockCounter = 1;
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
