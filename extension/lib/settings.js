import {
  DEFAULT_HEARTBEAT_SECONDS,
  MIN_HEARTBEAT_SECONDS,
} from "./constants.js";

export const DEFAULT_SETTINGS = {
  host: "",
  webhookId: "",
  headersText: "",
  heartbeatSeconds: DEFAULT_HEARTBEAT_SECONDS,
};

// Merge raw stored/form values over defaults, coerce types, clamp heartbeat.
export function normalizeSettings(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  let seconds = Number(merged.heartbeatSeconds);
  if (!Number.isFinite(seconds)) seconds = DEFAULT_HEARTBEAT_SECONDS;
  seconds = Math.max(MIN_HEARTBEAT_SECONDS, Math.round(seconds));
  return {
    host: String(merged.host || "").trim(),
    webhookId: String(merged.webhookId || "").trim(),
    headersText: String(merged.headersText || ""),
    heartbeatSeconds: seconds,
  };
}

// Enough configuration present to attempt a send.
export function isConfigured(settings) {
  return settings.host !== "" && settings.webhookId !== "";
}

// Turn a user-entered host into an origin: ensure scheme, drop path/trailing slash.
export function hostToOrigin(host) {
  const trimmed = String(host || "").trim();
  if (trimmed === "") return "";
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return "";
  }
}

// Permission match pattern for an origin: "https://ha.example.com/*".
export function originPattern(origin) {
  if (!origin) return "";
  return `${origin}/*`;
}

// Full Home Assistant webhook endpoint, or "" when incomplete.
export function webhookUrl(settings) {
  const origin = hostToOrigin(settings.host);
  if (!origin || !settings.webhookId) return "";
  return `${origin}/api/webhook/${settings.webhookId}`;
}
