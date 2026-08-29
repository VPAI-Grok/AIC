# Transparency and Key Rotation

AIC includes an offline/reference transparency format and scheduled signing-key transition workflow. These make evidence portable and tampering detectable without claiming that a repository file is a globally witnessed public log.

## Signed reference index

An `aic.transparency/0.1` index is an append-only hash chain of attestations, scheduled key transitions, or revocation records. A signed checkpoint binds the log ID, entry count, head digest, issue time, and prior checkpoint digest.

Create a log signing key with `aic trust keygen`, using the log ID as the issuer ID, then initialize the index:

```bash
aic transparency init \
  --log-id example.transparency \
  --private-key ./log-private.pem \
  --out-file ./transparency-index.json
```

Appending requires the head and size the operator observed. This optimistic concurrency check prevents silently overwriting a newer history:

```bash
aic transparency append ./transparency-index.json attestation ./checkout-attestation.json \
  --expect-size 0 \
  --expect-head null \
  --trust-store ./log-trust-store.json \
  --private-key ./log-private.pem \
  --out-file ./transparency-index.next.json
```

Verify the checkpoint, entries, artifacts, and chain, then compare histories:

```bash
aic transparency verify ./transparency-index.next.json --trust-store ./log-trust-store.json
aic transparency consistency ./transparency-index.json ./transparency-index.next.json \
  --trust-store ./log-trust-store.json
```

An entry may bind metadata references to external transparency receipts. AIC retains and hashes those references but reports them `not_checked`; the relevant external verifier must validate the receipt. The format is designed to carry profiles such as [COSE Receipts (RFC 9942)](https://www.rfc-editor.org/rfc/rfc9942.html), [SCITT Architecture (RFC 9943)](https://www.rfc-editor.org/rfc/rfc9943.html), or [Sigstore bundles](https://github.com/sigstore/rekor-tiles/blob/main/CLIENTS.md) without impersonating those systems.

## Scheduled key rotation

Scheduled rotation is not revocation. It keeps the retiring key active through a bounded `valid_until`, introduces the successor at `valid_from`, preserves unrelated keys exactly, and refuses to broaden allowed origins.

The transition statement binds the prior and next trust-store digests. It must be signed by the retiring key (`authorizing`) and successor key (`proof_of_possession`):

```bash
aic trust rotate prepare \
  --prior-trust-store ./trust-store.json \
  --retiring-private-key ./old-private.pem \
  --successor-private-key ./new-private.pem \
  --issuer-id example.release \
  --transition-id rotate-2026-09 \
  --effective-at 2026-09-01T00:00:00.000Z \
  --retire-at 2026-09-08T00:00:00.000Z \
  --next-trust-store ./trust-store.next.json \
  --transition-out ./key-transition.json

aic trust transition verify \
  --prior-trust-store ./trust-store.json \
  --next-trust-store ./trust-store.next.json \
  --transition ./key-transition.json
```

Use revocation for compromise. A revoked key invalidates reliance on its claims according to consumer policy; do not disguise compromise as a scheduled transition merely to preserve a green history.
