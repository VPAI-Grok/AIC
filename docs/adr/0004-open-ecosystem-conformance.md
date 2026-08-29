# ADR 0004: Make AIC an Open Conformance Layer

- Status: accepted
- Date: 2026-08-29

## Context

WebMCP, MCP, OpenAPI, browser automation, and future protocols can all expose ways to invoke an application operation. Any of those protocols may eventually add richer schemas, policy hints, lifecycle controls, or confirmation features. AIC would become redundant if its durable value were a temporary wrapper around one protocol.

Teams still need a neutral way to answer a different question: did every entrypoint enforce the same authored business behavior, and is the evidence trustworthy enough for this use case?

## Decision

AIC is an open, protocol-neutral conformance and assurance layer.

1. Protocol adapters convert browser, WebMCP, MCP, and HTTP/OpenAPI execution into one strict observation contract.
2. Authored behavior contracts and reusable conformance packs define the requirements for consequential operation classes.
3. The verifier regenerates proof from raw observations and applies cumulative fail-closed policy for risk, evidence level, scenario coverage, parity, freshness, bindings, and trust.
4. Remote jobs are data-only plans. They bind an exact public origin, deployment identity, and source revision; reject unsafe network targets; disable mutations by default; and do not execute submitted modules or shell commands.
5. Canonical compatibility vectors let independent implementations reproduce digests, decisions, and finding codes.
6. Scheduled signing-key transitions require authorization by the retiring key and proof of possession by the successor key. Compromise uses revocation, not rotation semantics.
7. The repository provides a signed, tamper-evident reference index and checkpoint format. It may carry external receipt references, but it does not present a project-local hash chain as a replacement for standardized or independently operated transparency infrastructure.
8. Contracts, schemas, packs, verifier behavior, compatibility vectors, and local runners remain Apache-2.0 open source. Hosted operation may add convenience and independent trust without making evidence non-portable.

## Trust boundary

A signed claim proves that a trusted key signed exact content. A remote-runner label alone does not prove independence. Policy must separately pin acceptable issuers, runner classes, origin, revision, freshness, and evidence requirements.

The application deployment revision and runner implementation revision are independent bindings. A verifier must not require them to be equal.

## Consequences

- AIC remains useful when a protocol grows new features because it verifies shared business behavior across protocols.
- Applications can change execution protocols without rewriting the domain contract or losing historical evidence.
- Independent verifiers can challenge AIC's own implementation using frozen vectors.
- External adoption and operated infrastructure remain real ecosystem milestones; repository code cannot manufacture them.
- Registry inclusion records a verifiable claim at a point in time and is not certification, warranty, or endorsement.
