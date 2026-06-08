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
