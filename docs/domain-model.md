# Domain model and teaching boundaries

The site contains distinct educational models. It is not a Hadoop performance
simulator, and a guided step is not a scheduler tick.

## Aggregate cluster: HDFS, YARN and mapper progress

`assets/js/hadoop-sim/` stores sizes in MB. Nodes contain storage blocks and CPU /
memory allocations. Files identify logical blocks; physical replicas live on
nodes. YARN containers reserve CPU and memory on one active node.

Each MapReduce job creates one required mapper per logical block. The private
XState job actor governs `queued → running → completed|failed`; actor references
are not exposed in job records. Empty files complete without allocations.

Admission is FIFO among MapReduce jobs. A job receives its ApplicationMaster only
when at least one mapper can also fit. Mappers run in waves as capacity permits.
A mapper prefers a node holding its block but can read a remote replica. Losing
the last accessible input replica fails unfinished work, including remote reads.
A failed mapper can retry if its data remains available. ApplicationMaster
failure terminates the job; ApplicationMaster restart is not simulated.

YARN retains its simple allocation policy. Temporarily unavailable resources
cause queueing; requests that cannot fit any active node are rejected explicitly.
There is no fairness guarantee between standalone YARN and MapReduce workloads.

This model does not execute shuffle/reduce, produce a Gantt timeline, or measure
real throughput. Progress represents completed mapper work and simulated ticks.

## Automatic record pipeline

Two mapper nodes process input splits concurrently; a node can process several
splits in sequence. Each input record emits `(key, 1)`. Buffers spill at their
configured threshold and at split boundaries. Spill contents are sorted by
partition/key and combined locally, then merged using a multi-way merge.
Shuffle transfers each partition from both mappers to its reducer. Reducers merge,
group and sum counts, then show a final output file per partition.

Animations expose concurrency but their timings and network jitter are illustrative.
Changing animation speed or omitting DOM elements does not change the output.
The automatic run has its own XState promise actor and cancellation signal.

## Guided record pipeline

`buildTeachingSteps(state)` constructs explanatory steps and
`applyTeachingStep(state, step)` returns a fresh domain state without using the
DOM. The existing step controller owns the cursor. A step can aggregate records
from both mappers; it need not equal an automatic-pipeline event.

Next advances one step. Play repeats steps, Pause finishes the current step,
and Reset cancels it immediately and starts a fresh session. Waits, flights and
sweeps receive the execution signal so old work cannot affect the new session.

## Shared invariants and reproducibility

- CPU, memory and storage stay between zero and node capacity.
- Replicas occupy distinct nodes; failed nodes receive no new allocations.
- Word counts are conserved through spill, combine, shuffle and reduce.
- Split boundaries are preserved even when a split is smaller than a buffer.
- A job succeeds only after all required mappers complete.
- Reset cancels old jobs, recovery work and notifications in the page adapters.
- The core supports injected clocks and RNG. A managed seed, including zero,
  restarts on reset; a caller-injected RNG must be reset by the caller.
- Seeded core outcomes are repeatable for the same input and interventions at
  the same logical instants. Animation traces across the two pipelines are not
  expected to be identical.

Speculative execution, compression, real network contention, task-attempt
history and Hadoop scheduler fairness are not implemented. The two standalone
root pipeline pages remain separate narrated demonstrations; see
[the page contracts](teaching-contracts.md).
