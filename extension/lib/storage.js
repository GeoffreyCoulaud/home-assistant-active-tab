import { api } from "./api.js";
import { STORAGE_KEYS, MAX_LOGS, DEFAULT_RUNTIME } from "./constants.js";
import { normalizeSettings } from "./settings.js";
import { appendEntry, makeEntry } from "./logs.js";

/** @returns {Promise<import('./types.js').Settings>} */
export async function getSettings() {
  const data = await api.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(data[STORAGE_KEYS.settings]);
}

/**
 * @param {import('./types.js').Settings} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await api.storage.local.set({
    [STORAGE_KEYS.settings]: normalizeSettings(settings),
  });
}

/** @returns {Promise<import('./types.js').LogEntry[]>} */
export async function getLogs() {
  const data = await api.storage.local.get(STORAGE_KEYS.logs);
  return Array.isArray(data[STORAGE_KEYS.logs]) ? data[STORAGE_KEYS.logs] : [];
}

/**
 * @param {"info"|"error"} level
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 * @returns {Promise<void>}
 */
export async function log(level, message, extra) {
  const logs = await getLogs();
  const entry = makeEntry(level, message, extra, Date.now());
  await api.storage.local.set({
    [STORAGE_KEYS.logs]: appendEntry(logs, entry, MAX_LOGS),
  });
}

/** @returns {Promise<void>} */
export async function clearLogs() {
  await api.storage.local.set({ [STORAGE_KEYS.logs]: [] });
}

/** @returns {Promise<import('./types.js').Status|null>} */
export async function getStatus() {
  const data = await api.storage.local.get(STORAGE_KEYS.status);
  return data[STORAGE_KEYS.status] || null;
}

/**
 * @param {import('./types.js').Status} status
 * @returns {Promise<void>}
 */
export async function setStatus(status) {
  await api.storage.local.set({ [STORAGE_KEYS.status]: status });
}

/** @returns {Promise<import('./types.js').Runtime>} */
export async function getRuntime() {
  const data = await api.storage.local.get(STORAGE_KEYS.runtime);
  return data[STORAGE_KEYS.runtime] || { ...DEFAULT_RUNTIME };
}

/**
 * @param {import('./types.js').Runtime} runtime
 * @returns {Promise<void>}
 */
export async function setRuntime(runtime) {
  await api.storage.local.set({ [STORAGE_KEYS.runtime]: runtime });
}
