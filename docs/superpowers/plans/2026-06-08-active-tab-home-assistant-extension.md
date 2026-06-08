# Active Tab → Home Assistant Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the working ViolentMonkey userscript (`focus-to-ha.user.js`) into a standard, build-free MV3 browser extension (Chromium + Firefox) that reports the active tab to Home Assistant via webhook, configurable from a two-tab popup.

**Architecture:** A background service worker (Chrome) / event page (Firefox) listens to `tabs`/`windows` events — no content scripts. It computes the active-tab state, sends `{ domain, url, visible, focused }` to a Home Assistant webhook with `fetch`, and keeps a ring-buffer log in `storage.local`. A heartbeat re-sends the current state on an `alarms` timer (floor 30 s). A popup configures host, webhook ID, additional headers and heartbeat, requests the host permission at save time, and shows status + logs. All pure logic lives in `extension/lib/*.js` ES modules unit-tested with `node --test`; browser-integration files are verified manually.

**Tech Stack:** Baseline JS/CSS/HTML (no build, no polyfill, no bundler). ES modules. MV3 manifest with dual `service_worker`/`scripts` background. `node:test` for unit tests (dev-only, not shipped). ImageMagick for one-off icon resizing. `web-ext` (via `npx`, optional) for Firefox signing.

**Key facts locked during brainstorming:**
- Detection: background + `tabs`/`windows` APIs, no content script.
- Permissions: `optional_host_permissions`, requested at save time (user gesture) for the configured origin.
- Heartbeat: `alarms`, **floor 30 s** (Chromium clamps `<0.5 min` to 30 s; Firefox honors the value — 30 s is the shared safe floor), **default 60 s**.
- Payload: `{ domain, url, visible, focused }`.
- Edge cases (non-web page like `chrome://`/new tab/extension page, or no focused window): **send nothing** — HA keeps the last state. Consequence: leaving the browser does NOT push `focused:false`; in practice every sent payload has `visible:true, focused:true`.
- Headers: textarea, one `Name: Value` per line.
- Logs: sends + errors + key events, ring buffer ~200, `storage.local`, hidden by default in the Status tab.
- UI language: **English**.
- Install: Firefox permanent → Gecko id `{61d778e5-1738-490d-81d4-441d10ab4592}`, `strict_min_version` `128.0` (covers `optional_host_permissions`, added in Firefox 127).
- Icon: provided `extension-logo.png` (128×128 RGBA) → resized to 16/32/48/128.

**Final file structure:**
```
extension-logo.png                 # source logo (repo root, already present)
focus-to-ha.user.js                # original userscript (kept, untouched)
package.json                       # {"type":"module"} + test script (dev-only)
.gitignore
README.md
extension/
  manifest.json
  background.js                    # SW/event-page entry: event wiring + orchestration
  popup.html
  popup.css
  popup.js
  icons/ icon-16.png icon-32.png icon-48.png icon-128.png
  lib/
    constants.js                   # storage keys, limits, defaults (pure)
    api.js                         # browser/chrome namespace reference
    headers.js                     # parse/format "Name: Value" lines (pure)
    state.js                       # isReportableUrl/buildPayload/stateKey (pure)
    settings.js                    # normalize/validate/host-origin helpers (pure)
    logs.js                        # makeEntry/appendEntry ring buffer (pure)
    sender.js                      # buildRequest (pure) + sendReport (fetch)
    storage.js                     # async storage.local wrappers (uses api)
tests/
  headers.test.js
  state.test.js
  settings.test.js
  logs.test.js
  sender.test.js
tools/
  test-receiver.js                 # dev-only local webhook echo server (Node)
```

**Manual-verification note:** `background.js`, `popup.*`, `manifest.json`, `lib/storage.js` and `lib/sender.js`'s network path depend on the browser runtime and have no headless harness here. They are verified by loading the extension and observing behavior (Tasks 11–12). Every pure module is covered by `node --test` (Tasks 2–7).

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `extension/` and `extension/lib/` and `tests/` and `tools/` directories (via touching first files)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "active-tab-home-assistant",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "description": "Reports the active browser tab to Home Assistant via webhook.",
  "scripts": {
    "test": "node --test"
  }
}
```

Note: `"type": "module"` only affects how Node runs the tests; browsers ignore `package.json`. There are no dependencies and no build step.

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
web-ext-artifacts/
*.xpi
*.zip
```

- [ ] **Step 3: Create directories with placeholder keeps**

Run:
```bash
mkdir -p extension/lib extension/icons tests tools
```

- [ ] **Step 4: Verify Node test runner works on an empty suite**

Run: `node --test`
Expected: exits 0 with `tests 0` (no test files yet) — confirms the runner is available.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: scaffold extension project (no build, node:test)"
```

---

## Task 1: Generate icons from the provided logo

**Files:**
- Create: `extension/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- Source: `extension-logo.png` (128×128, repo root)

- [ ] **Step 1: Resize the logo to the four required sizes**

Run:
```bash
for s in 16 32 48 128; do
  magick extension-logo.png -resize ${s}x${s} extension/icons/icon-${s}.png
done
```

- [ ] **Step 2: Verify the four PNGs exist with correct dimensions**

