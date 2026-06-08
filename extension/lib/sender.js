// Build the fetch request for a payload. Pure — no network.
export function buildRequest(endpointUrl, headers, payload) {
  return {
    url: endpointUrl,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    },
  };
}

// Perform the request. Returns { ok, status, error }. Verified manually
// (depends on the browser's fetch + granted host permission).
export async function sendReport(endpointUrl, headers, payload) {
  const { url, options } = buildRequest(endpointUrl, headers, payload);
  try {
    const res = await fetch(url, options);
    return { ok: res.ok, status: res.status, error: null };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    return { ok: false, status: 0, error: message };
  }
}
