import { createRealClock } from './clock.js';

// Both teaching views use this lifecycle; scheduling/placement stays in YARN.
export function createYarnAutoCompletion(
  sim,
  {
    clock = createRealClock(),
    durationMs = () => 8000,
    onComplete = () => {},
    onFailed = () => {}
  } = {}
) {
  const pending = new Map();
  let generation = 0;

  function clear() {
    generation++;
    for (const { timer } of pending.values()) clock.clearTimeout(timer);
    pending.clear();
  }

  const unsubscribe = [
    sim.on('simulation:reset', clear),
    sim.on('yarn:allocated', ({ container }) => {
      if (
        container.isMapReduce ||
        container.isApplicationMaster ||
        pending.has(container.name)
      )
        return;
      const version = generation;
      const timer = clock.setTimeout(() => {
        pending.delete(container.name);
        if (
          version !== generation ||
          !sim.state.nodes.some(
            (n) => !n.failed && n.containers.includes(container)
          )
        )
          return;
        sim.yarn.releaseContainer(container.name);
        if (version === generation) onComplete(container);
      }, durationMs());
      pending.set(container.name, { container, timer });
    }),
    sim.on('hdfs:nodeFailed', ({ nodeId }) => {
      const node = sim.state.nodes.find((n) => n.id === nodeId);
      for (const container of node?.containers || []) {
        const entry = pending.get(container.name);
        if (!entry) continue;
        clock.clearTimeout(entry.timer);
        pending.delete(container.name);
        onFailed(container);
      }
    })
  ];

  return {
    dispose() {
      clear();
      unsubscribe.forEach((off) => off());
    }
  };
}