Run:
```bash
for s in 16 32 48 128; do magick identify extension/icons/icon-${s}.png; done
```
Expected: four lines reporting `... PNG ${s}x${s} ...` for 16, 32, 48, 128.

- [ ] **Step 3: Commit**

```bash
git add extension/icons
git commit -m "feat: add extension icons (16/32/48/128) from logo"
```

---

## Task 2: `constants.js` + `headers.js` (pure, TDD)

**Files:**
- Create: `extension/lib/constants.js`
- Create: `extension/lib/headers.js`
- Test: `tests/headers.test.js`

- [ ] **Step 1: Write the failing test**

`tests/headers.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHeaders, formatHeaders } from "../extension/lib/headers.js";

test("parses a simple Name: Value line", () => {
  assert.deepEqual(parseHeaders("X-Token: abc"), { "X-Token": "abc" });
});

test("splits on the first colon only (values may contain colons)", () => {
  assert.deepEqual(parseHeaders("Authorization: Bearer a:b:c"), {
    Authorization: "Bearer a:b:c",
  });
});

test("trims names and values and ignores blank/invalid lines", () => {
  const input = "  X-One :  1 \n\nno-colon-here\n: empty-name\nX-Two:2";
  assert.deepEqual(parseHeaders(input), { "X-One": "1", "X-Two": "2" });
});

test("empty or nullish input yields an empty object", () => {
  assert.deepEqual(parseHeaders(""), {});
  assert.deepEqual(parseHeaders(undefined), {});
});

test("formatHeaders is the inverse for valid headers", () => {
  const obj = { "X-One": "1", "X-Two": "2" };
  assert.deepEqual(parseHeaders(formatHeaders(obj)), obj);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/headers.test.js`
Expected: FAIL — `Cannot find module '.../extension/lib/headers.js'`.

- [ ] **Step 3: Write `constants.js` then `headers.js`**

`extension/lib/constants.js`:
```js
// Storage keys (all under storage.local).
export const STORAGE_KEYS = {
  settings: "settings",
  logs: "logs",
  status: "status",
  runtime: "runtime",
};

// Heartbeat bounds. 30 s is the shared floor: Chromium clamps < 0.5 min to
// 30 s; Firefox honors the value, so 30 s is safe on both.
export const MIN_HEARTBEAT_SECONDS = 30;
export const DEFAULT_HEARTBEAT_SECONDS = 60;

// Ring-buffer cap for execution logs.
export const MAX_LOGS = 200;

// Name of the recurring heartbeat alarm.
export const HEARTBEAT_ALARM_NAME = "heartbeat";
```

`extension/lib/headers.js`:
```js
// Parse a textarea of "Name: Value" lines into a headers object.
// - Splits each line on the FIRST ":" only (values may contain colons).
// - Trims names and values.
// - Skips blank lines, lines without ":", and lines with an empty name.
export function parseHeaders(text) {
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

// Serialize a headers object back to "Name: Value" lines.
export function formatHeaders(headers) {
  return Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/headers.test.js`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/constants.js extension/lib/headers.js tests/headers.test.js
git commit -m "feat: header line parsing + project constants"
```

---

## Task 3: `state.js` (pure, TDD)

**Files:**
- Create: `extension/lib/state.js`
- Test: `tests/state.test.js`

- [ ] **Step 1: Write the failing test**

`tests/state.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReportableUrl, buildPayload, stateKey } from "../extension/lib/state.js";

test("isReportableUrl accepts http(s) and rejects everything else", () => {
  assert.equal(isReportableUrl("https://example.com/x"), true);
  assert.equal(isReportableUrl("http://example.com"), true);
  assert.equal(isReportableUrl("chrome://newtab"), false);
  assert.equal(isReportableUrl("about:blank"), false);
  assert.equal(isReportableUrl("moz-extension://abc/page.html"), false);
  assert.equal(isReportableUrl("file:///home/x"), false);
  assert.equal(isReportableUrl(""), false);
  assert.equal(isReportableUrl(undefined), false);
  assert.equal(isReportableUrl("not a url"), false);
});

test("buildPayload returns { domain, url, visible, focused }", () => {
  const payload = buildPayload({
    url: "https://example.com/path?x=1",
    focused: true,
    visible: true,
  });
  assert.deepEqual(payload, {
    domain: "example.com",
    url: "https://example.com/path?x=1",
    visible: true,
    focused: true,
  });
});

test("buildPayload coerces visible/focused to booleans", () => {
  const payload = buildPayload({ url: "https://a.test/", focused: 1, visible: 0 });
  assert.equal(payload.focused, true);
  assert.equal(payload.visible, false);
});

