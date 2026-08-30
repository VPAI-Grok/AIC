# AIC Trust 0.1 Interoperability Fixtures

These fixtures freeze the canonical JSON bytes, SHA-256 digests, Ed25519 key ID, signature, binding checks, and stable verifier result codes used by `aic.trust/0.1`.

`valid/bundle.json` contains only public artifacts. Its private signing key was generated ephemerally and discarded; it cannot be used to issue another claim. The key and signature are test data, not a trust anchor.

Implementations should compare stable statuses, check states, finding codes, canonical bytes, and digests. Human-readable finding messages are not compatibility guarantees.

The canonicalization profile is recursive UTF-16 key ordering followed by ECMAScript `JSON.stringify` and UTF-8 encoding. It performs no Unicode normalization. The vectors deliberately cover nested ordering, Unicode, escapes, negative zero, and own properties named `__proto__` or `constructor`; implementations must preserve those properties without prototype mutation or digest collisions.
