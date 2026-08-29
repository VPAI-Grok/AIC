# ADR 0003: Keep Trust Claims Portable and Registries Untrusted

- Status: Accepted
- Date: 2026-08-29

## Context

A digest-addressed behavior proof detects content changes but does not identify an issuer or bind the proof to an origin, deployment, and source revision. A centralized certification database would add trust but make AIC a gatekeeper and single point of failure.

## Decision

AIC will use an open, independently verifiable claim format.

- `aic.trust/0.1` statements bind a passed proof to an issuer, runner class, canonical origin, environment, deployment ID, full source revision, behavior contract, and stable domain operation.
- Ed25519 signatures use key IDs derived from the actual public key.
- Consumers choose and pin issuer keys in a trust store with origin, validity, and revocation policy.
- Registries embed the signed attestation and remain untrusted discovery surfaces.
- Verifiers re-derive registry fields and can require the original contract, proof, origin, and revision.
- CI provenance, remote runners, and transparency services may add evidence, but none replaces the open offline verifier.

## Consequences

- AIC claims can be mirrored and verified without trusting the registry operator.
- Open-source and commercial adopters retain their proof and signing portability.
- Key protection, issuer honesty, freshness, and production reachability remain explicit operational trust dependencies.
- Registry inclusion is not endorsement, and a valid issuer signature is not independent certification.
