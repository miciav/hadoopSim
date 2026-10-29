import { el, HEIGHT_SYNC_GROUPS } from './selectors.js';

/**
 * Initializes height synchronization for layout.
 */
export function initHeightSync() {
  let isAdjusting = false;

  const ro = new ResizeObserver(() => {
    if (isAdjusting) return;

    window.requestAnimationFrame(() => {
      isAdjusting = true;

      HEIGHT_SYNC_GROUPS.forEach((ids) => {
        const elements = ids.map((id) => el(id)).filter((e) => e !== null);
        if (elements.length < 2) return;

        // Reset heights
        elements.forEach((e) => (e.style.minHeight = ''));

        // Measure natural heights
        const heights = elements.map((e) => e.scrollHeight);

        // Apply max height to all
        const maxH = Math.max(...heights);
        elements.forEach((e) => (e.style.minHeight = `${maxH}px`));
      });

      isAdjusting = false;
    });
  });

  // Observe all synced elements
  HEIGHT_SYNC_GROUPS.flat().forEach((id) => {
    const e = el(id);
    if (e) ro.observe(e);
  });
}
