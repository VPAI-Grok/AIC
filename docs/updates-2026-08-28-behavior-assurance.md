# Standards Describe; AIC Proves

WebMCP is good news for AIC. Browser-native tools reduce the need for brittle scraping and give app owners a standard execution surface.

So AIC is not building a rival browser protocol. It is building the open assurance layer beneath every protocol.

The new `aic.behavior/0.1` contract lets a team describe one business operation across human UI, WebMCP, MCP, APIs, and future surfaces. `aic verify` executes or imports observations, checks required and forbidden behavior, compares canonical outcomes, and fails when surfaces diverge.

The first reference proof covers a critical checkout:

- authorized and confirmed success;
- authorization denial before confirmation; and
- confirmation decline without a charge.

Each scenario runs through human UI and WebMCP surface adapters. The proof contains six executed observations, passed parity, canonical SHA-256 digests, and no findings.

The important boundary: this is a deterministic local proof, not a signed production attestation. The open contract and verifier come first. Trusted runners, deployment binding, signatures, transparency logs, reusable conformance packs, and hosted policy can build on that foundation.

That is the durable thesis:

> Standards describe. AIC proves.

- [Behavior Assurance](./behavior-assurance.md)
- [WebMCP with AIC](./webmcp.md)
- [Next.js checkout proof](../examples/nextjs-checkout-demo/README.md)
- [ADR 0002](./adr/0002-behavioral-assurance.md)
