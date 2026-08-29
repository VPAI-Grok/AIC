# Security Policy

## Reporting

Please do not open public GitHub issues for security-sensitive problems.

Report security issues privately through GitHub Security Advisories if enabled for the repository, or contact the maintainer directly with:

- a clear description of the issue
- impact assessment
- reproduction steps or a minimal proof of concept
- any proposed mitigation

## Scope Notes

The highest-sensitivity areas in this repository are:

- bootstrap provider integrations and credential handling
- CLI apply behavior
- trusted behavior-harness module execution
- imported observation authenticity and proof tampering
- conformance-pack substitution and semantically incorrect application mappings
- data-only evidence-plan and remote-job validation
- HTTP/OpenAPI and MCP adapter parsing, projection, redirect, SSRF, DNS-rebinding, and bounded-capture behavior
- remote-runner secret resolution, exact deployment binding, mutation authorization, and receipt signing
- assurance-policy proof regeneration, cumulative rule evaluation, freshness, and issuer/key/runner identity constraints
- interoperability-suite canonicalization, digest, signature, registry, and stable-code compatibility
- issuer private-key handling, trust-store policy, revocation, and signed-claim verification
- signed-checkpoint, append-only consistency, fork, and external-receipt handling in the reference transparency index
- scheduled dual-signed key transitions, prior/next trust-store binding, retiring-key validity, and origin-scope preservation
- registry substitution, stale-claim replay, and origin/revision binding
- devtools import/export paths
- generated contract artifacts that may influence agent actions

`aic verify --harness` imports and executes local JavaScript with the CLI process's permissions. Review harness code, isolate CI jobs, and use least-privilege credentials. Behavior-proof digests remain integrity identifiers. `aic.trust/0.1` signatures identify an issuer's exact claim, but do not independently prove origin reachability or runner honesty.

Evidence plans and remote jobs must remain data-only. Do not add executable modules, shell commands, callbacks, inline secrets, or unbounded capture. Remote targets must resolve only to pinned public addresses, and redirects must be rejected. Mutation is denied by default and requires exact operation/canary and operator grants; never retry a mutation whose outcome is uncertain. Treat a self-hosted `@aicorg/runner-remote` instance as independent only when a genuinely separate operator controls its environment and signing key. AIC does not currently provide that independently operated hosted service.

Assurance-policy evaluation must regenerate proof from the supplied observations, apply every matching rule cumulatively, and fail when no rule matches. Consumers that rely on a particular producer must pin the allowed issuer, key, and runner identities rather than accept only a self-declared runner kind.

Never commit issuer private keys or upload them with evidence bundles. Consumers should pin public keys separately from the registry they query, require expected origin and revision values, and honor validity and revocation state.

The AIC transparency index is an offline/reference hash-chain and signed-checkpoint profile, not a globally witnessed public log. External receipt records are artifact-bound metadata and remain unverified until a provider-specific verifier checks them. Scheduled dual-signed rotation is for planned maintenance; suspected compromise requires revocation and out-of-band recovery, not automatic replacement authorized by the potentially compromised key.

## Expectations

- We will acknowledge reports as quickly as practical.
- We will prefer fixes that preserve deterministic behavior and reviewability.
- Public disclosure should wait until a fix or mitigation is available.
