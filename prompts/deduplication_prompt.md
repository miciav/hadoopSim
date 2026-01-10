You are a senior JavaScript engineer. Your task is to deduplicate shared logic across multiple static HTML pages in this repository by extracting a shared JS library. The JSX code must be excluded from this extraction.

Context
- Pages live in the repo root and load logic from `assets/js/`.
- The React/Babel simulator uses JSX and must remain untouched.
- We want a shared library for common HDFS/YARN/MapReduce logic while keeping pages static-host friendly.

Primary Goal
- Create a shared JS library that centralizes common logic (timers, notifications, HDFS, YARN, MapReduce, stats) without changing runtime behavior.

Non-Goals
- Do not move or modify JSX code.
- Do not add build steps or bundlers.
- Do not change UI layout or markup beyond wiring to the shared library.

Target Library Shape (suggested)
```
assets/js/core/
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

Suggested APIs
- `createTimerManager()` -> `{ timeout(fn, ms), interval(fn, ms), clearAll() }`
- `createNotifier({ root, ttlMs })` -> `{ info, success, warn, error }`
- `createHdfsCluster(config)` -> cluster object with `uploadFile`, `allocateBlock`, `failNode`, `reReplicate`, `reset`, `stats`
- `createYarnCluster(config)` -> cluster object with `submitJob`, `submitBigJob`, `completeJob`, `drainQueue`, `stats`
- `createMapReduceEngine({ hdfs, yarn, timers })` -> `runJob`, `simulateFailure`, `stats`

Execution Plan
Phase 0 — Inventory & Invariants
- Document data shapes for nodes, blocks, files, containers, and jobs.
- Standardize storage units in core (recommend MB) and convert in UI only.
- Define invariants as tests: no negative resources, replication factor bounds, queue behavior.

Phase 1 — Extract Low-Risk Utilities
- Move timer management into `core/timers.js`.
- Move notification helper into `core/notifications.js` with DOM root injection.
- Add `core/random.js` to inject deterministic RNG for tests.
- Update pages to use these utilities without changing behavior.

Phase 2 — Extract HDFS Logic
- Move `allocateBlock`, `rollbackFile`, `reReplicateBlocks`, `failNode`, `reset` into `core/hdfs.js`.
- Add `computeHdfsStats` to `core/stats.js`.
- Update `hdfs_interactive.js` and `hadoop_full.js` to use core HDFS.

Phase 3 — Extract YARN Logic
- Move container allocation, queue handling, job completion to `core/yarn.js`.
- Add `computeYarnStats` to `core/stats.js`.
- Update `yarn_interactive.js` and `hadoop_full.js` to use core YARN.

Phase 4 — Extract MapReduce Logic
- Move block locality, mapper allocation, progress tracking, and failure handling to `core/mapreduce.js`.
- Update `hadoop_full.js` (and later the React simulator) to use the core MapReduce engine.

Phase 5 — Cleanup & Adapters
- Add small adapters per page to map DOM events to core calls.
- Keep DOM rendering in each page; core must be pure (no direct DOM reads/writes).
- Update README/AGENTS with library layout.

Risk Mitigations
- Prevent behavior drift by keeping unit conversions and randomness deterministic.
- Ensure no DOM coupling: core returns data, pages render it.

Testing Requirements
- Keep existing Playwright smoke tests passing.
- Add or update tests to cover invariants:
  - HDFS replication factor when space is available
  - No allocations to failed nodes
  - YARN resources never exceed totals
  - Queue drains when resources free up
  - MapReduce mappers = blocks and locality preference
  - Failure rescheduling behavior
  - Reset clears pending timers

Deliverables
- Shared core library under `assets/js/core/`.
- Updated page scripts importing the shared core.
- Tests updated or added to validate invariants.
- Minimal, safe changes only; preserve UI behavior.
