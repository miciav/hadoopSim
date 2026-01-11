export function createEventEmitter() {
  const listeners = new Map();

  function on(eventName, handler) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName).add(handler);
    return () => off(eventName, handler);
  }

  function off(eventName, handler) {
    const handlers = listeners.get(eventName);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      listeners.delete(eventName);
    }
  }

  function emit(eventName, payload) {
    const handlers = listeners.get(eventName);
    if (!handlers) {
      const anyHandlers = listeners.get('*');
      if (anyHandlers) {
        anyHandlers.forEach((handler) => handler({ eventName, payload }));
      }
      return;
    }
    handlers.forEach((handler) => handler(payload));
    const anyHandlers = listeners.get('*');
    if (anyHandlers) {
      anyHandlers.forEach((handler) => handler({ eventName, payload }));
    }
  }

  function clear() {
    listeners.clear();
  }

  return {
    on,
    off,
    emit,
    clear
  };
}
