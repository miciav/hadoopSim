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