test("stateKey changes when the url changes", () => {
  const a = stateKey(buildPayload({ url: "https://a.test/1", focused: true, visible: true }));
  const b = stateKey(buildPayload({ url: "https://a.test/2", focused: true, visible: true }));
  assert.notEqual(a, b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/state.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `state.js`**

`extension/lib/state.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/state.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/state.js tests/state.test.js
git commit -m "feat: active-tab state model (reportable url, payload, change key)"
```

---

## Task 4: `settings.js` (pure, TDD)

**Files:**
- Create: `extension/lib/settings.js`
- Test: `tests/settings.test.js`

- [ ] **Step 1: Write the failing test**

`tests/settings.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  isConfigured,
  hostToOrigin,
  originPattern,
  webhookUrl,
} from "../extension/lib/settings.js";

test("normalizeSettings fills defaults from empty input", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test("normalizeSettings clamps heartbeat to the 30 s floor and rounds", () => {
  assert.equal(normalizeSettings({ heartbeatSeconds: 10 }).heartbeatSeconds, 30);
  assert.equal(normalizeSettings({ heartbeatSeconds: 45.6 }).heartbeatSeconds, 46);
  assert.equal(normalizeSettings({ heartbeatSeconds: "abc" }).heartbeatSeconds, 60);
  assert.equal(normalizeSettings({ heartbeatSeconds: 90 }).heartbeatSeconds, 90);
});

test("normalizeSettings trims host and webhookId", () => {
  const s = normalizeSettings({ host: "  ha.test  ", webhookId: " wh " });
  assert.equal(s.host, "ha.test");
  assert.equal(s.webhookId, "wh");
});

test("isConfigured requires both host and webhookId", () => {
  assert.equal(isConfigured({ host: "ha.test", webhookId: "wh" }), true);
  assert.equal(isConfigured({ host: "", webhookId: "wh" }), false);
  assert.equal(isConfigured({ host: "ha.test", webhookId: "" }), false);
});

test("hostToOrigin adds https, strips path and trailing slash, keeps scheme/port", () => {
  assert.equal(hostToOrigin("ha.example.com"), "https://ha.example.com");
  assert.equal(hostToOrigin("ha.example.com/"), "https://ha.example.com");
  assert.equal(hostToOrigin("http://ha:8123/api/x"), "http://ha:8123");
  assert.equal(hostToOrigin(""), "");
  assert.equal(hostToOrigin("   "), "");
});

test("originPattern appends /* for permission matching", () => {
  assert.equal(originPattern("https://ha.example.com"), "https://ha.example.com/*");
  assert.equal(originPattern(""), "");
});

test("webhookUrl composes the endpoint", () => {
  assert.equal(
    webhookUrl({ host: "ha.example.com", webhookId: "wh123" }),
    "https://ha.example.com/api/webhook/wh123",
  );
  assert.equal(webhookUrl({ host: "", webhookId: "wh" }), "");
  assert.equal(webhookUrl({ host: "ha.test", webhookId: "" }), "");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/settings.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `settings.js`**

`extension/lib/settings.js`:
```js
import { DEFAULT_HEARTBEAT_SECONDS, MIN_HEARTBEAT_SECONDS } from "./constants.js";

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
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/settings.test.js`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/settings.js tests/settings.test.js
git commit -m "feat: settings normalization + host/origin/webhook helpers"
```

---

## Task 5: `logs.js` (pure ring buffer, TDD)

**Files:**
- Create: `extension/lib/logs.js`
- Test: `tests/logs.test.js`

- [ ] **Step 1: Write the failing test**

`tests/logs.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEntry, appendEntry } from "../extension/lib/logs.js";

test("makeEntry builds a timestamped entry and merges extra fields", () => {
  assert.deepEqual(makeEntry("info", "sent example.com", { status: 200 }, 1000), {
    t: 1000,
    level: "info",
    message: "sent example.com",
    status: 200,
  });
});

test("makeEntry works without extra", () => {
  assert.deepEqual(makeEntry("error", "boom", undefined, 5), {
    t: 5,
    level: "error",
    message: "boom",
  });
});

test("appendEntry appends to a copy and does not mutate input", () => {
  const logs = [{ t: 1, level: "info", message: "a" }];
  const next = appendEntry(logs, { t: 2, level: "info", message: "b" }, 10);
  assert.equal(logs.length, 1);
  assert.equal(next.length, 2);
  assert.equal(next[1].message, "b");
});

test("appendEntry keeps only the most recent `max` entries", () => {
  let logs = [];
  for (let i = 0; i < 250; i++) {
    logs = appendEntry(logs, { t: i, level: "info", message: String(i) }, 200);
  }
  assert.equal(logs.length, 200);
  assert.equal(logs[0].message, "50");
  assert.equal(logs[199].message, "249");
});

test("appendEntry tolerates non-array input", () => {
  const next = appendEntry(undefined, { t: 1, level: "info", message: "x" }, 10);
  assert.deepEqual(next, [{ t: 1, level: "info", message: "x" }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/logs.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `logs.js`**

`extension/lib/logs.js`:
```js
import { MAX_LOGS } from "./constants.js";

// Create a log entry. `now` (ms epoch) is injected for testability.
export function makeEntry(level, message, extra, now) {
  return { t: now, level, message, ...(extra || {}) };
}

// Append an entry to a copy, keeping only the most recent `max`.
export function appendEntry(logs, entry, max = MAX_LOGS) {
  const next = Array.isArray(logs) ? logs.slice() : [];
  next.push(entry);
  if (next.length > max) {
    return next.slice(next.length - max);
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/logs.test.js`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/logs.js tests/logs.test.js
git commit -m "feat: bounded execution-log ring buffer"
```

---

## Task 6: `sender.js` (`buildRequest` pure + `sendReport`, partial TDD)

**Files:**
- Create: `extension/lib/sender.js`
- Test: `tests/sender.test.js`

- [ ] **Step 1: Write the failing test (for the pure `buildRequest`)**

`tests/sender.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest } from "../extension/lib/sender.js";

test("buildRequest produces a POST with JSON content-type and merged headers", () => {
  const { url, options } = buildRequest(
    "https://ha.test/api/webhook/wh",
    { "X-Token": "secret" },
    { domain: "example.com", url: "https://example.com/", visible: true, focused: true },
  );
  assert.equal(url, "https://ha.test/api/webhook/wh");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(options.headers["X-Token"], "secret");
  assert.deepEqual(JSON.parse(options.body), {
    domain: "example.com",
    url: "https://example.com/",
    visible: true,
    focused: true,
  });
});

test("user headers cannot override the JSON content-type by default order", () => {
  const { options } = buildRequest("https://ha.test/", {}, { a: 1 });
  assert.equal(options.headers["Content-Type"], "application/json");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sender.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `sender.js`**

`extension/lib/sender.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sender.test.js`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Run the whole suite to confirm everything is green together**

Run: `node --test`
Expected: PASS — all suites (headers, state, settings, logs, sender) pass; `tests` count = 23.

- [ ] **Step 6: Commit**

```bash
git add extension/lib/sender.js tests/sender.test.js
git commit -m "feat: webhook request builder + sender"
```

---

## Task 7: `api.js` + `storage.js` (browser wrappers, no unit tests)

**Files:**
- Create: `extension/lib/api.js`
- Create: `extension/lib/storage.js`

- [ ] **Step 1: Write `api.js`**

`extension/lib/api.js`:
```js
// Cross-browser namespace. NOT a polyfill — just a reference to whichever
// global the browser provides. Both Chrome and Firefox expose promise-based
// APIs for the surfaces used here (tabs, windows, storage, alarms, permissions).
export const api = globalThis.browser ?? globalThis.chrome;
```

- [ ] **Step 2: Write `storage.js`**

`extension/lib/storage.js`:
```js
import { api } from "./api.js";
import { STORAGE_KEYS, MAX_LOGS } from "./constants.js";
import { normalizeSettings } from "./settings.js";
import { appendEntry, makeEntry } from "./logs.js";

export async function getSettings() {
  const data = await api.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(data[STORAGE_KEYS.settings]);
}

export async function saveSettings(settings) {
  await api.storage.local.set({
    [STORAGE_KEYS.settings]: normalizeSettings(settings),
  });
}

export async function getLogs() {
  const data = await api.storage.local.get(STORAGE_KEYS.logs);
  return Array.isArray(data[STORAGE_KEYS.logs]) ? data[STORAGE_KEYS.logs] : [];
}

export async function log(level, message, extra) {
  const logs = await getLogs();
  const entry = makeEntry(level, message, extra, Date.now());
  await api.storage.local.set({
    [STORAGE_KEYS.logs]: appendEntry(logs, entry, MAX_LOGS),
  });
}

export async function clearLogs() {
  await api.storage.local.set({ [STORAGE_KEYS.logs]: [] });
}

export async function getStatus() {
  const data = await api.storage.local.get(STORAGE_KEYS.status);
  return data[STORAGE_KEYS.status] || null;
}

export async function setStatus(status) {
  await api.storage.local.set({ [STORAGE_KEYS.status]: status });
}

export async function getRuntime() {
  const data = await api.storage.local.get(STORAGE_KEYS.runtime);
  return (
    data[STORAGE_KEYS.runtime] || {
      focusedWindowId: null,
      browserFocused: false,
      lastKey: null,
    }
  );
}

export async function setRuntime(runtime) {
  await api.storage.local.set({ [STORAGE_KEYS.runtime]: runtime });
}
```

- [ ] **Step 3: Sanity-check the modules parse (syntax only)**

Run: `node --check extension/lib/api.js && node --check extension/lib/storage.js`
Expected: no output, exit 0 (files are syntactically valid). Runtime behavior is verified in Task 11.

- [ ] **Step 4: Commit**

```bash
git add extension/lib/api.js extension/lib/storage.js
git commit -m "feat: cross-browser api reference + storage.local wrappers"
```

---

## Task 8: `manifest.json`

**Files:**
- Create: `extension/manifest.json`

- [ ] **Step 1: Write `manifest.json`**

`extension/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Active Tab → Home Assistant",
  "version": "2.0.0",
  "description": "Reports the active browser tab to Home Assistant via webhook.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": ["tabs", "storage", "alarms"],
  "optional_host_permissions": ["*://*/*"],
  "background": {
    "service_worker": "background.js",
    "scripts": ["background.js"],
    "type": "module"
  },
  "action": {
    "default_title": "Active Tab → Home Assistant",
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "{61d778e5-1738-490d-81d4-441d10ab4592}",
      "strict_min_version": "128.0"
    }
  }
}
```

Notes for the implementer:
- The dual `service_worker` + `scripts` background is intentional: Chrome uses `service_worker`, Firefox uses `scripts` (event page). Chrome logs a harmless `Unrecognized manifest key 'background.scripts'` warning — that is expected, not an error.
- `optional_host_permissions` requires Firefox ≥ 127 (covered by `strict_min_version: 128.0`) and Chrome ≥ 119.
- `tabs` permission is required to read `tab.url`/`tab.title` for the active tab.

- [ ] **Step 2: Validate JSON syntax**

Run: `node --e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8')); console.log('valid json')"`
Expected: prints `valid json`.

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json
git commit -m "feat: MV3 manifest (Chromium + Firefox, dynamic host permission)"
```

---

## Task 9: `background.js` (event wiring + orchestration)

**Files:**
- Create: `extension/background.js`

- [ ] **Step 1: Write `background.js`**

`extension/background.js`:
```js
import { api } from "./lib/api.js";
import {
  STORAGE_KEYS,
  HEARTBEAT_ALARM_NAME,
  MIN_HEARTBEAT_SECONDS,
} from "./lib/constants.js";
import { isReportableUrl, buildPayload, stateKey } from "./lib/state.js";
import {
  getSettings,
  log,
  setStatus,
  getRuntime,
  setRuntime,
} from "./lib/storage.js";
import {
  isConfigured,
  webhookUrl,
  hostToOrigin,
  originPattern,
} from "./lib/settings.js";
import { parseHeaders } from "./lib/headers.js";
import { sendReport } from "./lib/sender.js";

const WINDOW_ID_NONE = api.windows.WINDOW_ID_NONE;

// Resolve the active tab of a given window.
async function getActiveTab(windowId) {
  if (windowId == null || windowId === WINDOW_ID_NONE) return null;
  try {
    const tabs = await api.tabs.query({ active: true, windowId });
    return tabs && tabs[0] ? tabs[0] : null;
  } catch {
    return null;
  }
}

// Core: compute current state and send if appropriate.
// `force` bypasses the change check (used by the heartbeat).
async function report({ force = false } = {}) {
  const runtime = await getRuntime();
  if (!runtime.browserFocused) return; // no focused window -> send nothing

  const tab = await getActiveTab(runtime.focusedWindowId);
  if (!tab || !isReportableUrl(tab.url)) return; // non-web page -> send nothing

  const payload = buildPayload({ url: tab.url, focused: true, visible: true });
  const key = stateKey(payload);
  if (!force && key === runtime.lastKey) return; // unchanged -> skip

  const settings = await getSettings();
  if (!isConfigured(settings)) {
    await log("error", "Not configured: set host and webhook ID in the popup.");
    return;
  }

  const pattern = originPattern(hostToOrigin(settings.host));
  const hasPerm = await api.permissions.contains({ origins: [pattern] });
  if (!hasPerm) {
    await log(
      "error",
      `Missing host permission for ${pattern}. Open the popup and save settings to grant it.`,
    );
    await setStatus({
      time: Date.now(),
      domain: payload.domain,
      url: payload.url,
      ok: false,
      status: 0,
      error: "missing-permission",
    });
    return;
  }

  const endpoint = webhookUrl(settings);
  const headers = parseHeaders(settings.headersText);
  const result = await sendReport(endpoint, headers, payload);

  runtime.lastKey = key;
  await setRuntime(runtime);

  if (result.ok) {
    await log("info", `Sent ${payload.domain}`, { status: result.status });
  } else if (result.error) {
    await log("error", `Network error sending ${payload.domain}: ${result.error}`);
  } else {
    await log("error", `HTTP ${result.status} sending ${payload.domain}`, {
      status: result.status,
    });
  }
  await setStatus({
    time: Date.now(),
    domain: payload.domain,
    url: payload.url,
    ok: result.ok,
    status: result.status,
    error: result.error,
  });
}

// --- event wiring (registered synchronously at top level) -----------------
api.windows.onFocusChanged.addListener(async (windowId) => {
  const runtime = await getRuntime();
  if (windowId === WINDOW_ID_NONE) {
    runtime.browserFocused = false;
    await setRuntime(runtime);
    return; // left the browser -> send nothing
  }
  runtime.browserFocused = true;
  runtime.focusedWindowId = windowId;
  await setRuntime(runtime);
  await report();
});

api.tabs.onActivated.addListener(async ({ windowId }) => {
  const runtime = await getRuntime();
  if (!runtime.browserFocused || windowId !== runtime.focusedWindowId) return;
  await report();
});

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return; // only react to URL changes
  const runtime = await getRuntime();
  if (!runtime.browserFocused) return;
  if (!tab.active || tab.windowId !== runtime.focusedWindowId) return;
  await report();
});

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM_NAME) return;
  await report({ force: true });
});

