/**
 * Build the fetch request for a payload. Pure — no network.
 * @param {string} endpointUrl
 * @param {Record<string, string>} headers
 * @param {import('./types.js').Payload} payload
 * @returns {{ url: string, options: RequestInit }}
 */
export function buildRequest(endpointUrl, headers, payload) {
  return {
    url: endpointUrl,
    options: {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  };
}

/**
 * Perform the request. Verified manually (depends on the browser's fetch +
 * granted host permission).
 * @param {string} endpointUrl
 * @param {Record<string, string>} headers
 * @param {import('./types.js').Payload} payload
 * @returns {Promise<import('./types.js').SendResult>}
 */
export async function sendReport(endpointUrl, headers, payload) {
  const { url, options } = buildRequest(endpointUrl, headers, payload);
  try {
    const res = await fetch(url, options);
    return { ok: res.ok, status: res.status, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: message };
  }
}
