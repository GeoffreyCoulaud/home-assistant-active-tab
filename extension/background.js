import { api } from "./lib/api.js";
import {
  STORAGE_KEYS,
  HEARTBEAT_ALARM_NAME,
  MIN_HEARTBEAT_SECONDS,
} from "./lib/constants.js";
import { isReportableUrl, buildPayload, stateKey } from "./lib/state.js";
import {
  getSettings,
  log,
  setStatus,
  getRuntime,
  setRuntime,
} from "./lib/storage.js";
import {
  isConfigured,
  webhookUrl,
  hostToOrigin,
  originPattern,
} from "./lib/settings.js";
import { parseHeaders } from "./lib/headers.js";
import { sendReport } from "./lib/sender.js";

const WINDOW_ID_NONE = api.windows.WINDOW_ID_NONE;

// Resolve the active tab of a given window.
async function getActiveTab(windowId) {
  if (windowId == null || windowId === WINDOW_ID_NONE) return null;
  try {
    const tabs = await api.tabs.query({ active: true, windowId });
    return tabs && tabs[0] ? tabs[0] : null;
  } catch {
    return null;
  }
}

// Core: compute current state and send if appropriate.
// `force` bypasses the change check (used by the heartbeat).
async function report({ force = false } = {}) {
  const runtime = await getRuntime();
  if (!runtime.browserFocused) return; // no focused window -> send nothing

  const tab = await getActiveTab(runtime.focusedWindowId);
  if (!tab || !isReportableUrl(tab.url)) return; // non-web page -> send nothing

  const payload = buildPayload({ url: tab.url, focused: true, visible: true });
  const key = stateKey(payload);
  if (!force && key === runtime.lastKey) return; // unchanged -> skip

  const settings = await getSettings();
  if (!isConfigured(settings)) {
    await log("error", "Not configured: set host and webhook ID in the popup.");
    return;
  }

  const pattern = originPattern(hostToOrigin(settings.host));
  const hasPerm = await api.permissions.contains({ origins: [pattern] });
  if (!hasPerm) {
    await log(
      "error",
      `Missing host permission for ${pattern}. Open the popup and save settings to grant it.`,
    );
    await setStatus({
      time: Date.now(),
      domain: payload.domain,
      url: payload.url,
      ok: false,
      status: 0,
      error: "missing-permission",
    });
    return;
  }

  const endpoint = webhookUrl(settings);
  const headers = parseHeaders(settings.headersText);
  const result = await sendReport(endpoint, headers, payload);

  runtime.lastKey = key;
  await setRuntime(runtime);

  if (result.ok) {
    await log("info", `Sent ${payload.domain}`, { status: result.status });
  } else if (result.error) {
    await log("error", `Network error sending ${payload.domain}: ${result.error}`);
  } else {
    await log("error", `HTTP ${result.status} sending ${payload.domain}`, {
      status: result.status,
    });
  }
  await setStatus({
    time: Date.now(),
    domain: payload.domain,
    url: payload.url,
    ok: result.ok,
    status: result.status,
    error: result.error,
  });
}

// --- event wiring (registered synchronously at top level) -----------------
api.windows.onFocusChanged.addListener(async (windowId) => {
  const runtime = await getRuntime();
  if (windowId === WINDOW_ID_NONE) {
    runtime.browserFocused = false;
    await setRuntime(runtime);
    return; // left the browser -> send nothing
  }
  runtime.browserFocused = true;
  runtime.focusedWindowId = windowId;
  await setRuntime(runtime);
  await report();
});

api.tabs.onActivated.addListener(async ({ windowId }) => {
  const runtime = await getRuntime();
  if (!runtime.browserFocused || windowId !== runtime.focusedWindowId) return;
  await report();
});

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return; // only react to URL changes
  const runtime = await getRuntime();
  if (!runtime.browserFocused) return;
  if (!tab.active || tab.windowId !== runtime.focusedWindowId) return;
  await report();
});

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM_NAME) return;
  await report({ force: true });
});

api.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[STORAGE_KEYS.settings]) {
    await syncAlarm();
  }
});

// (Re)create the heartbeat alarm from current settings.
async function syncAlarm() {
  const settings = await getSettings();
  const minutes =
    Math.max(MIN_HEARTBEAT_SECONDS, settings.heartbeatSeconds) / 60;
  await api.alarms.clear(HEARTBEAT_ALARM_NAME);
  await api.alarms.create(HEARTBEAT_ALARM_NAME, {
    periodInMinutes: minutes,
    delayInMinutes: minutes,
  });
}

// Initialize focus state + alarm on startup / install / cold SW start.
async function init() {
  try {
    const win = await api.windows.getLastFocused();
    const runtime = await getRuntime();
    runtime.focusedWindowId = win ? win.id : null;
    runtime.browserFocused = win ? Boolean(win.focused) : false;
    await setRuntime(runtime);
  } catch {
    // no window yet — leave defaults
  }
  await syncAlarm();
  await report({ force: true });
}

api.runtime.onStartup.addListener(init);
api.runtime.onInstalled.addListener(init);
init();
