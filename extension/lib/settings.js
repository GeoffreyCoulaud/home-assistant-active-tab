import {
  DEFAULT_HEARTBEAT_SECONDS,
  MIN_HEARTBEAT_SECONDS,
} from "./constants.js";

/** @type {import('./types.js').Settings} */
export const DEFAULT_SETTINGS = {
  host: "",
  webhookId: "",
  headersText: "",
  heartbeatSeconds: DEFAULT_HEARTBEAT_SECONDS,
};

/**
 * Merge raw stored/form values over defaults, coerce types, clamp heartbeat.
 * Input is untrusted (form fields are strings), so everything is coerced.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {import('./types.js').Settings}
 */
export function normalizeSettings(raw) {
  const merged = /** @type {any} */ ({ ...DEFAULT_SETTINGS, ...(raw || {}) });
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

/**
 * Enough configuration present to attempt a send.
 * @param {import('./types.js').Settings} settings
 * @returns {boolean}
 */
export function isConfigured(settings) {
  return settings.host !== "" && settings.webhookId !== "";
}

/**
 * Turn a user-entered host into an origin: ensure scheme, drop path/trailing slash.
 * @param {string} host
 * @returns {string}
 */
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

/**
 * Permission match pattern for an origin: "https://ha.example.com/*".
 * @param {string} origin
 * @returns {string}
 */
export function originPattern(origin) {
  if (!origin) return "";
  return `${origin}/*`;
}

/**
 * Permission match pattern for the configured host. Single source of truth for
 * the host -> pattern rule, shared by the background check and the popup request.
 * @param {import('./types.js').Settings} settings
 * @returns {string}
 */
export function hostPermissionPattern(settings) {
  return originPattern(hostToOrigin(settings.host));
}

/**
 * Full Home Assistant webhook endpoint, or "" when incomplete.
 * @param {import('./types.js').Settings} settings
 * @returns {string}
 */
export function webhookUrl(settings) {
  const origin = hostToOrigin(settings.host);
  if (!origin || !settings.webhookId) return "";
  return `${origin}/api/webhook/${settings.webhookId}`;
}
