# AIC Trust Registry

This directory is the vendor-neutral discovery surface for signed AIC trust claims.

`index.json` is intentionally empty until an issuer submits a signed attestation, a matching public trust-store entry, and reproducible evidence. Registry inclusion means that clients can discover and independently verify the issuer's claim. It is not an AIC certification, proof that a deployment is currently reachable, or an endorsement of the issuer.

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

Reference applications may publish the same artifact at `/.well-known/aic-trust` for origin-scoped discovery.
