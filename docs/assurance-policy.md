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
- pinned trust-store verification.

The evaluator recomputes the proof from the supplied contract and raw observations. A producer cannot pass policy by changing only the proof summary.

```bash
aic policy evaluate ./policies/production-critical.json \
  ./aic-behavior-contract.json ./aic-proof.json \
  --observations ./aic-observations.json \
  --attestation ./aic-attestation.json \
  --trust-store ./consumer-trust-store.json \
  --environment production \
  --expect-origin https://app.example.com \
  --expect-revision 0123456789abcdef0123456789abcdef01234567 \
  --out-file ./aic-policy-result.json
```

The command exits nonzero for `failed` or `indeterminate`. `remote` is only a signed runner classification; production policy should also pin an expected issuer, key, and runner identity controlled by the intended operator.
