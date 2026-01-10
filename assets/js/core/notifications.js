export function createNotifier({ root = document.body, ttlMs = 4000, fadeMs = 300 } = {}) {
  function notify(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    root.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), fadeMs);
    }, ttlMs);
  }

  return {
    info: (message) => notify(message, 'info'),
    success: (message) => notify(message, 'success'),
    warn: (message) => notify(message, 'warning'),
    error: (message) => notify(message, 'error'),
    raw: notify
  };
}
