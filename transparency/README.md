# AIC Offline Transparency Profile

`aic.transparency/0.1` is a small, offline/reference transparency profile for AIC artifacts. It uses domain-separated entry hashes, a linear append-only chain, and Ed25519-signed checkpoints verified with a separately pinned AIC trust store.

It is not a competing global transparency protocol. SCITT Architecture is RFC 9943 and COSE Receipts is RFC 9942. Production systems can attach receipt metadata for profiles such as `scitt-rfc9942` or `sigstore-bundle`, while continuing to verify the underlying AIC artifact with the open verifier.

An `external_receipts` item contains only a provider, profile, reference, and required artifact digest. The offline verifier binds that metadata to the local entry but reports the external receipt as `not_checked`; its presence is not proof that a receipt is valid. A provider-specific verifier must cryptographically validate the receipt before relying on it.

The local chain detects deletion, replacement, and reordering relative to a checkpoint already known to the consumer. A log operator can still create two separately valid histories. Global reliance therefore requires checkpoint publication, monitoring, gossip/witnessing, or an external transparency system.

No public checkpoint is checked into this directory until AIC operates a stable log key and monitoring process. Empty or fabricated transparency claims would be misleading.
