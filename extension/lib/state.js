const REPORTABLE_SCHEMES = ["http:", "https:"];

/**
 * True only for real web pages we want to report (http/https).
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isReportableUrl(url) {
  if (!url) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return REPORTABLE_SCHEMES.includes(parsed.protocol);
}

/**
 * Build the JSON payload sent to the webhook. Caller guarantees a reportable URL.
 * @param {{ url: string, focused?: unknown, visible?: unknown }} active
 * @returns {import('./types.js').Payload}
 */
export function buildPayload({ url, focused, visible }) {
  const { hostname } = new URL(url);
  return {
    hostname,
    url,
    visible: Boolean(visible),
    focused: Boolean(focused),
  };
}

/**
 * Key used to detect whether the reported state actually changed.
 * @param {import('./types.js').Payload} payload
 * @returns {string}
 */
export function stateKey(payload) {
  return [payload.url, payload.focused, payload.visible].join("|");
}

/**
 * Build the persisted last-send status from a payload and a send result.
 * @param {import('./types.js').Payload} payload
 * @param {import('./types.js').SendResult} result
 * @param {number} now - Epoch ms (injected for testability).
 * @returns {import('./types.js').Status}
 */
export function buildStatus(payload, result, now) {
  return {
    time: now,
    hostname: payload.hostname,
    url: payload.url,
    ok: result.ok,
    status: result.status,
    error: result.error,
  };
}
