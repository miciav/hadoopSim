import { createRealClock } from './clock.js';

export function createHdfsRecovery(
  sim,
  { clock = createRealClock(), delayMs = 1500, onRecovered = () => {} } = {}
) {
  const timers = new Set();
  function clear() {
    timers.forEach((id) => clock.clearTimeout(id));
    timers.clear();
  }
  const unsubscribe = [
    sim.on('simulation:reset', clear),
    sim.on('hdfs:nodeFailed', () => {
      const id = clock.setTimeout(() => {
        timers.delete(id);
        onRecovered(sim.actions.reReplicate());
      }, delayMs);
      timers.add(id);
    })
  ];
  return {
    dispose() {
      clear();
      unsubscribe.forEach((off) => off());
    }
  };
}
