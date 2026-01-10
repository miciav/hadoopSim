export function createTimerManager({
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
} = {}) {
  const timeouts = new Set();
  const intervals = new Set();

  function timeout(callback, delay) {
    const id = setTimeoutFn(() => {
      timeouts.delete(id);
      callback();
    }, delay);
    timeouts.add(id);
    return id;
  }

  function interval(callback, delay) {
    const id = setIntervalFn(callback, delay);
    intervals.add(id);
    return id;
  }

  function clearIntervalId(id) {
    clearIntervalFn(id);
    intervals.delete(id);
  }

  function clearTimeoutId(id) {
    clearTimeoutFn(id);
    timeouts.delete(id);
  }

  function clearAll() {
    timeouts.forEach((id) => clearTimeoutFn(id));
    intervals.forEach((id) => clearIntervalFn(id));
    timeouts.clear();
    intervals.clear();
  }

  return {
    timeout,
    interval,
    clearAll,
    clearInterval: clearIntervalId,
    clearTimeout: clearTimeoutId
  };
}
