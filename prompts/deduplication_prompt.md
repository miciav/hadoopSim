Role
You are a senior JavaScript engineer tasked with extracting a shared JS library from multiple static HTML pages. JSX must remain untouched.

Objective
Deduplicate shared HDFS/YARN/MapReduce logic into a common library without changing runtime behavior.

Context
- Pages live in the repo root and load logic from `assets/js/`.
- The React/Babel simulator uses JSX and must remain untouched.
- Pages must remain static-host friendly (no build step).

Inputs
- Existing page scripts under `assets/js/`.
- Playwright tests under `tests/`.

Outputs
- New shared core library under `assets/js/hadoop-sim/`.
- Updated page scripts importing the shared core.
- Updated tests and docs as needed.

Constraints
- Do not move or modify JSX code.
- Do not add build steps or bundlers.
- Do not change UI layout or markup beyond wiring to the shared library.
- Keep changes minimal and safe.

Target Library Shape (suggested)
```
assets/js/hadoop-sim/
  events.js
  random.js
  clock.js
  config.js
  state.js
  hdfs.js
  yarn.js
  mapreduce.js
  simulation.js
  index.js
```

Suggested APIs
- `createSimulation(config, deps)` -> `{ state, actions, on, off }`
- `createManualClock()` for deterministic tests
- `createSeededRng()` for deterministic tests

Plan
Phase 0 — Inventory & Invariants
- Document data shapes for nodes, blocks, files, containers, and jobs.
- Standardize storage units in core (recommend MB) and convert in UI only.
- Define invariants as tests: no negative resources, replication factor bounds, queue behavior.

Phase 1 — Extract Low-Risk Utilities
- Move timing into `hadoop-sim/clock.js`.
- Add deterministic RNG in `hadoop-sim/random.js`.
- Update pages to use these utilities without changing behavior.

Phase 2 — Extract HDFS Logic
- Move `allocateBlock`, `rollbackFile`, `reReplicateBlocks`, `failNode`, `reset` into `hadoop-sim/hdfs.js`.
- Update `hdfs_interactive.js` and `hadoop_full.js` to use core HDFS.

Phase 3 — Extract YARN Logic
- Move container allocation, queue handling, job completion to `hadoop-sim/yarn.js`.
- Update `yarn_interactive.js` and `hadoop_full.js` to use core YARN.

Phase 4 — Extract MapReduce Logic
- Move block locality, mapper allocation, progress tracking, and failure handling to `hadoop-sim/mapreduce.js`.
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
- Shared core library under `assets/js/hadoop-sim/`.
- Updated page scripts importing the shared core.
- Tests updated or added to validate invariants.
- Minimal, safe changes only; preserve UI behavior.
