# `@aicorg/verify-core`

Minimal deterministic verification primitives for AIC trust consumers.

This package contains canonical JSON and digest handling, behavior-proof regeneration, signed-attestation verification, cumulative fail-closed assurance-policy evaluation, and signed transparency-index verification. It depends only on `@aicorg/spec` plus Node.js cryptography; it does not load AIC scanning, authoring, filesystem discovery, or TypeScript compiler code.

Most applications should use `@aicorg/rely`, which combines these primitives into a canonical, exact-request-bound decision and provides the current-time assertion guard. Import `@aicorg/verify-core` directly when implementing another verifier or interoperability harness.
