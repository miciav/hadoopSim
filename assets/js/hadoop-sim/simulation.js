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
  const rng = deps.rng || (deps.seed ? createSeededRng(deps.seed) : Math.random);
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
    const fresh = createInitialState(config);
    replaceState(state, fresh);
    emitter.emit('simulation:reset', { state });
  }

  function failNode(nodeId) {
    const node = hdfs.failNode(nodeId);
    if (node) {
      mapreduce.handleNodeFailure(nodeId);
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
    hdfs,
    yarn,
    mapreduce,
    on: emitter.on,
    off: emitter.off
  };
}
