// Cluster state
        const cluster = {
            nodes: [],
            jobQueue: [],
            jobCounter: 1
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
            
            cluster.nodes.forEach(node => {
                const cpuPercent = (node.cpuUsed / node.cpuTotal * 100).toFixed(0);
                const memPercent = (node.memoryUsed / node.memoryTotal * 100).toFixed(0);
                
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
                            ${node.containers.map(c => `<div class="container-item">${c}</div>`).join('')}
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
            let totalCpu = 0, usedCpu = 0;
            let totalMem = 0, usedMem = 0;
            let activeApps = 0;
            
            cluster.nodes.forEach(node => {
                totalCpu += node.cpuTotal;
                usedCpu += node.cpuUsed;
                totalMem += node.memoryTotal;
                usedMem += node.memoryUsed;
                activeApps += node.containers.length;
            });
            
            document.getElementById('totalNodes').textContent = cluster.nodes.length;
            document.getElementById('activeApps').textContent = activeApps;
            document.getElementById('queuedJobs').textContent = cluster.jobQueue.length;
            document.getElementById('cpuUsage').textContent = ((usedCpu / totalCpu) * 100).toFixed(1) + '%';
            document.getElementById('memoryUsage').textContent = ((usedMem / totalMem) * 100).toFixed(1) + '%';
        }
        
        // Update queue display
        function updateQueue() {
            const queueEl = document.getElementById('jobQueue');
            const queueItems = document.getElementById('queueItems');
            
            if (cluster.jobQueue.length > 0) {
                queueEl.style.display = 'block';
                queueItems.innerHTML = cluster.jobQueue.map(job => {
                    if (job.jobId) {
                        // Big job container
                        return `<div class="queue-item">Job-${job.jobId}[${job.containerNum}/${job.totalContainers}] (${job.cpu}C, ${job.memory}GB)</div>`;
                    } else {
                        // Regular job
                        return `<div class="queue-item">Job-${job.id} (${job.cpu}C, ${job.memory}GB)</div>`;
                    }
                }).join('');
            } else {
                queueEl.style.display = 'none';
            }
        }
        
        // Submit a job
        function submitJob() {
            const cpu = Math.floor(Math.random() * 4) + 1;
            const memory = Math.floor(Math.random() * 8) + 2;
            const job = { id: cluster.jobCounter++, cpu, memory };
            
            if (allocateJob(job)) {
                showNotification(`✅ Job-${job.id} allocated successfully!`, 'success');
            } else {
                cluster.jobQueue.push(job);
                showNotification(`⏳ Job-${job.id} queued (waiting for resources)`, 'info');
            }
            
            renderCluster();
        }
        
        // Submit a big job (distributed across multiple nodes)
        function submitBigJob() {
            const jobId = cluster.jobCounter++;
            const numContainers = Math.floor(Math.random() * 3) + 3; // 3-5 containers
            
            const containers = [];
            for (let i = 0; i < numContainers; i++) {
                const cpu = Math.floor(Math.random() * 3) + 2;
                const memory = Math.floor(Math.random() * 6) + 4;
                containers.push({ 
                    id: `${jobId}-${i+1}`, 
                    cpu, 
                    memory, 
                    jobId,
                    containerNum: i + 1,
                    totalContainers: numContainers
                });
            }
            
            let allocatedContainers = 0;
            let queuedContainers = [];
            
            for (let container of containers) {
                if (allocateBigJobContainer(container)) {
                    allocatedContainers++;
                } else {
                    queuedContainers.push(container);
                }
            }
            
            if (allocatedContainers === containers.length) {
                showNotification(`✅ Big Job-${jobId} distributed across ${allocatedContainers} nodes!`, 'success');
            } else if (allocatedContainers > 0) {
                queuedContainers.forEach(c => cluster.jobQueue.push(c));
                showNotification(`⚠️ Big Job-${jobId}: ${allocatedContainers}/${containers.length} containers running, ${queuedContainers.length} queued`, 'info');
            } else {
                queuedContainers.forEach(c => cluster.jobQueue.push(c));
                showNotification(`⏳ Big Job-${jobId} fully queued (${containers.length} containers waiting)`, 'info');
            }
            
            renderCluster();
        }
        
        // Allocate a job to a node
        function allocateJob(job) {
            // Create a shuffled copy of nodes for random allocation
            const shuffledNodes = [...cluster.nodes].sort(() => Math.random() - 0.5);
            
            // Find node with enough resources (now in random order)
            for (let node of shuffledNodes) {
                const cpuAvailable = node.cpuTotal - node.cpuUsed;
                const memAvailable = node.memoryTotal - node.memoryUsed;
                
                if (cpuAvailable >= job.cpu && memAvailable >= job.memory) {
                    node.cpuUsed += job.cpu;
                    node.memoryUsed += job.memory;
                    node.containers.push(`Job-${job.id}`);
                    
                    // Simulate job completion after 5-10 seconds
                    scheduleClusterTimeout(() => completeJob(node.id, job), Math.random() * 5000 + 5000);
                    return true;
                }
            }
            return false;
        }
        
        // Allocate a big job container to a node
        function allocateBigJobContainer(container) {
            // Create a shuffled copy of nodes for random allocation
            const shuffledNodes = [...cluster.nodes].sort(() => Math.random() - 0.5);
            
            // Find node with enough resources (now in random order)
            for (let node of shuffledNodes) {
                const cpuAvailable = node.cpuTotal - node.cpuUsed;
                const memAvailable = node.memoryTotal - node.memoryUsed;
                
                if (cpuAvailable >= container.cpu && memAvailable >= container.memory) {
                    node.cpuUsed += container.cpu;
                    node.memoryUsed += container.memory;
                    node.containers.push(`Job-${container.jobId}[${container.containerNum}/${container.totalContainers}]`);
                    
                    // Simulate job completion after 8-15 seconds (big jobs take longer)
                    scheduleClusterTimeout(() => completeBigJobContainer(node.id, container), Math.random() * 7000 + 8000);
                    return true;
                }
            }
            return false;
        }
        
        // Complete a job
        function completeJob(nodeId, job) {
            const node = cluster.nodes.find(n => n.id === nodeId);
            if (node) {
                node.cpuUsed -= job.cpu;
                node.memoryUsed -= job.memory;
                node.containers = node.containers.filter(c => c !== `Job-${job.id}`);
                
                showNotification(`✅ Job-${job.id} completed on ${node.name}!`, 'success');
                
                // Try to allocate queued jobs
                if (cluster.jobQueue.length > 0) {
                    const queuedJob = cluster.jobQueue[0];
                    if (queuedJob.jobId) {
                        // It's a big job container
                        if (allocateBigJobContainer(queuedJob)) {
                            cluster.jobQueue.shift();
                            showNotification(`🚀 Queued container Job-${queuedJob.jobId}[${queuedJob.containerNum}] now running!`, 'info');
                        }
                    } else {
                        // It's a regular job
                        if (allocateJob(queuedJob)) {
                            cluster.jobQueue.shift();
                            showNotification(`🚀 Queued Job-${queuedJob.id} now running!`, 'info');
                        }
                    }
                }
                
                renderCluster();
            }
        }
        
        // Complete a big job container
        function completeBigJobContainer(nodeId, container) {
            const node = cluster.nodes.find(n => n.id === nodeId);
            if (node) {
                node.cpuUsed -= container.cpu;
                node.memoryUsed -= container.memory;
                node.containers = node.containers.filter(c => c !== `Job-${container.jobId}[${container.containerNum}/${container.totalContainers}]`);
                
                showNotification(`✅ Job-${container.jobId}[${container.containerNum}/${container.totalContainers}] completed on ${node.name}!`, 'success');
                
                // Try to allocate queued jobs
                if (cluster.jobQueue.length > 0) {
                    const queuedJob = cluster.jobQueue[0];
                    if (queuedJob.jobId) {
                        // It's a big job container
                        if (allocateBigJobContainer(queuedJob)) {
                            cluster.jobQueue.shift();
                            showNotification(`🚀 Queued container Job-${queuedJob.jobId}[${queuedJob.containerNum}] now running!`, 'info');
                        }
                    } else {
                        // It's a regular job
                        if (allocateJob(queuedJob)) {
                            cluster.jobQueue.shift();
                            showNotification(`🚀 Queued Job-${queuedJob.id} now running!`, 'info');
                        }
                    }
                }
                
                renderCluster();
            }
        }
        
        // Reset cluster
        function resetCluster() {
            clearClusterTimeouts();
            cluster.jobQueue = [];
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
            }, 3000);
        }
        
        // Initialize
        initializeCluster();
