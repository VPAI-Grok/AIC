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
- issuer private-key handling, trust-store policy, revocation, and signed-claim verification
- registry substitution, stale-claim replay, and origin/revision binding
- devtools import/export paths
- generated contract artifacts that may influence agent actions

`aic verify --harness` imports and executes local JavaScript with the CLI process's permissions. Review harness code, isolate CI jobs, and use least-privilege credentials. Behavior-proof digests remain integrity identifiers. `aic.trust/0.1` signatures identify an issuer's exact claim, but do not independently prove origin reachability or runner honesty.

Never commit issuer private keys or upload them with evidence bundles. Consumers should pin public keys separately from the registry they query, require expected origin and revision values, and honor validity and revocation state.

## Expectations

- We will acknowledge reports as quickly as practical.
- We will prefer fixes that preserve deterministic behavior and reviewability.
- Public disclosure should wait until a fix or mitigation is available.