api.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[STORAGE_KEYS.settings]) {
    await syncAlarm();
  }
});

// (Re)create the heartbeat alarm from current settings.
async function syncAlarm() {
  const settings = await getSettings();
  const minutes =
    Math.max(MIN_HEARTBEAT_SECONDS, settings.heartbeatSeconds) / 60;
  await api.alarms.clear(HEARTBEAT_ALARM_NAME);
  await api.alarms.create(HEARTBEAT_ALARM_NAME, {
    periodInMinutes: minutes,
    delayInMinutes: minutes,
  });
}

// Initialize focus state + alarm on startup / install / cold SW start.
async function init() {
  try {
    const win = await api.windows.getLastFocused();
    const runtime = await getRuntime();
    runtime.focusedWindowId = win ? win.id : null;
    runtime.browserFocused = win ? Boolean(win.focused) : false;
    await setRuntime(runtime);
  } catch {
    // no window yet — leave defaults
  }
  await syncAlarm();
  await report({ force: true });
}

api.runtime.onStartup.addListener(init);
api.runtime.onInstalled.addListener(init);
init();
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check extension/background.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add extension/background.js
git commit -m "feat: background orchestration (focus/tab events, heartbeat, send)"
```

---

## Task 10: Popup (`popup.html`, `popup.css`, `popup.js`)

**Files:**
- Create: `extension/popup.html`
- Create: `extension/popup.css`
- Create: `extension/popup.js`

- [ ] **Step 1: Write `popup.html`**

`extension/popup.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Active Tab → Home Assistant</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <nav class="tabs">
      <button id="tab-status" class="tab active" data-panel="panel-status">Status</button>
      <button id="tab-settings" class="tab" data-panel="panel-settings">Settings</button>
    </nav>

    <section id="panel-status" class="panel active">
      <dl class="status">
        <dt>Configured</dt><dd id="st-configured">—</dd>
        <dt>Host permission</dt><dd id="st-permission">—</dd>
        <dt>Last event</dt><dd id="st-last-event">—</dd>
        <dt>Last result</dt><dd id="st-last-result">—</dd>
      </dl>
      <div class="logs-header">
        <button id="toggle-logs" type="button">Show logs</button>
        <button id="clear-logs" type="button">Clear</button>
      </div>
      <ul id="logs" class="logs hidden"></ul>
    </section>

    <section id="panel-settings" class="panel">
      <form id="settings-form">
        <label>Home Assistant host
          <input id="host" type="text" placeholder="ha.example.com or https://ha.example.com:8123" />
        </label>
        <label>Webhook ID
          <input id="webhookId" type="text" placeholder="your-webhook-id" />
        </label>
        <label>Additional headers (one "Name: Value" per line)
          <textarea id="headersText" rows="4" placeholder="X-Webhook-Token: secret"></textarea>
        </label>
        <label>Heartbeat interval (seconds, min 30)
          <input id="heartbeatSeconds" type="number" min="30" step="1" value="60" />
        </label>
        <button id="save" type="submit">Save &amp; grant access</button>
        <p id="save-msg" class="msg"></p>
      </form>
    </section>

    <script type="module" src="popup.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `popup.css`**

