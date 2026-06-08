// Cross-browser namespace. NOT a polyfill — just a reference to whichever
// global the browser provides. Both Chrome and Firefox expose promise-based
// APIs for the surfaces used here (tabs, windows, storage, alarms, permissions).
// Typed as `any`: the browser API surface is stable and not where our bugs are,
// and typing it fully would require a heavy dependency.
const globalAny = /** @type {any} */ (globalThis);
export const api = globalAny.browser ?? globalAny.chrome;
