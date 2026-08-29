# Registry Submissions

This directory documents the review surface for external adopter claims. It must not contain private keys, credentials, customer data, or mutable evidence links.

Accepted submissions should use a stable directory name and include only public review metadata that points to immutable evidence. The signed attestation remains the source of truth for origin, revision, operation, proof, and issuer bindings. Review metadata must never override it.

The canonical registry at [`../index.json`](../index.json) stays empty until a genuine external submission passes the process in [Submit an AIC Adopter Claim](../../docs/adopter-submission.md). Test fixtures belong under `tests/`, not in this directory.
