# AIC Verified: Native WebMCP Evidence You Can Verify

WebMCP gives browsers a native way to expose tools. AIC now adds an open verification chain around the business behavior those tools invoke.

The checkout reference runs success, authorization denial, and confirmation decline through both the rendered human UI and Chrome's real `document.modelContext`. Six observations pass with zero findings. Each run records browser/API compatibility, application state, charge count, and a screenshot digest.

A passed proof can then be bound to an exact origin, environment, deployment, source revision, contract, and domain operation. AIC signs that statement with Ed25519, verifies it against a pinned issuer trust store, and publishes it through an independently verifiable registry format. Trusted CI runs also attach GitHub OIDC/Sigstore provenance to the complete evidence archive.

The important boundary is explicit: a valid signature proves that a trusted issuer signed the exact claim. It does not independently prove that production is live or certified. The next milestone is external adoption and independently operated remote production evidence—not another WebMCP wrapper.

Everything required to create and verify the claim is open source:

- [AIC Verified Trust Layer](./trust-layer.md)
- [Behavior Assurance](./behavior-assurance.md)
- [WebMCP with AIC](./webmcp.md)
- [Native checkout proof](../examples/nextjs-checkout-demo/aic-browser-proof.json)
- [Open registry](../registry/index.json)
