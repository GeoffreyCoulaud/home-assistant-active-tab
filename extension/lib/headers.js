/**
 * Parse a textarea of "Name: Value" lines into a headers object.
 * - Splits each line on the FIRST ":" only (values may contain colons).
 * - Trims names and values.
 * - Skips blank lines, lines without ":", and lines with an empty name.
 * @param {string|null|undefined} text
 * @returns {Record<string, string>}
 */
export function parseHeaders(text) {
  /** @type {Record<string, string>} */
  const headers = {};
  if (!text) return headers;
  for (const rawLine of String(text).split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (name === "") continue;
    headers[name] = value;
  }
  return headers;
}

/**
 * Serialize a headers object back to "Name: Value" lines. Round-trip partner of
 * parseHeaders; exercised by the unit tests.
 * @param {Record<string, string>} headers
 * @returns {string}
 */
export function formatHeaders(headers) {
  return Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}
