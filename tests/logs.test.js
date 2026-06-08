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
