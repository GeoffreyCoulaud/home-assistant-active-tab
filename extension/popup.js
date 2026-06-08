import { api } from "./lib/api.js";
import { STORAGE_KEYS, MISSING_PERMISSION } from "./lib/constants.js";
import {
  getSettings,
  saveSettings,
  getLogs,
  clearLogs,
  getStatus,
} from "./lib/storage.js";
import {
  normalizeSettings,
  isConfigured,
  hostPermissionPattern,
} from "./lib/settings.js";

const COLOR_ERROR = "#e53935";
const COLOR_OK = "#2e7d32";

// --- tab switching ---
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.panel).classList.add("active");
  });
});

// --- logs ---
const logsEl = document.getElementById("logs");
const toggleBtn = document.getElementById("toggle-logs");
toggleBtn.addEventListener("click", () => {
  const hidden = logsEl.classList.toggle("hidden");
  toggleBtn.textContent = hidden ? "Show logs" : "Hide logs";
});
document.getElementById("clear-logs").addEventListener("click", async () => {
  await clearLogs();
  await renderLogs();
});

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString();
}

async function renderLogs() {
  const logs = await getLogs();
  logsEl.textContent = "";
  for (const entry of logs.slice().reverse()) {
    const li = document.createElement("li");
    li.className = `log ${entry.level}`;
    const status = entry.status != null ? ` [${entry.status}]` : "";
    li.textContent = `${fmtTime(entry.time)} ${entry.message}${status}`;
    logsEl.appendChild(li);
  }
}

async function renderStatus() {
  const settings = await getSettings();
  const configured = isConfigured(settings);
  document.getElementById("st-configured").textContent = configured
    ? "Yes"
    : "No";

  let permText = "n/a";
  if (configured) {
    const pattern = hostPermissionPattern(settings);
    const has = await api.permissions.contains({ origins: [pattern] });
    permText = has ? "Granted" : "Not granted";
  }
  document.getElementById("st-permission").textContent = permText;

  const status = await getStatus();
  if (status) {
    document.getElementById("st-last-event").textContent =
      `${fmtTime(status.time)} — ${status.hostname || "—"}`;
    let res;
    if (status.error === MISSING_PERMISSION) res = "Missing permission";
    else if (status.error) res = `Error: ${status.error}`;
    else if (status.ok) res = `OK (${status.status})`;
    else res = `HTTP ${status.status}`;
    document.getElementById("st-last-result").textContent = res;
  } else {
    document.getElementById("st-last-event").textContent = "—";
    document.getElementById("st-last-result").textContent = "—";
  }
}

async function loadSettingsForm() {
  const settings = await getSettings();
  document.getElementById("host").value = settings.host;
  document.getElementById("webhookId").value = settings.webhookId;
  document.getElementById("headersText").value = settings.headersText;
  document.getElementById("heartbeatSeconds").value = settings.heartbeatSeconds;
}

document
  .getElementById("settings-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("save-msg");
    msg.style.color = "";
    const settings = normalizeSettings({
      host: document.getElementById("host").value,
      webhookId: document.getElementById("webhookId").value,
      headersText: document.getElementById("headersText").value,
      heartbeatSeconds: document.getElementById("heartbeatSeconds").value,
    });
    // reflect the clamped heartbeat back to the field
    document.getElementById("heartbeatSeconds").value =
      settings.heartbeatSeconds;

    if (!isConfigured(settings)) {
      msg.style.color = COLOR_ERROR;
      msg.textContent = "Host and Webhook ID are required.";
      return;
    }

    // Persist settings BEFORE awaiting the permission prompt. In Firefox the
    // permission prompt tears down the popup, so any code after the await may
    // never run. We kick off saveSettings() without awaiting it first (so the
    // storage write is dispatched immediately) and keep permissions.request()
    // as the first await, which preserves the user gesture it requires.
    const pattern = hostPermissionPattern(settings);
    const savePromise = saveSettings(settings);
    let granted;
    try {
      granted = await api.permissions.request({ origins: [pattern] });
    } catch (err) {
      await savePromise;
      msg.style.color = COLOR_ERROR;
      msg.textContent = `Permission request failed: ${err}`;
      return;
    }

    await savePromise;
    if (granted) {
      msg.style.color = COLOR_OK;
      msg.textContent = "Saved. Access granted.";
    } else {
      msg.style.color = COLOR_ERROR;
      msg.textContent =
        "Saved, but host access was not granted — sending will fail until you grant it.";
    }
    await renderStatus();
  });

// live-update while the popup is open
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEYS.logs]) renderLogs();
  if (changes[STORAGE_KEYS.status] || changes[STORAGE_KEYS.settings])
    renderStatus();
});

// initial render
loadSettingsForm();
renderLogs();
renderStatus();
