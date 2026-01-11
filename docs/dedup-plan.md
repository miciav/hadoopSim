# Deduplication Plan (JS only, exclude JSX)

## Goal
Create a shared JS library for common HDFS, YARN, and MapReduce logic while keeping HTML pages static and JSX untouched.

## Current Overlap (Summary)
- Timer management: `scheduleClusterTimeout`, interval handling, and reset cleanup (HDFS, YARN, Full).
- Notifications: identical DOM creation, classes, aria-live, and timeouts.
- HDFS: file upload, block allocation, replica placement, re-replication, failure simulation, stats.
- YARN: job submission, container allocation, completion, queue drain, stats.
- MapReduce (Full + Ecosystem): mapper allocation, data locality, progress, failure handling.
- Utility patterns: random sizing, percentage formatting, resource bounds checks.

## Target Library Shape
```
assets/js/hadoop-sim/
  constants.js
  random.js
  timers.js
  notifications.js
  hdfs.js
  yarn.js
  mapreduce.js
  stats.js
  index.js
```

### Proposed APIs (example)
- `createTimerManager()` -> `{ timeout(fn, ms), interval(fn, ms), clearAll() }`
- `createNotifier({ root, ttlMs })` -> `{ info(msg), success(msg), warn(msg), error(msg) }`
- `createHdfsCluster(config)` -> cluster object with `uploadFile`, `allocateBlock`, `failNode`, `reReplicate`, `reset`, `stats`.
- `createYarnCluster(config)` -> cluster object with `submitJob`, `submitBigJob`, `completeJob`, `drainQueue`, `stats`.
- `createMapReduceEngine({ hdfs, yarn, timers })` -> `runJob`, `simulateFailure`, `stats`.

## Phased Work Plan

### Phase 0: Inventory and invariants
- Document data shapes for nodes, blocks, files, containers, jobs.
- Choose a single storage unit (recommend MB) and map conversions in UI only.
- Define invariants as tests: non-negative resources, RF bounds, queue behavior.

### Phase 1: Extract low-risk utilities
- Move timer management into `hadoop-sim/clock.js`.
- Add deterministic RNG in `hadoop-sim/random.js`.
- Update HDFS/YARN/Full pages to use these utilities.

### Phase 2: Extract HDFS logic
- Create `hadoop-sim/hdfs.js` with:
  - `allocateBlock`, `rollbackFile`, `reReplicateBlocks`, `failNode`, `reset`.
  - `computeHdfsStats` for totals and percent usage.
- Replace HDFS logic in `hdfs_interactive.js` and `hadoop_full.js`.
- Keep DOM rendering in page code; library returns plain data.

### Phase 3: Extract YARN logic
- Create `hadoop-sim/yarn.js` with:
  - `allocateContainer`, `allocateAppMaster`, `submitJob`, `submitBigJob`.
  - `completeJob`, `drainQueue`, `computeYarnStats`.
- Replace YARN logic in `yarn_interactive.js` and `hadoop_full.js`.

### Phase 4: Extract MapReduce logic
- Create `hadoop-sim/mapreduce.js` with:
  - `buildBlockLocations`, `allocateMappers`, `trackProgress`, `handleFailure`.
  - explicit hooks for timers and completion.
- Replace MapReduce logic in `hadoop_full.js` and (later) React simulator.

### Phase 5: Cleanup and adapters
- Add small adapters per page to map DOM events to core library calls.
- Keep UI-specific rendering in each page; no shared DOM code.
- Update README/AGENTS with new library layout.

## Risks and Mitigations
- Behavior drift due to unit conversions: centralize units in core and convert at render time.
- Randomness in UI tests: inject deterministic RNG in tests and core.
- DOM coupling: keep core library pure (no direct DOM reads/writes).

## Test Plan Alignment
- Unit-level: core library tests with deterministic RNG.
- Integration: Playwright tests for each page (already added) to confirm invariants.
