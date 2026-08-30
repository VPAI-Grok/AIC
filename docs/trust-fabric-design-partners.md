# Trust Fabric v1 design-partner and runner intake

Trust Fabric v1 needs independently controlled producers, observers, and consumers. AIC-owned demos do not count toward the external reliance milestone.

## Application design partner

- [ ] Name one consequential operation and its stable domain `operation_id`.
- [ ] Identify the production origin, deployment identifier, full source revision, and every human or agent surface for that operation.
- [ ] Assign an application owner and a separate relying-policy owner.
- [ ] Author and review the behavior contract, including success, denial, confirmation, business-failure, and recovery scenarios where applicable.
- [ ] Select and review an applicable versioned conformance-pack mapping.
- [ ] Expose a data-only observation target. Mutations require a bounded canary plus explicit operator grant.
- [ ] Publish raw observations, regenerated proof, signed deployment-bound attestation, and immutable artifact references.
- [ ] Keep issuer private keys and evidence credentials outside repositories and uploaded bundles.
- [ ] Agree to publish pass and failure history for at least 30 days without describing registry inclusion as certification.

## Independent runner operator

- [ ] Be operationally and cryptographically independent from AIC and the application owner.
- [ ] Publish the runner ID, operator contact, software revision, signing key ID, operating policy, and supported adapters.
- [ ] Run only declarative, data-only AIC remote jobs; reject executable modules, shell commands, callbacks, private-network targets, redirects, implicit secrets, and unbounded capture.
- [ ] Deny mutations by default; require both operation-specific canary scope and operator authorization; never retry an uncertain mutation.
- [ ] Bind each receipt to the exact plan, observations, deployment identity, runner identity, and runner revision.
- [ ] Document cadence, freshness objective, incident reporting, revocation, and out-of-band key-compromise recovery.
- [ ] Provide a public status/history endpoint or portable signed history mirror.

## Relying agent or client

- [ ] Own and review a fail-closed assurance policy and a separately distributed pinned trust store.
- [ ] Pin the exact operation, origin, deployment, revision, issuer, key, and independent runner expected for the decision.
- [ ] Integrate the [`AIC reliance gate`](../actions/aic-rely/README.md) or an equivalent local verifier before execution.
- [ ] Treat only `allowed: true` as permission to proceed. Missing, invalid, stale, mismatched, revoked, or indeterminate evidence blocks the operation.
- [ ] Preserve the complete canonical reliance decision, including its embedded policy evaluation when available, for audit.
- [ ] Exercise and publish at least one intentional blocked-action canary before claiming reliance.

## Public milestone evidence

For each participant, record the organization, public repository or service, operation IDs, production origin, controlling party, runner operator, consumer integration, first verified date, 30-day history location, and known limitations in `ADOPTERS.md`. Independence must describe separate control, not merely separate software processes.
