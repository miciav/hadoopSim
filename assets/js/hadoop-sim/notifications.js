export function createNotifier(delay) {
  const notices = new Set();
  const region = document.createElement('div');
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-relevant', 'additions text');
  document.body.appendChild(region);

  function notify(message, type) {
    const element = document.createElement('div');
    element.className = `notification ${type}`;
    element.textContent = message;
    region.appendChild(element);
    const notice = { element, timer: null };
    notices.add(notice);
    notice.timer = setTimeout(() => {
      element.style.opacity = '0';
      notice.timer = setTimeout(() => {
        element.remove();
        notices.delete(notice);
      }, 300);
    }, delay);
  }

  function clear() {
    notices.forEach(({ element, timer }) => {
      clearTimeout(timer);
      element.remove();
    });
    notices.clear();
  }

  return { notify, clear };
}