`extension/popup.css`:
```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

body {
  width: 320px;
  margin: 0;
  padding: 0;
}

.tabs {
  display: flex;
  border-bottom: 1px solid rgba(128, 128, 128, 0.4);
}

.tab {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.tab.active {
  font-weight: 600;
  border-bottom: 2px solid #03a9f4;
}

.panel {
  display: none;
  padding: 12px;
}

.panel.active {
  display: block;
}

.status {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0 0 12px;
}

.status dt {
  color: rgba(128, 128, 128, 1);
}

.status dd {
  margin: 0;
  text-align: right;
  word-break: break-all;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.logs-header button {
  font: inherit;
  cursor: pointer;
}

.logs {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.logs.hidden {
  display: none;
}

.logs .log {
  padding: 2px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  white-space: pre-wrap;
  word-break: break-all;
}

.logs .log.error {
  color: #e53935;
}

form label {
  display: block;
  margin-bottom: 10px;
}

form input,
form textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  font: inherit;
  padding: 4px 6px;
}

#save {
  font: inherit;
  padding: 6px 10px;
  cursor: pointer;
}

.msg {
  min-height: 1.2em;
  margin: 8px 0 0;
  color: #2e7d32;
}
```

- [ ] **Step 3: Write `popup.js`**

`extension/popup.js`:
```js
import { api } from "./lib/api.js";
import { STORAGE_KEYS } from "./lib/constants.js";
import {
  getSettings,
  saveSettings,
  getLogs,
  clearLogs,
  getStatus,
} from "./lib/storage.js";
import {
  normalizeSettings,
  isConfigured,
  hostToOrigin,
  originPattern,
} from "./lib/settings.js";

// --- tab switching ---
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.panel).classList.add("active");
  });
});

// --- logs ---
const logsEl = document.getElementById("logs");
const toggleBtn = document.getElementById("toggle-logs");
toggleBtn.addEventListener("click", () => {
  const hidden = logsEl.classList.toggle("hidden");
  toggleBtn.textContent = hidden ? "Show logs" : "Hide logs";
});
document.getElementById("clear-logs").addEventListener("click", async () => {
  await clearLogs();
  await renderLogs();
});

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString();
}

async function renderLogs() {
  const logs = await getLogs();
  logsEl.textContent = "";
  for (const entry of logs.slice().reverse()) {
    const li = document.createElement("li");
    li.className = `log ${entry.level}`;
    const status = entry.status != null ? ` [${entry.status}]` : "";
    li.textContent = `${fmtTime(entry.t)} ${entry.message}${status}`;
    logsEl.appendChild(li);
  }
}

async function renderStatus() {
  const settings = await getSettings();
  const configured = isConfigured(settings);
  document.getElementById("st-configured").textContent = configured ? "Yes" : "No";

  let permText = "n/a";
  if (configured) {
    const pattern = originPattern(hostToOrigin(settings.host));
    const has = await api.permissions.contains({ origins: [pattern] });
    permText = has ? "Granted" : "Not granted";
  }
  document.getElementById("st-permission").textContent = permText;

  const status = await getStatus();
  if (status) {
    document.getElementById("st-last-event").textContent =
      `${fmtTime(status.time)} — ${status.domain || "—"}`;
    let res;
    if (status.error === "missing-permission") res = "Missing permission";
    else if (status.error) res = `Error: ${status.error}`;
    else if (status.ok) res = `OK (${status.status})`;
    else res = `HTTP ${status.status}`;
    document.getElementById("st-last-result").textContent = res;
  } else {
    document.getElementById("st-last-event").textContent = "—";
    document.getElementById("st-last-result").textContent = "—";
  }
}

async function loadSettingsForm() {
  const s = await getSettings();
  document.getElementById("host").value = s.host;
  document.getElementById("webhookId").value = s.webhookId;
  document.getElementById("headersText").value = s.headersText;
  document.getElementById("heartbeatSeconds").value = s.heartbeatSeconds;
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("save-msg");
  msg.style.color = "";
  const settings = normalizeSettings({
    host: document.getElementById("host").value,
    webhookId: document.getElementById("webhookId").value,
    headersText: document.getElementById("headersText").value,
    heartbeatSeconds: document.getElementById("heartbeatSeconds").value,
  });
  // reflect the clamped heartbeat back to the field
  document.getElementById("heartbeatSeconds").value = settings.heartbeatSeconds;

  if (!isConfigured(settings)) {
    msg.style.color = "#e53935";
    msg.textContent = "Host and Webhook ID are required.";
    return;
  }

  // Request host permission — must be the first await (preserves the user gesture).
  const pattern = originPattern(hostToOrigin(settings.host));
  let granted = false;
  try {
    granted = await api.permissions.request({ origins: [pattern] });
  } catch (err) {
    msg.style.color = "#e53935";
    msg.textContent = `Permission request failed: ${err}`;
    return;
  }

  await saveSettings(settings);
  if (granted) {
    msg.style.color = "#2e7d32";
    msg.textContent = "Saved. Access granted.";
  } else {
    msg.style.color = "#e53935";
    msg.textContent =
      "Saved, but host access was not granted — sending will fail until you grant it.";
  }
  await renderStatus();
});

// live-update while the popup is open
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEYS.logs]) renderLogs();
  if (changes[STORAGE_KEYS.status] || changes[STORAGE_KEYS.settings]) renderStatus();
});

// initial render
loadSettingsForm();
renderLogs();
renderStatus();
```

