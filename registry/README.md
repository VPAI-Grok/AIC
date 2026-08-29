# AIC Trust Registry

This directory is the vendor-neutral discovery surface for signed AIC trust claims.

`index.json` is intentionally empty. AIC currently has zero verified external adopters, and the registry stays empty until a genuine external issuer submits a signed attestation, a matching public trust-store entry, reproducible evidence, and the required adopter disclosure. Registry inclusion means that clients can discover and independently verify the issuer's claim. It is not AIC certification, proof that a deployment is currently reachable, or an endorsement of the issuer.

Build and verify a registry locally:

```bash
aic registry build ./attestations \
  --trust-store ./trust-store.json \
  --registry-id example.registry \
  --out-file ./index.json

aic registry verify ./index.json --trust-store ./trust-store.json
aic registry query ./index.json --origin https://example.com
```

The registry embeds signed attestations so mirrors cannot silently rewrite their deployment, operation, or proof bindings. Consumers pin issuer keys in an AIC trust store and re-run verification instead of trusting the registry host.

The submission path is documented in [Adopter Submission](../docs/adopter-submission.md). Public adopter status is tracked in [ADOPTERS.md](../ADOPTERS.md), and accepted source artifacts belong under [`submissions/`](./submissions/). Conformance-pack results, regenerated proofs, assurance-policy evaluations, and verified evidence bundles can strengthen a submission, but they do not turn the registry into a certificate authority.

The signed reference transparency index is separate from this discovery registry. Recording an attestation in a local append-only chain does not make the registry globally witnessed or authoritative. External receipt references carried by that index are hash-bound metadata and remain `not_checked` until the relevant provider-specific verifier validates them.

Reference applications may publish the same artifact at `/.well-known/aic-trust` for origin-scoped discovery.
