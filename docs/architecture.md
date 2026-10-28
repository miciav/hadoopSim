# Hadoop Simulator Architecture

## Goals
- Single, testable JS library (no DOM/React dependencies).
- High cohesion per subsystem (HDFS, YARN, MapReduce) and low coupling via a shared state model.
- Deterministic simulations through injected RNG/Clock.

## Data Model (core units)
- All sizes are in **MB** inside the core library.
- `Node`: { id, name, cpuTotal, cpuUsed, memoryTotalMb, memoryUsedMb, storageTotalMb, storageUsedMb, blocks[], containers[], failed }
- `File`: { name, sizeMb, blocks[] }
- `Block`: { id, fileName, index, sizeMb, isReplica }
- `Container`: { name, cpu, memoryMb, jobId, isMapReduce, blockIds[] }
- `MapReduceJob`: { name, fileName, status, mappers[], progress }

## Core Invariants
- HDFS replication: replicas are on distinct active nodes when space exists.
- Storage/cpu/memory usage never below 0 or above totals.
- MapReduce allocates one mapper per block; locality preferred.
- Failed nodes never receive new allocations.

## Library API (planned)
- `createSimulation(config, deps)` -> `{ state, actions, on, off }`
- `config.nodes` can define heterogeneous nodes (overrides nodeCount/nodeTemplate)
- `actions`: `uploadFile`, `submitYarnJob`, `submitMapReduce`, `failNode`, `reset`
- `deps`: `{ rng, clock, emitter }` for deterministic tests.

## Didactic boundaries

The cluster views model HDFS placement, YARN resources, and mapper progress;
they do not model shuffle or reducers. Their MapReduce job lifecycle is a private
XState actor, while exposed job records remain serializable. Mapper requests run
in waves and queued jobs are admitted FIFO as resources become available. A lost
input block fails the job. A failed ApplicationMaster also fails it: restart of
the ApplicationMaster is not modeled.

The detailed pipeline is a distinct record-level model. Its automatic and guided
views retain different units of progress. The guided model's pure step transitions
are in `assets/js/pipeline-teaching/model.js`; visual animation is cancellable on
reset. See `docs/teaching-contracts.md` for page-specific scope and limitations.

The build bundles browser entry points into `dist/`; GitHub Pages publishes that
static directory after checks pass. Run `npm run build` and `npm run preview` to
serve the same artifacts locally.