- [ ] **Step 4: Syntax-check the popup script**

Run: `node --check extension/popup.js`
Expected: no output, exit 0. (Imports of `./lib/api.js` resolve to `undefined` in Node but are not executed by `--check`; runtime is verified in Task 11.)

- [ ] **Step 5: Commit**

```bash
git add extension/popup.html extension/popup.css extension/popup.js
git commit -m "feat: popup UI (Status + Settings tabs, logs, permission request)"
```

---

## Task 11: Dev webhook receiver + manual end-to-end verification

**Files:**
- Create: `tools/test-receiver.js`

- [ ] **Step 1: Write a local webhook echo server (Node, no deps)**

`tools/test-receiver.js`:
```js
// Dev-only: a tiny webhook receiver that logs POST bodies.
// Run: node tools/test-receiver.js   (listens on http://localhost:8123)
import { createServer } from "node:http";

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    console.log(
      new Date().toISOString(),
      req.method,
      req.url,
      "headers=",
      JSON.stringify(req.headers),
      "body=",
      body,
    );
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
});

server.listen(8123, () => console.log("test-receiver listening on http://localhost:8123"));
```

- [ ] **Step 2: Start the receiver**

Run: `node tools/test-receiver.js`
Expected: prints `test-receiver listening on http://localhost:8123`. Leave it running in a terminal.

