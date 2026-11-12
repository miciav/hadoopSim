// The simulation clock and the visible transfers share the same pause boundary.
export function createPauseGate() {
  let paused = false;
  const pending = new Set();
  return {
    pause() {
      if (paused) return;
      paused = true;
      for (const task of pending) task.hold();
    },
    resume() {
      if (!paused) return;
      paused = false;
      for (const task of pending) task.start();
    },
    wait(ms, signal) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        let remaining = Math.max(0, ms);
        let timer = null;
        let started = 0;
        const cleanup = () => {
          clearTimeout(timer);
          pending.delete(task);
          signal?.removeEventListener('abort', abort);
        };
        const abort = () => {
          cleanup();
          reject(signal.reason);
        };
        const task = {
          hold() {
            if (timer === null) return;
            remaining = Math.max(0, remaining - (performance.now() - started));
            clearTimeout(timer);
            timer = null;
          },
          start() {
            if (timer !== null) return;
            started = performance.now();
            timer = setTimeout(() => {
              cleanup();
              resolve();
            }, remaining);
          }
        };
        pending.add(task);
        signal?.addEventListener('abort', abort, { once: true });
        if (!paused) task.start();
      });
    }
  };
}

export const animationGate = createPauseGate();
if (typeof document !== 'undefined') {
  let heldAnimations = [];
  document.addEventListener('lecture-pause', ({ detail }) => {
    if (detail) {
      animationGate.pause();
      heldAnimations = document
        .getAnimations()
        .filter((a) => a.playState === 'running');
      heldAnimations.forEach((a) => a.pause());
    } else {
      animationGate.resume();
      heldAnimations.forEach((a) => {
        if (a.playState === 'paused') a.play();
      });
      heldAnimations = [];
    }
  });
}
