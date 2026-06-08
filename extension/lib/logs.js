import { MAX_LOGS } from "./constants.js";

/**
 * Create a log entry. `now` (ms epoch) is injected for testability.
 * @param {"info"|"error"} level
 * @param {string} message
 * @param {Record<string, unknown>|undefined} extra
 * @param {number} now
 * @returns {import('./types.js').LogEntry}
 */
export function makeEntry(level, message, extra, now) {
  return /** @type {import('./types.js').LogEntry} */ ({
    time: now,
    level,
    message,
    ...(extra || {}),
  });
}

/**
 * Append an entry to a copy, keeping only the most recent `max`.
 * @param {import('./types.js').LogEntry[]} logs
 * @param {import('./types.js').LogEntry} entry
 * @param {number} [max]
 * @returns {import('./types.js').LogEntry[]}
 */
export function appendEntry(logs, entry, max = MAX_LOGS) {
  const next = Array.isArray(logs) ? logs.slice() : [];
  next.push(entry);
  if (next.length > max) {
    return next.slice(next.length - max);
  }
  return next;
}
