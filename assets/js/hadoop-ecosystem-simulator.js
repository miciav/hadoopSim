const { useState, useEffect, useRef } = React;

const FILE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
const STYLES = `
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .hadoop-container {
              background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
              min-height: 100vh;
              padding: 20px;
              color: #333;
            }

            .header {
              text-align: center;
              color: white;
              margin-bottom: 20px;
            }

            .header h1 {
              font-size: 2.5em;
              text-shadow: 3px 3px 6px rgba(0,0,0,0.3);
              margin-bottom: 10px;
            }

            .header p {
              font-size: 1.2em;
              opacity: 0.9;
            }

            .main-container {
              max-width: 1600px;
              margin: 0 auto;
              display: grid;
              grid-template-columns: 250px 1fr;
              gap: 20px;
            }

            .sidebar {
              background: white;
              border-radius: 15px;
              padding: 20px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.2);
              height: fit-content;
            }

            .sidebar h2 {
              color: #1e3c72;
              margin-bottom: 15px;
              border-bottom: 3px solid #1e3c72;
              padding-bottom: 10px;
              font-size: 1.2em;
            }

            .btn {
              width: 100%;
              padding: 10px;
              margin: 6px 0;
              border: none;
              border-radius: 8px;
              font-size: 0.95em;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }

            .btn-hdfs {
              background: #11998e;
              color: white;
            }

            .btn-hdfs:hover {
              background: #0d7a70;
              transform: translateY(-2px);
            }

            .btn-yarn {
              background: #667eea;
              color: white;
            }

            .btn-yarn:hover {
              background: #5568d3;
              transform: translateY(-2px);
            }

            .btn-mapreduce {
              background: #f6ad55;
              color: white;
            }

            .btn-mapreduce:hover {
              background: #ed8936;
              transform: translateY(-2px);
            }

            .btn-danger {
              background: #f56565;
              color: white;
            }

            .btn-danger:hover {
              background: #e53e3e;
              transform: translateY(-2px);
            }

            .stats-section {
              margin: 15px 0;
              padding: 10px;
              background: #f7fafc;
              border-radius: 8px;
            }

            .stat-item {
              margin: 8px 0;
              font-size: 0.9em;
              display: flex;
              justify-content: space-between;
            }

            .stat-label {
              font-weight: bold;
              color: #1e3c72;
            }

            .stat-value {
              color: #333;
            }

            .content-area {
              display: flex;
              flex-direction: column;
              gap: 20px;
            }

            .cluster-panel {
              background: white;
              border-radius: 15px;
              padding: 25px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            }

            .panel-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 3px solid #e2e8f0;
            }

            .panel-header h2 {
              font-size: 1.5em;
              color: #2d3748;
            }

            .panel-icon {
              font-size: 2em;
            }

            .nodes-container {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 15px;
            }

            .node {
              background: linear-gradient(135deg, #f6f8fb 0%, #e9ecef 100%);
              border: 3px solid #dee2e6;
              border-radius: 12px;
              padding: 15px;
              transition: all 0.3s;
              position: relative;
            }

            .node:hover {
              transform: translateY(-3px);
              box-shadow: 0 6px 20px rgba(0,0,0,0.15);
            }

            .node.data-locality {
              border-color: #48bb78;
              background: linear-gradient(135deg, #e6fffa 0%, #c6f6d5 100%);
              box-shadow: 0 0 20px rgba(72, 187, 120, 0.4);
            }

            .node.data-locality::after {
              content: '⚡ Data Locality';
              position: absolute;
              top: -12px;
              right: 10px;
              background: #48bb78;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 0.75em;
              font-weight: bold;
            }

            .node.busy {
              border-color: #f6ad55;
              background: linear-gradient(135deg, #fffaf0 0%, #feebc8 100%);
            }

            .node.failed {
              border-color: #fc8181;
              background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
              opacity: 0.6;
            }

            .node.rebalancing {
              border-color: #9f7aea;
              background: linear-gradient(135deg, #faf5ff 0%, #e9d8fd 100%);
              animation: pulse 2s ease-in-out infinite;
            }

            .node.shuffle-source {
              border-color: #f39c12;
              box-shadow: 0 0 20px rgba(243, 156, 18, 0.5);
              animation: shuffleSourcePulse 1s ease-in-out infinite;
            }

            .node.shuffle-source::before {
              content: '📤';
              position: absolute;
              top: -12px;
              left: 10px;
              background: #f39c12;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 0.75em;
              font-weight: bold;
            }

            .node.shuffle-target {
              border-color: #e67e22;
              box-shadow: 0 0 20px rgba(230, 126, 34, 0.6);
              animation: shuffleTargetPulse 1s ease-in-out infinite;
            }

            .node.shuffle-target::before {
              content: '📥 Receiving';
              position: absolute;
              top: -12px;
              left: 10px;
              background: #e67e22;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 0.75em;
              font-weight: bold;
            }

            @keyframes shuffleSourcePulse {
              0%, 100% {
                box-shadow: 0 0 15px rgba(243, 156, 18, 0.4);
              }
              50% {
                box-shadow: 0 0 30px rgba(243, 156, 18, 0.8);
              }
            }

            @keyframes shuffleTargetPulse {
              0%, 100% {
                box-shadow: 0 0 15px rgba(230, 126, 34, 0.4);
              }
              50% {
                box-shadow: 0 0 30px rgba(230, 126, 34, 0.8);
              }
            }

            @keyframes pulse {
              0%, 100% {
                box-shadow: 0 0 20px rgba(159, 122, 234, 0.4);
              }
              50% {
                box-shadow: 0 0 40px rgba(159, 122, 234, 0.7);
              }
            }

            .node-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
            }

            .node-name {
              font-weight: bold;
              font-size: 1.1em;
              color: #2d3748;
            }

            .node-status {
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 0.8em;
              font-weight: bold;
            }

            .status-active {
              background: #48bb78;
              color: white;
            }

            .status-failed {
              background: #f56565;
              color: white;
            }

            .node-resources {
              margin-bottom: 10px;
              font-size: 0.85em;
            }

            .resource-bar {
              height: 6px;
              background: #e2e8f0;
              border-radius: 3px;
              margin: 4px 0;
              overflow: hidden;
            }

            .resource-fill {
              height: 100%;
              transition: width 0.3s;
              border-radius: 3px;
            }

            .cpu-fill { background: #4299e1; }
            .memory-fill { background: #48bb78; }
            .storage-fill { background: #ed8936; }

            .blocks-section, .containers-section {
              margin-top: 10px;
            }

            .section-title {
              font-size: 0.85em;
              font-weight: bold;
              color: #4a5568;
              margin-bottom: 6px;
            }

            .block-list, .container-list {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
            }

            .block-item {
              padding: 4px 8px;
              border-radius: 6px;
              font-size: 0.75em;
              font-weight: bold;
              color: white;
              position: relative;
            }

            .block-item.replica {
              opacity: 0.7;
              border: 2px dashed rgba(255, 255, 255, 0.6);
            }

            .block-item.replica::after {
              content: '📋';
              position: absolute;
              top: -8px;
              right: -8px;
              font-size: 0.8em;
            }

            .container-item {
              padding: 4px 8px;
              border-radius: 6px;
              font-size: 0.75em;
              background: #667eea;
              color: white;
            }

            .container-item.am {
              background: #f6ad55;
            }

            .container-item.reducer {
              background: #48bb78;
            }

            .files-list {
              display: grid;
              gap: 10px;
            }

            .file-item {
              background: #f7fafc;
              padding: 12px;
              border-radius: 8px;
              border-left: 4px solid;
            }

            .file-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }

            .file-name {
              font-weight: bold;
            }

            .file-size {
              color: #718096;
              font-size: 0.9em;
            }

            .file-blocks {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
            }

            .jobs-list {
              display: grid;
              gap: 15px;
            }

            .job-item {
              background: #f7fafc;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid;
            }

            .job-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }

            .job-actions {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .job-toggle {
              background: white;
              border: 1px solid #cbd5e0;
              border-radius: 999px;
              padding: 4px 12px;
              font-size: 0.8em;
              font-weight: 600;
              color: #2d3748;
              cursor: pointer;
              transition: background 0.2s ease, color 0.2s ease;
            }

            .job-toggle:hover,
            .job-toggle:focus-visible {
              background: #edf2f7;
            }

            .job-toggle:focus-visible {
              outline: 2px solid #667eea;
              outline-offset: 2px;
            }

            .job-name {
              font-weight: bold;
              font-size: 1.1em;
            }

            .job-body {
              margin-top: 10px;
            }

            .job-body.collapsed {
              display: none;
            }

            .job-status {
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 0.85em;
              font-weight: bold;
            }

            .status-pending { background: #cbd5e0; color: #2d3748; }
            .status-running { background: #667eea; color: white; }
            .status-completed { background: #48bb78; color: white; }
            .status-failed { background: #f56565; color: white; }

            .mappers-container {
              margin-top: 10px;
            }

            .mapper-item {
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 6px 0;
              font-size: 0.9em;
            }

            .mapper-name {
              min-width: 100px;
              font-weight: 500;
            }

            .progress-bar {
              flex: 1;
              height: 20px;
              background: #e2e8f0;
              border-radius: 10px;
              overflow: hidden;
              position: relative;
            }

            .progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
              transition: width 0.3s;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 0.75em;
              font-weight: bold;
            }

            .reducers-container {
              margin-top: 10px;
              padding: 10px;
              background: white;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }

            .reducer-item {
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 6px 0;
              font-size: 0.9em;
            }

            .shuffle-phase {
              margin-top: 10px;
              padding: 15px;
              background: linear-gradient(135deg, #fef5e7 0%, #fdebd0 100%);
              border-radius: 8px;
              border: 2px solid #f39c12;
              animation: shufflePulse 1.5s ease-in-out infinite;
            }

            @keyframes shufflePulse {
              0%, 100% {
                box-shadow: 0 0 10px rgba(243, 156, 18, 0.3);
              }
              50% {
                box-shadow: 0 0 20px rgba(243, 156, 18, 0.6);
              }
            }

            .shuffle-fill {
              background: linear-gradient(90deg, #f39c12 0%, #e67e22 100%) !important;
            }

            /* GANTT STYLES */
            .gantt-container {
              margin-top: 12px;
              padding: 14px;
              background: linear-gradient(145deg, #f8fafc 0%, #edf2f7 100%);
              border-radius: 12px;
              border: 1px solid #cbd5e0;
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
            }

            .gantt-body {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .gantt-legend {
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
              font-size: 0.85em;
              color: #4a5568;
            }

            .legend-swatch {
              width: 14px;
              height: 14px;
              border-radius: 4px;
              display: inline-block;
              margin-right: 6px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }

            .legend-swatch.map { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); }
            .legend-swatch.reduce { background: linear-gradient(90deg, #38b2ac 0%, #319795 100%); }
            .legend-swatch.shuffle { background: linear-gradient(90deg, #ed8936 0%, #dd6b20 100%); }

            .gantt-vis-wrapper {
              min-height: 220px;
              max-height: none;
              background: white;
              border-radius: 10px;
              border: 1px solid #e2e8f0;
              padding: 6px;
              overflow: visible;
            }

            .vis-item.gantt-map {
              background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
              border-color: #667eea;
              color: white;
            }

            .vis-item.gantt-reduce {
              background: linear-gradient(90deg, #38b2ac 0%, #319795 100%);
              border-color: #319795;
              color: white;
            }

            .vis-item.gantt-shuffle {
              background: linear-gradient(90deg, #ed8936 0%, #dd6b20 100%);
              border-color: #dd6b20;
              color: white;
            }

            .vis-item {
              border-radius: 8px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.12);
              font-size: 0.8em;
            }

            .vis-time-axis .vis-text {
              color: #4a5568;
            }

            .gantt-empty {
              font-size: 0.9em;
              color: #718096;
              padding: 8px 0;
            }

            .gantt-metrics {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-bottom: 12px;
            }

            .gantt-metric {
              background: rgba(255, 255, 255, 0.9);
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 0.8em;
              color: #4a5568;
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 140px;
            }

            .gantt-metric span {
              font-size: 0.75em;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }

            .gantt-metric strong {
              color: #2d3748;
            }

            .notification {
              position: fixed;
              bottom: 20px;
              right: 20px;
              padding: 15px 20px;
              border-radius: 8px;
              color: white;
              font-weight: bold;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              animation: slideIn 0.3s ease-out;
              z-index: 1000;
              max-width: 400px;
            }

            @keyframes slideIn {
              from {
                transform: translateX(400px);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }

            .notification.success { background: #48bb78; }
            .notification.error { background: #f56565; }
            .notification.warning { background: #f6ad55; }
            .notification.info { background: #4299e1; }

            .loading {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              font-size: 2em;
              color: white;
            }

            .empty-note {
              font-size: 0.85em;
              color: #718096;
            }

            @media (max-width: 768px) {
              .main-container {
                grid-template-columns: 1fr;
              }
            }
          `;

