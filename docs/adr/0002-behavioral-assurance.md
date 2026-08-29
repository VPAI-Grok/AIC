# ADR 0002: Make Behavioral Assurance the Durable AIC Layer

- Status: Accepted
- Date: 2026-08-28

## Context

WebMCP and other protocols can expand to include richer schemas, confirmation, validation, lifecycle, skills, and policy hints. If AIC differentiates only by filling temporary protocol gaps, standards work can make the product redundant.

The enduring problem is not protocol metadata. Teams need independent evidence that every supported entrypoint for a consequential business action enforces the same requirements and outcomes.

## Decision

AIC will be a protocol-neutral behavioral assurance layer.

- Native protocol fields and lifecycle controls take precedence over duplicate AIC representations.
- Human UI, WebMCP, MCP, APIs, and future surfaces map to a stable domain `operation_id`.
- AIC behavior contracts define requirements and scenarios independently of transport.
- Harnesses or imported systems produce explicit observations.
- The open verifier checks outcomes, requirements, forbidden behavior, and cross-surface parity, then emits a digest-addressed proof.
- Readiness metadata and executed proof remain distinct claims.
- The current WebMCP adapter remains a compatibility and fail-closed safety bridge, not the product moat.

## Consequences

- AIC remains useful if WebMCP implements current wrapper features.
- New protocols can become surfaces without redesigning business contracts.
- Contract packs, evidence adapters, CI policies, proof history, and conformance become the ecosystem strategy.
- Local proofs must be described honestly until signing, deployment binding, attested runners, and transparency mechanisms exist.
- Open contracts, schemas, verifier, and local runners are required for neutral adoption; commercial value should sit in hosted trust and operational tooling.
