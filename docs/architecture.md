# Hadoop Simulator Architecture

## Goals

- A testable cluster library and separate record-pipeline models; pure domain logic has no DOM/React dependency.
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

## Library API

- `createSimulation(config, deps)` -> `{ state, actions, on, off, dispose, hdfs, yarn, mapreduce }`
- `config.nodes` can define heterogeneous nodes (overrides nodeCount/nodeTemplate)
- `actions`: `uploadFile`, `submitYarnJob`, `submitDistributedJob`, `submitMapReduce`, `failNode`, `reReplicate`, `reset`
- `deps`: `{ seed, rng, clock, emitter }` for deterministic tests.

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

## Presentation and built-in skins

Each public document loads `assets/js/skin.js` before its body. It reads the
allowlisted `hadoopSim.skin` preference once and sets `data-skin` on the root;
Hadoop is the default when storage is absent, invalid or inaccessible.
Only `index.html` exposes the native Skin selector. Changes affect the homepage
and subsequent page loads. Existing simulator documents keep their original
skin, including when another tab changes the preference or the browser restores
a document from its back-forward cache. Storage failures leave the homepage
selection usable, but persistence across navigation cannot be guaranteed.

CSS is loaded in this order: `assets/css/base.css`, a structural stylesheet under
`assets/css/pages/`, then the four independent stylesheets under
`assets/css/skins/`. The common base supplies semantic tokens and accessibility
rules; each skin supplies its palette, spacing, typography and layout hierarchy.
The original mockups remain development references and are not published.

To adjust a skin, edit its CSS and use the common `--sim-*` tokens. Page-specific
structure belongs in the page stylesheet; values derived from simulation data
(such as progress widths and file series identities) stay in renderers. Do not
import the selector into a simulation, branch algorithms on the active skin, or
copy simulation code into a theme. Pipeline height synchronization and visual
constants live under `pipeline-dual-nodes/dom/`, separate from domain config.
Complex diagrams provide keyboard-accessible local scrolling on small screens.

Equivalent controls use a shared per-skin scale: `--sim-control-size`,
`--sim-control-line`, `--sim-control-padding`, `--sim-control-height` and
`--sim-control-shadow`. The title scale uses `--sim-title-size`; ordinary panels
use `--sim-panel-padding`. Focus has no decorative control shadow, and disabled
controls never inherit an active shadow. Diagram-node label insets stay separate.
Resource bars use `cpu-fill`, `memory-fill` and `storage-fill` in every cluster
renderer. Warning/error classes take precedence over the normal resource color.
