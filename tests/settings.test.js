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
  assert.equal(
    normalizeSettings({ heartbeatSeconds: 10 }).heartbeatSeconds,
    30,
  );
  assert.equal(
    normalizeSettings({ heartbeatSeconds: 45.6 }).heartbeatSeconds,
    46,
  );
  assert.equal(
    normalizeSettings({ heartbeatSeconds: "abc" }).heartbeatSeconds,
    60,
  );
  assert.equal(
    normalizeSettings({ heartbeatSeconds: 90 }).heartbeatSeconds,
    90,
  );
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
  assert.equal(
    originPattern("https://ha.example.com"),
    "https://ha.example.com/*",
  );
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
