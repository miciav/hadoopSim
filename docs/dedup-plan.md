# Deduplication — implemented 11 November 2026

## One view per teaching purpose

The maintained catalog now has five entries: guided MapReduce, continuous
MapReduce, focused HDFS, focused YARN, and the combined cluster laboratory.

Ecosystem and Unified Cluster had the same conceptual purpose. They now use
`hadoop_full.html` and `assets/js/hadoop_full.js` as their single implementation.
The old Ecosystem URL redirects to the `replicated` preset. The two previous
configurations remain explicit scenarios in `hadoop-sim/scenarios.js`:

| Scenario                      | Block size | Replicas | Storage per node |
| ----------------------------- | ---------- | -------- | ---------------- |
| Compact (former Unified)      | 256 MB     | 2        | 10 GB            |
| Replicated (former Ecosystem) | 128 MB     | 3        | 100 GB           |

The combined view retains configurable upload sizes, per-file MapReduce,
YARN simple/distributed workloads, queue accounting, locality, failures and reset.
It uses the visible AM/map container blocks, with resource requests and mapper
progress. Changing scenario intentionally starts a fresh simulation.

## Shared logic

| Responsibility                      | Single implementation             | Clients                        |
| ----------------------------------- | --------------------------------- | ------------------------------ |
| Placement, replication, capacity    | `hadoop-sim/hdfs.js`              | HDFS and cluster               |
| Allocation and request queues       | `hadoop-sim/yarn.js`              | YARN and cluster               |
| Mapper scheduling, AM, failures     | `hadoop-sim/mapreduce.js`         | Cluster                        |
| Demonstration container lifetime    | `hadoop-sim/yarn-lifecycle.js`    | YARN and cluster               |
| Delayed HDFS re-replication         | `hadoop-sim/failure-recovery.js`  | HDFS and cluster               |
| Record aggregation/sort/merge rules | `pipeline-dual-nodes/combiner.js` | Guided and automatic pipelines |

YARN completion timers cancel on reset and failed-node containers are never
later announced as successfully completed. File upload handling is no longer
copied between the small/large buttons of the same page. The cluster uses one
locality predicate, excluding the AM from mapper locality counts.

## Kept deliberately distinct

HDFS and YARN show different resources and phenomena; they share models, not
the entire layout. Guided and automatic pipelines share record transformations,
but retain different advancement units and concurrency. Their orchestrators
are not interchangeable. The two older standalone narratives remain accessible
by their original direct URLs, outside the main catalog; their circular-buffer
presentation and scripted timelines have not been replaced by the modular model.

## Removed

The duplicate React cluster renderer and its stylesheet are removed, together
with the now-unused React, React DOM and Scheduler runtime dependencies. No
simulation depends on React. Legacy links are preserved by a local redirect.

## Verification

Model tests cover both scenario outputs (1 GiB produces 4/8 logical blocks and
8/24 placed replicas), queued YARN completion, reset with reused names, failure
cancellation and recovery timing. Browser checks cover both scenarios, legacy
routing, per-file jobs, blocks, YARN workloads, failure/reset, and the distinct
HDFS, YARN and pipeline views. Production assets are bundled locally.