- [ ] **Step 3: Load the extension in Chromium**

1. Open `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked" → select the `extension/` directory.
Expected: the extension loads. A warning `Unrecognized manifest key 'background.scripts'` may appear — this is expected and harmless.

- [ ] **Step 4: Configure and grant permission**

1. Open the popup → Settings tab.
2. Host: `http://localhost:8123`, Webhook ID: `test`, Heartbeat: `30`.
3. Click "Save & grant access" → accept the permission prompt.
Expected: message "Saved. Access granted."; Status tab shows Configured=Yes, Host permission=Granted.

- [ ] **Step 5: Verify event-driven sends**

1. Switch to another http(s) tab, then back.
2. Watch the `test-receiver` terminal.
Expected: a `POST /api/webhook/test` line whose `body` is JSON `{"domain":"...","url":"...","visible":true,"focused":true}` with the domain of the active tab. Switching to a `chrome://` page or another app produces NO new POST (send-nothing rule).

- [ ] **Step 6: Verify the heartbeat**

Leave a normal tab focused and idle for ~35 seconds.
Expected: a fresh `POST` arrives without any tab/focus change (heartbeat at the 30 s floor).

- [ ] **Step 7: Verify logs + status in the popup**

Open the popup → Status tab → click "Show logs".
Expected: entries like `HH:MM:SS Sent <domain> [200]`. "Hide logs" hides them again; "Clear" empties the list. Last result shows `OK (200)`.

