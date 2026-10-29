/**
 * Console logging functionality for the simulation.
 */

import { el, ELEMENT_IDS } from './selectors.js';
import { CONFIG } from '../config.js';
import { LOG_TYPES } from './presentation.js';

/**
 * Logs a message to the simulation console.
 * @param {string} message - HTML message to log
 * @param {string} type - Log type: 'SYS', 'MAP', 'DISK', 'NET', 'RED'
 */
export function log(message, type = 'SYS') {
  const consoleEl = el(ELEMENT_IDS.CONSOLE_LOG);
  if (!consoleEl) return;
  const div = document.createElement('div');
  const styleClass = LOG_TYPES[type] || LOG_TYPES.SYS;

  div.className = `log-entry ${styleClass}`;

  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  div.innerHTML = `<span class="render-detail-0">[${time}]</span> ${message}`;

  consoleEl.prepend(div);
  while (consoleEl.children.length > CONFIG.MAX_LOG_ENTRIES) {
    consoleEl.lastChild.remove();
  }
}

/**
 * Clears the log and shows initial message.
 */
export function clearLog() {
  const consoleEl = el(ELEMENT_IDS.CONSOLE_LOG);
  if (consoleEl) {
    consoleEl.innerHTML =
      '<div class="log-entry log-sys">> Cluster Daemon Started. Waiting for job...</div>';
  }
}
