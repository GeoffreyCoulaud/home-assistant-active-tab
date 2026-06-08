import { api } from "./api.js";
import { STORAGE_KEYS, MAX_LOGS } from "./constants.js";
import { normalizeSettings } from "./settings.js";
import { appendEntry, makeEntry } from "./logs.js";

export async function getSettings() {
  const data = await api.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(data[STORAGE_KEYS.settings]);
}

export async function saveSettings(settings) {
  await api.storage.local.set({
    [STORAGE_KEYS.settings]: normalizeSettings(settings),
  });
}

export async function getLogs() {
  const data = await api.storage.local.get(STORAGE_KEYS.logs);
  return Array.isArray(data[STORAGE_KEYS.logs]) ? data[STORAGE_KEYS.logs] : [];
}

export async function log(level, message, extra) {
  const logs = await getLogs();
  const entry = makeEntry(level, message, extra, Date.now());
  await api.storage.local.set({
    [STORAGE_KEYS.logs]: appendEntry(logs, entry, MAX_LOGS),
  });
}

export async function clearLogs() {
  await api.storage.local.set({ [STORAGE_KEYS.logs]: [] });
}

export async function getStatus() {
  const data = await api.storage.local.get(STORAGE_KEYS.status);
  return data[STORAGE_KEYS.status] || null;
}

export async function setStatus(status) {
  await api.storage.local.set({ [STORAGE_KEYS.status]: status });
}

export async function getRuntime() {
  const data = await api.storage.local.get(STORAGE_KEYS.runtime);
  return (
    data[STORAGE_KEYS.runtime] || {
      focusedWindowId: null,
      browserFocused: false,
      lastKey: null,
    }
  );
}

export async function setRuntime(runtime) {
  await api.storage.local.set({ [STORAGE_KEYS.runtime]: runtime });
}
