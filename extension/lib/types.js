// Shared JSDoc type definitions for the extension. No runtime code — this
// module exists so the shapes persisted in storage and passed between modules
// have a single source of truth that `tsc --checkJs` can enforce.

/**
 * User-configurable settings, persisted under the "settings" storage key.
 * @typedef {object} Settings
 * @property {string} host - Home Assistant host, with or without a scheme.
 * @property {string} webhookId - Webhook identifier.
 * @property {string} headersText - Extra headers as "Name: Value" lines.
 * @property {number} heartbeatSeconds - Heartbeat interval (>= the floor).
 */

/**
 * Ephemeral focus/dedup state, persisted under the "runtime" key so it survives
 * service-worker restarts.
 * @typedef {object} Runtime
 * @property {number|null} focusedWindowId - Id of the OS-focused window, if any.
 * @property {boolean} browserFocused - Whether a browser window has focus.
 * @property {string|null} lastKey - Change key of the last reported state.
 */

/**
 * The JSON body POSTed to the Home Assistant webhook.
 * @typedef {object} Payload
 * @property {string} hostname - Active tab hostname (URL.hostname).
 * @property {string} url - Active tab full URL.
 * @property {boolean} visible - Whether the tab is visible.
 * @property {boolean} focused - Whether the browser window has focus.
 */

/**
 * Outcome of a webhook send.
 * @typedef {object} SendResult
 * @property {boolean} ok - Whether the response status was 2xx.
 * @property {number} status - HTTP status code (0 when the request threw).
 * @property {string|null} error - Error message, or null on success.
 */

/**
 * Last-send summary shown in the popup, persisted under the "status" key.
 * @typedef {object} Status
 * @property {number} time - Epoch ms of the attempt.
 * @property {string} hostname - Reported hostname.
 * @property {string} url - Reported URL.
 * @property {boolean} ok - Whether the send succeeded.
 * @property {number} status - HTTP status code.
 * @property {string|null} error - Error message, or null on success.
 */

/**
 * One execution-log entry in the ring buffer (the "logs" key).
 * @typedef {object} LogEntry
 * @property {number} time - Epoch ms.
 * @property {"info"|"error"} level - Severity.
 * @property {string} message - Human-readable message.
 * @property {number} [status] - Optional HTTP status.
 */

export {};
