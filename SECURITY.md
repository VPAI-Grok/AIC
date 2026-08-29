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
- devtools import/export paths
- generated contract artifacts that may influence agent actions

`aic verify --harness` imports and executes local JavaScript with the CLI process's permissions. Review harness code, isolate CI jobs, and use least-privilege credentials. Current proof digests are integrity identifiers, not signatures or runner attestations.

## Expectations

- We will acknowledge reports as quickly as practical.
- We will prefer fixes that preserve deterministic behavior and reviewability.
- Public disclosure should wait until a fix or mitigation is available.
