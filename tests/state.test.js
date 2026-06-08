import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isReportableUrl,
  buildPayload,
  stateKey,
} from "../extension/lib/state.js";

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
  const payload = buildPayload({
    url: "https://a.test/",
    focused: 1,
    visible: 0,
  });
  assert.equal(payload.focused, true);
  assert.equal(payload.visible, false);
});

test("stateKey changes when the url changes", () => {
  const a = stateKey(
    buildPayload({ url: "https://a.test/1", focused: true, visible: true }),
  );
  const b = stateKey(
    buildPayload({ url: "https://a.test/2", focused: true, visible: true }),
  );
  assert.notEqual(a, b);
});
