import { createEventEmitter } from './events.js';
import { createRealClock } from './clock.js';
import { createSeededRng } from './random.js';
import { createInitialState } from './state.js';
import { createHdfsEngine } from './hdfs.js';
import { createYarnEngine } from './yarn.js';
import { createMapReduceEngine } from './mapreduce.js';

function replaceState(target, source) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, source);
}

export function createSimulation(config = {}, deps = {}) {
  const emitter = deps.emitter || createEventEmitter();
  let seededRng = deps.seed != null ? createSeededRng(deps.seed) : null;
  const rng = deps.rng || (seededRng ? () => seededRng() : Math.random);
  const clock = deps.clock || createRealClock();
  const state = deps.state || createInitialState(config);

  const hdfs = createHdfsEngine({ state, rng, emitter });
  const yarn = createYarnEngine({ state, rng, emitter });
  const mapreduce = createMapReduceEngine({
    state,
    rng,
    clock,
    emitter,
    allocateContainer: yarn.allocateContainer,
    releaseContainer: yarn.releaseContainer
  });

  function reset() {
    mapreduce.stopAll();
    if (seededRng && !deps.rng) seededRng = createSeededRng(deps.seed);
    const fresh = createInitialState(config);
    replaceState(state, fresh);
    emitter.emit('simulation:reset', { state });
  }

  function failNode(nodeId) {
    const node = hdfs.failNode(nodeId);
    if (node) {
      mapreduce.handleNodeFailure(nodeId);
      if (state.nodes.includes(node)) yarn.drainQueue();
    }
    return node;
  }

  const actions = {
    uploadFile: (sizeMb) => hdfs.uploadFile(sizeMb),
    submitYarnJob: (request) => yarn.submitJob(request),
    submitDistributedJob: (requests) => yarn.submitDistributedJob(requests),
    submitMapReduce: (options) => mapreduce.runJob(options),
    failNode,
    reReplicate: () => hdfs.reReplicate(),
    reset
  };

  return {
    state,
    actions,
    dispose: mapreduce.dispose,
    hdfs,
    yarn,
    mapreduce,
    on: emitter.on,
    off: emitter.off
  };
}
