# Assurance Policy

`aic.policy/0.1` is the fail-closed reliance gate for AIC proof. It answers whether supplied evidence is sufficient for a consumer's use case; it does not change application authorization.

Rules can match operation IDs, risk levels, and environments. Every matching rule applies cumulatively. With `unmatched: "fail"`, an operation that matches no rule is rejected.

Requirements can include:

- passed proof status;
- allowed evidence levels;
- exact scenario IDs and protocol surface kinds;
- parity for every contract scenario marked required;
- observation and proof freshness;
- raw observations and exact proof regeneration;
- a signed attestation with bounded age and lifetime;
- explicit expected origin and source revision;
- observations captured after deployment;
- allowed issuer IDs, key IDs, runner IDs, and runner kinds; and
- pinned trust-store verification; and
- required inclusion in a separately signed transparency index, with allowed log and signing-key IDs plus an explicit checkpoint rollback defense.

The evaluator recomputes the proof from the supplied contract and raw observations. A producer cannot pass policy by changing only the proof summary.

The actionable `@aicorg/rely` layer is stricter than the general policy evaluator: it requires `unmatched: "fail"` and at least one applicable rule before it can return `allow`. This prevents an allow-by-default or nonmatching policy from becoming execution permission.

To require portable signed history for an operation, add a cumulative requirement to every applicable rule that needs it:

```json
{
  "transparency": {
    "required": true,
    "allowed_log_ids": ["independent.example.log"],
    "allowed_key_ids": ["sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"],
    "maximum_checkpoint_age_seconds": 300,
    "minimum_size": 42,
    "require_consistency": true
  }
}
```

This requires a trusted signed AIC checkpoint, exact attestation inclusion, a checkpoint no older than five minutes, a positive consumer-pinned minimum history size, and consistency with the supplied prior trusted index. `expected_checkpoint_digest` can pin one exact checkpoint instead. A required-transparency rule is invalid unless it declares checkpoint freshness, an exact checkpoint digest, or consistency with a separately consumer-pinned prior checkpoint. `minimum_size` is useful as an additional floor, but a static size alone is not a rollback defense. External receipt references remain metadata unless a provider-specific verifier checks them cryptographically.

```bash
aic policy evaluate ./policies/production-critical.json \
  ./aic-behavior-contract.json ./aic-proof.json \
  --observations ./aic-observations.json \
  --attestation ./aic-attestation.json \
  --trust-store ./consumer-trust-store.json \
  --environment production \
  --expect-origin https://app.example.com \
  --expect-revision 0123456789abcdef0123456789abcdef01234567 \
  --transparency-index ./transparency-index.json \
  --transparency-prior-index ./last-trusted-transparency-index.json \
  --transparency-trust-store ./transparency-log-trust-store.json \
  --out-file ./aic-policy-result.json
```

The command exits nonzero for `failed` or `indeterminate`. `remote` is only a signed runner classification; production policy should also pin an expected issuer, key, and runner identity controlled by the intended operator.
