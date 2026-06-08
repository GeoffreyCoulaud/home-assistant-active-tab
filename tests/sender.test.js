import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest } from "../extension/lib/sender.js";

test("buildRequest produces a POST with JSON content-type and merged headers", () => {
  const { url, options } = buildRequest(
    "https://ha.test/api/webhook/wh",
    { "X-Token": "secret" },
    {
      domain: "example.com",
      url: "https://example.com/",
      visible: true,
      focused: true,
    },
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

test("the app-set JSON content-type wins over a user-supplied Content-Type", () => {
  const { options } = buildRequest(
    "https://ha.test/",
    { "Content-Type": "text/plain" },
    { a: 1 },
  );
  assert.equal(options.headers["Content-Type"], "application/json");
});
