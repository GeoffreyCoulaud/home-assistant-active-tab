import { MAX_LOGS } from "./constants.js";

// Create a log entry. `now` (ms epoch) is injected for testability.
export function makeEntry(level, message, extra, now) {
  return { t: now, level, message, ...(extra || {}) };
}

// Append an entry to a copy, keeping only the most recent `max`.
export function appendEntry(logs, entry, max = MAX_LOGS) {
  const next = Array.isArray(logs) ? logs.slice() : [];
  next.push(entry);
  if (next.length > max) {
    return next.slice(next.length - max);
  }
  return next;
}
