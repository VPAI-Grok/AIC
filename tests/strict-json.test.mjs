import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const { parseAICStrictJson } = await importWorkspaceModule("packages/spec/dist/index.js");

test("strict JSON accepts ordinary nested JSON without changing its value", () => {
  const text = '{"outer":{"escaped":"\\u0061","items":[true,null,-1.25e2]}}';
  assert.deepEqual(parseAICStrictJson(text), JSON.parse(text));
});

test("strict JSON rejects literal and escape-equivalent duplicate members", () => {
  for (const text of [
    '{"statement":1,"statement":2}',
    '{"statement":1,"st\\u0061tement":2}',
    '{"nested":{"signature":1,"signature":2}}'
  ]) {
    assert.throws(() => parseAICStrictJson(text), /Duplicate JSON object member/);
  }
});

test("strict JSON preserves native syntax rejection", () => {
  for (const text of ['{"a":01}', '{"a":true false}', '[1,]', '"unterminated']) {
    assert.throws(() => parseAICStrictJson(text), SyntaxError);
  }
});

test("strict JSON enforces finite numbers and explicit complexity limits", () => {
  assert.throws(() => parseAICStrictJson("1e999"), /finite range/);
  assert.throws(
    () => parseAICStrictJson('{"a":{"b":1}}', { maxDepth: 1 }),
    /maxDepth 1/
  );
  assert.throws(
    () => parseAICStrictJson("[1,2,3]", { maxNodes: 3 }),
    /maxNodes 3/
  );
  assert.deepEqual(
    parseAICStrictJson("[1,2,3]", { maxDepth: 1, maxNodes: 4 }),
    [1, 2, 3]
  );
});
