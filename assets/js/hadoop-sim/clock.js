function defaultNow() {
  return Date.now();
}

export function createRealClock({
  now = defaultNow,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
} = {}) {
  return {
    now,
    setTimeout: (fn, delay) => setTimeoutFn(fn, delay),
    clearTimeout: (id) => clearTimeoutFn(id),
    setInterval: (fn, delay) => setIntervalFn(fn, delay),
    clearInterval: (id) => clearIntervalFn(id)
  };
}

export function createManualClock(startMs = 0) {
  let now = startMs;
  let nextId = 1;
  const timeouts = new Map();
  const intervals = new Map();

  function scheduleTimeout(fn, delay) {
    const id = nextId++;
    timeouts.set(id, {
      id,
      time: now + Math.max(0, delay),
      fn
    });
    return id;
  }

  function scheduleInterval(fn, delay) {
    const id = nextId++;
    intervals.set(id, {
      id,
      time: now + Math.max(0, delay),
      interval: Math.max(1, delay),
      fn
    });
    return id;
  }

  function clearTimeoutId(id) {
    timeouts.delete(id);
  }

  function clearIntervalId(id) {
    intervals.delete(id);
  }

  function nextDueTime() {
    let next = null;
    timeouts.forEach((entry) => {
      if (next === null || entry.time < next) {
        next = entry.time;
      }
    });
    intervals.forEach((entry) => {
      if (next === null || entry.time < next) {
        next = entry.time;
      }
    });
    return next;
  }

  function advance(ms) {
    const target = now + Math.max(0, ms);

    while (true) {
      const nextTime = nextDueTime();
      if (nextTime === null || nextTime > target) {
        break;
      }

      now = nextTime;

      const dueTimeouts = [];
      timeouts.forEach((entry) => {
        if (entry.time === nextTime) {
          dueTimeouts.push(entry);
        }
      });
      dueTimeouts.forEach((entry) => {
        timeouts.delete(entry.id);
        entry.fn();
      });

      const dueIntervals = [];
      intervals.forEach((entry) => {
        if (entry.time === nextTime) {
          dueIntervals.push(entry);
        }
      });
      dueIntervals.forEach((entry) => {
        entry.fn();
        entry.time = now + entry.interval;
        intervals.set(entry.id, entry);
      });
    }

    now = target;
  }

  return {
    now: () => now,
    setTimeout: scheduleTimeout,
    clearTimeout: clearTimeoutId,
    setInterval: scheduleInterval,
    clearInterval: clearIntervalId,
    advance
  };
}
