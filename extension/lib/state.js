const REPORTABLE_SCHEMES = ["http:", "https:"];

// True only for real web pages we want to report (http/https).
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

// Build the JSON payload sent to the webhook. Caller guarantees a reportable URL.
export function buildPayload({ url, focused, visible }) {
  const { hostname } = new URL(url);
  return {
    domain: hostname,
    url,
    visible: Boolean(visible),
    focused: Boolean(focused),
  };
}

// Key used to detect whether the reported state actually changed.
export function stateKey(payload) {
  return [payload.url, payload.focused, payload.visible].join("|");
}
