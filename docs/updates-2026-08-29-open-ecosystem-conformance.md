# Open Ecosystem Conformance: The Protocol-Neutral Backbone

AIC's completed Open Ecosystem Conformance technical milestone is an open conformance layer that sits underneath WebMCP, MCP, HTTP/OpenAPI, human UI, and future agent surfaces.

The durable idea is simple:

> Protocols expose operations. AIC proves that the operations preserve the same authored business behavior.

This repository now provides the technical prerequisites for an ecosystem rather than another protocol wrapper:

- one strict observation model for browser, WebMCP, MCP, and HTTP/OpenAPI evidence;
- a data-only remote observation runner with deployment identity and network-safety checks;
- reusable checkout, billing mutation, account deletion, admin mutation, and record CRUD conformance packs;
- cumulative assurance policy for risk, evidence level, scenarios, surfaces, parity, freshness, deployment binding, and trusted claims;
- compatibility vectors for independent verifier implementations;
- signed tamper-evident checkpoints with portable external receipt references; and
- dual-signed scheduled key transitions that preserve historical verification.

The open verifier regenerates proof from raw observations before applying policy. It does not trust a producer's summary, a runner's self-description, or a registry entry merely because it exists.

## What this does not claim

Repository code cannot create independent adoption or independent operation by itself. At this milestone:

- the verified external adopter count remains zero until genuine maintainers submit public evidence;
- the included remote runner is open software, not proof that the AIC project independently observed a particular deployment;
- the reference transparency index is not a global public log or a replacement for standardized transparency services; and
- no hosted history service, dashboard, or certification program is claimed.

Those were the external gates identified at the Open Ecosystem Conformance milestone. The repository has since added the [Trust Fabric](./trust-fabric.md): a canonical consumer preflight, bundled enforcement action, and mirrorable resolver format. Real adopters and runner operators still matter, and completion now also requires external enforcing agent/gateway consumers, an independent verifier, a public resolver plus independent mirror with durable history, and provider-verified transparency receipts. The [adopter submission process](./adopter-submission.md) defines how evidence can enter the ecosystem without lowering the trust boundary.

## Why this survives protocol evolution

If WebMCP or another protocol absorbs richer schemas, confirmation, authorization hints, or lifecycle controls, AIC should use those native capabilities. Cross-surface contracts, reproducible evidence, policy evaluation, portable trust, and historical accountability remain necessary because no single invocation protocol can prove every other entrypoint behaves the same way.

Read the architecture decision in [ADR 0004](./adr/0004-open-ecosystem-conformance.md) and the current boundary in [Supported Today](./supported-today.md).