const bootstrap = (HadoopSim) => {
  const { createSimulation } = HadoopSim;

  const NotificationToaster = ({ notifications }) => (
  <div>
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
      <span className="stat-value">{stats.activeNodes}/{stats.totalNodes}</span>
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

  const SidebarControls = ({ files, onUpload, onRunMapReduce, onFailNode, onReset, stats }) => (
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

    <div style={{ marginTop: '15px' }}>
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

    <div style={{ marginTop: '15px' }}>
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
        <span className={`node-status ${node.failed ? 'status-failed' : 'status-active'}`}>
          {node.failed ? 'FAILED' : 'ACTIVE'}
        </span>
      </div>

      <div className="node-resources">
        <div>
          CPU: {node.cpuUsed}/{node.cpuTotal} cores
          <div className="resource-bar">
            <div className="resource-fill cpu-fill" style={{ width: `${cpuPercent}%` }} />
          </div>
        </div>
        <div>
          Memory: {(node.memoryUsedMb / 1024).toFixed(1)}/{(node.memoryTotalMb / 1024).toFixed(0)} GB
          <div className="resource-bar">
            <div className="resource-fill memory-fill" style={{ width: `${memPercent}%` }} />
          </div>
        </div>
        <div>
          Storage: {(node.storageUsedMb / 1024).toFixed(1)}/{(node.storageTotalMb / 1024).toFixed(0)} GB
          <div className="resource-bar">
            <div className="resource-fill storage-fill" style={{ width: `${storagePercent}%` }} />
          </div>
        </div>
      </div>

      {node.blocks.length > 0 && (
        <div className="blocks-section">
          <div className="section-title">📦 HDFS Blocks ({node.blocks.length})</div>
          <div className="block-list">
            {node.blocks.map((block) => (
              <div
                key={block.id}
                className={`block-item ${block.isReplica ? 'replica' : ''}`}
                style={{ backgroundColor: fileColors.get(block.fileName) || '#cbd5f0' }}
                title={`${block.id} - ${block.fileName}`}
              >
                {block.id}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="containers-section">
        <div className="section-title">🔷 Containers ({node.containers.length})</div>
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
                {container.isApplicationMaster ? '👑 ' : ''}{container.name}
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
    return () => off();
  }, [sim]);

  const pushNotification = (message, type) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notice) => notice.id !== id));
    }, 4000);
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
      pushNotification(`⚠️ ${result.file.name} uploaded with under-replicated blocks`, 'warning');
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
    if (job.status === 'queued') {
      pushNotification(`⏳ ${job.name} queued: insufficient resources`, 'warning');
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
    const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
    sim.actions.failNode(randomNode.id);
    pushNotification(`💥 ${randomNode.name} failed. Re-replicating...`, 'warning');

    setTimeout(() => {
      const summary = sim.actions.reReplicate();
      if (summary.lost > 0) {
        pushNotification(`❌ ${summary.lost} blocks permanently lost`, 'error');
      } else if (summary.reReplicated > 0) {
        pushNotification(`✅ Re-replicated ${summary.reReplicated} blocks`, 'success');
      }
    }, 1500);
  };

  const resetCluster = () => {
    sim.actions.reset();
    fileColorsRef.current.clear();
    colorIndexRef.current = 0;
    pushNotification('🔄 Cluster reset!', 'info');
  };

  const totalStorageMb = sim.state.nodes.reduce((sum, node) => sum + node.storageTotalMb, 0);
  const usedStorageMb = sim.state.nodes.reduce((sum, node) => sum + node.storageUsedMb, 0);
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
      <style>{STYLES}</style>
      <div className="header">
        <h1>🐘 Hadoop Ecosystem Simulator</h1>
        <p>HDFS + YARN + MapReduce (Library-driven)</p>
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
                <div className="empty-note">No files yet. Upload to begin.</div>
              ) : (
                sim.state.files.map((file) => {
                  ensureFileColor(file.name);
                  return (
                    <div key={file.name} className="file-item" style={{ borderLeftColor: fileColors.get(file.name) }}>
                      <div className="file-name">📄 {file.name}</div>
                      <div className="file-size">{file.sizeMb} MB • {file.blocks.length} blocks</div>
                      <div className="file-blocks">
                        {file.blocks.map((block) => (
                          <div
                            key={block.id}
                            className="block-chip"
                            style={{ backgroundColor: fileColors.get(file.name) }}
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
                      <div className={`job-status status-${job.status}`}>{job.status}</div>
                    </div>
                    <div className="job-details">
                      <div>File: {job.fileName}</div>
                      <div>Mappers: {job.mappers.length}</div>
                    </div>
                    <div className="job-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${job.progress}%` }} />
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

const waitForHadoopSim = () => {
  if (window.HadoopSimReady) {
    return window.HadoopSimReady;
  }
  if (window.HadoopSim) {
    return Promise.resolve(window.HadoopSim);
  }
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      if (window.HadoopSimReady) {
        clearInterval(intervalId);
        window.HadoopSimReady.then(resolve);
      } else if (window.HadoopSim) {
        clearInterval(intervalId);
        resolve(window.HadoopSim);
      }
    }, 50);
  });
};

waitForHadoopSim().then(bootstrap);
