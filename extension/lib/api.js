// Cross-browser namespace. NOT a polyfill — just a reference to whichever
// global the browser provides. Both Chrome and Firefox expose promise-based
// APIs for the surfaces used here (tabs, windows, storage, alarms, permissions).
export const api = globalThis.browser ?? globalThis.chrome;