- [ ] **Step 8: Verify the missing-permission path**

1. In `chrome://extensions`, open the extension's "Details" → "Site access" and remove the `localhost` host access (or change the host in settings to one you don't grant).
2. Trigger a tab switch.
Expected: Status "Last result" = "Missing permission" and a log entry `Missing host permission for http://localhost:8123/*...`. Re-saving in the popup and granting restores sending.

- [ ] **Step 9: Load the extension temporarily in Firefox**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on…" → select `extension/manifest.json`.
3. Repeat Steps 4–7 in Firefox.
Expected: identical behavior. (Temporary add-ons disappear on Firefox restart — permanent install is covered in Task 12.)

- [ ] **Step 10: Stop the receiver and commit the tool**

Stop `test-receiver.js` (Ctrl-C), then:
```bash
git add tools/test-receiver.js
git commit -m "test: dev webhook receiver + manual e2e verification"
```

---

## Task 12: README + Firefox permanent-install instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

`README.md`:
````markdown
# Active Tab → Home Assistant

Browser extension (Chromium + Firefox, Manifest V3) that reports the active
browser tab to Home Assistant via a webhook. Configure it from the toolbar popup.

Payload sent on each report:
```json
{ "domain": "example.com", "url": "https://example.com/page", "visible": true, "focused": true }
```

It sends when the active tab's URL changes and on a heartbeat (configurable,
minimum 30 s). It sends nothing for non-web pages (`chrome://`, new tab,
extension pages) or when no browser window is focused — Home Assistant keeps the
last reported state.

## Configuration (popup → Settings)

- **Home Assistant host** — e.g. `ha.example.com` or `https://ha.example.com:8123`.
- **Webhook ID** — the `/api/webhook/<id>` identifier.
- **Additional headers** — one `Name: Value` per line (optional).
- **Heartbeat interval** — seconds, minimum 30 (default 60).

Click **Save & grant access** and accept the permission prompt so the extension
may call your Home Assistant host.

## Install — Chromium (Chrome / Edge / Brave …)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.

(A harmless `Unrecognized manifest key 'background.scripts'` warning is expected.)

## Install — Firefox (permanent)

Temporary loading (`about:debugging` → *Load Temporary Add-on* → pick
`extension/manifest.json`) works but is forgotten on restart. For a permanent
install the add-on must be signed:

1. Get API credentials from <https://addons.mozilla.org/developers/addon/api/key/>.
2. From the `extension/` folder, sign for self-distribution (no source build —
   `web-ext` only packages and signs):
   ```bash
   cd extension
   npx web-ext sign --channel=unlisted \
     --api-key=YOUR_JWT_ISSUER --api-secret=YOUR_JWT_SECRET
   ```
3. Install the produced `.xpi` via `about:addons` → gear → **Install Add-on From File…**.

Alternatively, on Firefox Developer Edition / ESR you may set
`xpinstall.signatures.required = false` in `about:config` and install the
unsigned `.xpi` directly.

Gecko extension id: `{61d778e5-1738-490d-81d4-441d10ab4592}` (minimum Firefox 128).

## Development

- No build step. All code is baseline JS/CSS/HTML, no polyfills.
- Run unit tests (pure logic): `npm test` (or `node --test`).
- Manual webhook receiver for local testing: `node tools/test-receiver.js`.

The original ViolentMonkey userscript is kept at `focus-to-ha.user.js` for reference.
````

- [ ] **Step 2: Verify the test script alias works**

Run: `npm test`
Expected: runs `node --test`; all unit suites pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with install + Firefox signing instructions"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** detection (Task 9), dynamic host permission (Tasks 8/10), heartbeat with 30 s floor (Tasks 4/9), payload `{domain,url,visible,focused}` (Task 3), send-nothing edge cases (Task 9), `Name: Value` headers (Task 2/10), logs sends+errors ring buffer (Tasks 5/7), Status+Settings popup with hidden logs (Task 10), English UI (Task 10), Firefox permanent install + Gecko id (Tasks 8/12), icons from logo (Task 1), no build / no polyfill (whole plan). ✓
- **Type consistency:** `normalizeSettings`, `hostToOrigin`, `originPattern`, `webhookUrl`, `isConfigured` (settings.js); `isReportableUrl`, `buildPayload`, `stateKey` (state.js); `makeEntry`, `appendEntry` (logs.js); `buildRequest`, `sendReport` (sender.js); `getSettings/saveSettings/getLogs/log/clearLogs/getStatus/setStatus/getRuntime/setRuntime` (storage.js) — names used identically in `background.js` and `popup.js`. ✓
- **Placeholder scan:** no TODO/“handle edge cases”/“similar to” — every code step contains full code. ✓
- **Open dependency:** none. The logo asset already exists at repo root (confirmed 128×128).
````
