import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const automation = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const evidence = await importWorkspaceModule(
  "packages/evidence-core/dist/evidence-core/src/index.js"
);

const approved = JSON.parse(
  '{"constructor":{"name":"safe"},"__proto__":{"approved":true}}'
);
const denied = JSON.parse(
  '{"constructor":{"name":"safe"},"__proto__":{"approved":false}}'
);
const approvedCanonical =
  '{"__proto__":{"approved":true},"constructor":{"name":"safe"}}';

test("trust and evidence canonical JSON preserve prototype-named own properties", () => {
  assert.equal(automation.createAICCanonicalJson(approved), approvedCanonical);
  assert.equal(evidence.createAICEvidenceCanonicalJson(approved), approvedCanonical);
  assert.notEqual(
    automation.createAICDigest(approved),
    automation.createAICDigest(denied)
  );
  assert.notEqual(
    evidence.createAICEvidenceDigest(approved),
    evidence.createAICEvidenceDigest(denied)
  );
});

test("canonical JSON rejects accessors, custom prototypes, sparse arrays, and cycles", () => {
  let getterCalled = false;
  const accessor = {};
  Object.defineProperty(accessor, "secret", {
    enumerable: true,
    get() {
      getterCalled = true;
      return "leaked";
    }
  });
  const sparse = new Array(2);
  const cyclic = {};
  cyclic.self = cyclic;

  for (const canonicalize of [
    automation.createAICCanonicalJson,
    evidence.createAICEvidenceCanonicalJson
  ]) {
    assert.throws(() => canonicalize(accessor), /does not evaluate accessors/);
    assert.throws(() => canonicalize(new Date()), /plain data objects/);
    assert.throws(() => canonicalize(sparse), /dense JSON arrays/);
    assert.throws(() => canonicalize(cyclic), /cycles/);
  }
  assert.equal(getterCalled, false);
});
