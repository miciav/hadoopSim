import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { createSimulation } from './hadoop-sim/simulation.js';
import { describeMapReduceFailure } from './hadoop-sim/mapreduce.js';
const { useState, useEffect, useRef } = React;

const FILE_COLORS = Array.from(
  { length: 8 },
  (_, index) => `var(--sim-file-${index})`
);

const bootstrap = () => {
  const NotificationToaster = ({ notifications }) => (
    <div role="status" aria-live="polite" aria-relevant="additions text">
      {notifications.map((notice) => (
        <div key={notice.id} className={`notification ${notice.type}`}>
          {notice.message}
        </div>
      ))}
    </div>
  );

  const StatsPanel = ({ stats }) => (
    <div className="stats-section">
      <h2>📊 Statistics</h2>
      <div className="stat-item">
        <span className="stat-label">Nodes:</span>
        <span className="stat-value">
          {stats.activeNodes}/{stats.totalNodes}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">CPU:</span>
        <span className="stat-value">{stats.cpuUsage}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Memory:</span>
        <span className="stat-value">{stats.memoryUsage}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Storage:</span>
        <span className="stat-value">{stats.storageUsage}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Files:</span>
        <span className="stat-value">{stats.totalFiles}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Running Jobs:</span>
        <span className="stat-value">{stats.runningJobs}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Completed:</span>
        <span className="stat-value">{stats.completedJobs}</span>
      </div>
    </div>
  );

  const SidebarControls = ({
    files,
    onUpload,
    onRunMapReduce,
    onFailNode,
    onReset,
    stats
  }) => (
    <div className="sidebar">
      <h2>🔧 Controls</h2>

      <div>
        <button className="btn btn-hdfs" onClick={() => onUpload(256)}>
          📤 Upload 256 MB
        </button>
        <button className="btn btn-hdfs" onClick={() => onUpload(512)}>
          📤 Upload 512 MB
        </button>
        <button className="btn btn-hdfs" onClick={() => onUpload(1024)}>
          📤 Upload 1 GB
        </button>
      </div>

      <div className="section-spaced">
        <h2>🎯 MapReduce</h2>
        {files.length === 0 ? (
          <div className="empty-note">Upload a file to start MapReduce.</div>
        ) : (
          files.map((file) => (
            <button
              key={file.name}
              className="btn btn-mapreduce"
              onClick={() => onRunMapReduce(file.name)}
            >
              🚀 Run on {file.name}
            </button>
          ))
        )}
      </div>

      <div className="section-spaced">
        <button className="btn btn-yarn" onClick={onFailNode}>
          💥 Simulate Failure
        </button>
        <button className="btn btn-danger" onClick={onReset}>
          🔄 Reset Cluster
        </button>
      </div>

      <StatsPanel stats={stats} />
    </div>
  );

  const NodeCard = ({ node, fileColors }) => {
    const hasDataLocality = node.containers.some((container) => {
      if (!container.isMapReduce || !container.blockIds) {
        return false;
      }
      return container.blockIds.some((blockId) =>
        node.blocks.some((block) => block.id === blockId)
      );
    });

    const storagePercent = (node.storageUsedMb / node.storageTotalMb) * 100;
    const cpuPercent = (node.cpuUsed / node.cpuTotal) * 100;
    const memPercent = (node.memoryUsedMb / node.memoryTotalMb) * 100;

    return (
      <div
        className={`node ${node.failed ? 'failed' : ''} ${hasDataLocality ? 'data-locality' : ''} ${
          node.containers.length > 0 ? 'busy' : ''
        }`}
      >
        <div className="node-header">
          <span className="node-name">{node.name}</span>
          <span
            className={`node-status ${node.failed ? 'status-failed' : 'status-active'}`}
          >
            {node.failed ? 'FAILED' : 'ACTIVE'}
          </span>
        </div>

        <div className="node-resources">
          <div>
            CPU: {node.cpuUsed}/{node.cpuTotal} cores
            <div className="resource-bar">
              <div
                className="resource-fill cpu-fill"
                style={{ width: `${cpuPercent}%` }}
              />
            </div>
          </div>
          <div>
            Memory: {(node.memoryUsedMb / 1024).toFixed(1)}/
            {(node.memoryTotalMb / 1024).toFixed(0)} GB
            <div className="resource-bar">
              <div
                className="resource-fill memory-fill"
                style={{ width: `${memPercent}%` }}
              />
            </div>
          </div>
          <div>
            Storage: {(node.storageUsedMb / 1024).toFixed(1)}/
            {(node.storageTotalMb / 1024).toFixed(0)} GB
            <div className="resource-bar">
              <div
                className="resource-fill storage-fill"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </div>

        {node.blocks.length > 0 && (
          <div className="blocks-section">
            <div className="section-title">
              📦 HDFS Blocks ({node.blocks.length})
            </div>
            <div className="block-list">
              {node.blocks.map((block) => (
                <div
                  key={block.id}
                  className={`block-item ${block.isReplica ? 'replica' : ''}`}
                  style={{
                    backgroundColor:
                      fileColors.get(block.fileName) || 'var(--sim-soft)'
                  }}
                  title={`${block.id} - ${block.fileName}`}
                >
                  {block.id}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="containers-section">
          <div className="section-title">
            🔷 Containers ({node.containers.length})
          </div>
          <div className="container-list">
            {node.containers.length === 0 ? (
              <span className="empty-note">No active containers</span>
            ) : (
              node.containers.map((container) => (
                <div
                  key={container.name}
                  className={`container-chip ${container.isMapReduce ? 'mapreduce' : ''} ${
                    container.isApplicationMaster ? 'appmaster' : ''
                  }`}
                >
                  {container.isApplicationMaster ? '👑 ' : ''}
                  {container.name}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const HadoopEcosystem = () => {
    const simRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [, setVersion] = useState(0);
    const fileColorsRef = useRef(new Map());
    const colorIndexRef = useRef(0);
    const recoveryTimersRef = useRef(new Set());
    const notificationTimersRef = useRef(new Set());

    if (!simRef.current) {
      simRef.current = createSimulation({
        nodeCount: 6,
        replicationFactor: 3,
        blockSizeMb: 128,
        nodeTemplate: {
          cpuTotal: 16,
          memoryTotalMb: 32 * 1024,
          storageTotalMb: 100 * 1024,
          namePrefix: 'Node-'
        }
      });
    }

    const sim = simRef.current;

    useEffect(() => {
      const off = sim.on('*', () => setVersion((value) => value + 1));
      return () => {
        off();
        recoveryTimersRef.current.forEach(clearTimeout);
        recoveryTimersRef.current.clear();
        notificationTimersRef.current.forEach(clearTimeout);
        notificationTimersRef.current.clear();
        sim.dispose();
      };
    }, [sim]);

    const pushNotification = (message, type) => {
      const id = Date.now() + Math.random();
      setNotifications((prev) => [...prev, { id, message, type }]);
      const timerId = setTimeout(() => {
        notificationTimersRef.current.delete(timerId);
        setNotifications((prev) => prev.filter((notice) => notice.id !== id));
      }, 4000);
      notificationTimersRef.current.add(timerId);
    };

    const ensureFileColor = (fileName) => {
      if (!fileColorsRef.current.has(fileName)) {
        const color = FILE_COLORS[colorIndexRef.current % FILE_COLORS.length];
        colorIndexRef.current += 1;
        fileColorsRef.current.set(fileName, color);
      }
    };

    const uploadFile = (sizeMb) => {
      const result = sim.actions.uploadFile(sizeMb);
      if (!result.ok) {
        pushNotification(`❌ Failed to upload (${sizeMb} MB).`, 'error');
        return;
      }
      ensureFileColor(result.file.name);
      if (result.results.some((entry) => entry.underReplicated)) {
        pushNotification(
          `⚠️ ${result.file.name} uploaded with under-replicated blocks`,
          'warning'
        );
      } else {
        pushNotification(`✅ ${result.file.name} uploaded`, 'success');
      }
    };

    const runMapReduce = (fileName) => {
      const job = sim.actions.submitMapReduce({ fileName });
      if (!job) {
        pushNotification('⚠️ Upload an HDFS file first!', 'warning');
        return;
      }
      if (job.status === 'failed') {
        pushNotification(
          `❌ ${job.name} failed: ${job.failureReason}`,
          'error'
        );
        return;
      }
      if (job.status === 'queued') {
        pushNotification(
          `⏳ ${job.name} queued: insufficient resources`,
          'warning'
        );
      } else {
        pushNotification(`✅ ${job.name} started`, 'success');
      }
    };

    const failNode = () => {
      const activeNodes = sim.state.nodes.filter((node) => !node.failed);
      if (activeNodes.length === 0) {
        pushNotification('❌ All nodes already failed', 'error');
        return;
      }
      const randomNode =
        activeNodes[Math.floor(Math.random() * activeNodes.length)];
      sim.actions.failNode(randomNode.id);
      pushNotification(
        `💥 ${randomNode.name} failed. Re-replicating...`,
        'warning'
      );

      const timerId = setTimeout(() => {
        recoveryTimersRef.current.delete(timerId);
        const summary = sim.actions.reReplicate();
        if (summary.lost > 0) {
          pushNotification(
            `❌ ${summary.lost} blocks permanently lost`,
            'error'
          );
        } else if (summary.reReplicated > 0) {
          pushNotification(
            `✅ Re-replicated ${summary.reReplicated} blocks`,
            'success'
          );
        }
      }, 1500);
      recoveryTimersRef.current.add(timerId);
    };

    const resetCluster = () => {
      notificationTimersRef.current.forEach(clearTimeout);
      notificationTimersRef.current.clear();
      setNotifications([]);
      recoveryTimersRef.current.forEach(clearTimeout);
      recoveryTimersRef.current.clear();
      sim.actions.reset();
      fileColorsRef.current.clear();
      colorIndexRef.current = 0;
      pushNotification('🔄 Cluster reset!', 'info');
    };

    const totalStorageMb = sim.state.nodes.reduce(
      (sum, node) => sum + node.storageTotalMb,
      0
    );
    const usedStorageMb = sim.state.nodes.reduce(
      (sum, node) => sum + node.storageUsedMb,
      0
    );
    const yarnStats = sim.yarn.stats();
    const mapReduceStats = sim.mapreduce.stats();

    const stats = {
      activeNodes: sim.state.nodes.filter((node) => !node.failed).length,
      totalNodes: sim.state.nodes.length,
      cpuUsage: `${yarnStats.usedCpu}/${yarnStats.totalCpu} cores`,
      memoryUsage: `${(yarnStats.usedMemMb / 1024).toFixed(1)}/${(
        yarnStats.totalMemMb / 1024
      ).toFixed(1)} GB`,
      storageUsage: `${(usedStorageMb / 1024).toFixed(1)}/${(
        totalStorageMb / 1024
      ).toFixed(1)} GB`,
      totalFiles: sim.state.files.length,
      runningJobs: mapReduceStats.runningJobs,
      completedJobs: mapReduceStats.completedJobs
    };

    const fileColors = fileColorsRef.current;

    return (
      <div className="hadoop-container">
        <div className="header">
          <h1>🐘 Hadoop Ecosystem Simulator</h1>
          <p>HDFS + YARN + MapReduce (simplified model)</p>
        </div>

        <div className="main-container">
          <SidebarControls
            files={sim.state.files}
            onUpload={uploadFile}
            onRunMapReduce={runMapReduce}
            onFailNode={failNode}
            onReset={resetCluster}
            stats={stats}
          />

          <div className="content-area">
            <div className="cluster-panel">
              <div className="panel-header">
                <div className="panel-icon">🖥️</div>
                <h2>Cluster Overview</h2>
              </div>
              <div className="nodes-container">
                {sim.state.nodes.map((node) => (
                  <NodeCard key={node.id} node={node} fileColors={fileColors} />
                ))}
              </div>
            </div>

            <div className="cluster-panel">
              <div className="panel-header">
                <div className="panel-icon">📂</div>
                <h2>HDFS Files</h2>
              </div>
              <div className="files-container">
                {sim.state.files.length === 0 ? (
                  <div className="empty-note">
                    No files yet. Upload to begin.
                  </div>
                ) : (
                  sim.state.files.map((file) => {
                    ensureFileColor(file.name);
                    return (
                      <div
                        key={file.name}
                        className="file-item"
                        style={{ borderLeftColor: fileColors.get(file.name) }}
                      >
                        <div className="file-name">📄 {file.name}</div>
                        <div className="file-size">
                          {file.sizeMb} MB • {file.blocks.length} blocks
                        </div>
                        <div className="file-blocks">
                          {file.blocks.map((block) => (
                            <div
                              key={block.id}
                              className="block-chip"
                              style={{
                                backgroundColor: fileColors.get(file.name)
                              }}
                            >
                              {block.id}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="cluster-panel">
              <div className="panel-header">
                <div className="panel-icon">⚙️</div>
                <h2>MapReduce Jobs</h2>
              </div>
              <div className="jobs-container">
                {sim.state.mapReduceJobs.length === 0 ? (
                  <div className="empty-note">No MapReduce jobs yet.</div>
                ) : (
                  sim.state.mapReduceJobs.map((job) => (
                    <div key={job.id} className="job-item">
                      <div className="job-header">
                        <div className="job-name">{job.name}</div>
                        <div className={`job-status status-${job.status}`}>
                          {job.status}
                        </div>
                      </div>
                      <div className="job-details">
                        <div>File: {job.fileName}</div>
                        <div>Mappers: {job.mappers.length}</div>
                        {job.status === 'failed' && (
                          <div>
                            {describeMapReduceFailure(job.failureReason)}
                          </div>
                        )}
                      </div>
                      <div className="job-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <NotificationToaster notifications={notifications} />
      </div>
    );
  };

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<HadoopEcosystem />);
};

bootstrap();
