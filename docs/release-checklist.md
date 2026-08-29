# Release Checklist

## Workspace gates

- `pnpm check`
- `pnpm build`
- `pnpm test`
- `pnpm test:goldens`
- `pnpm smoke:init`
- `pnpm smoke:adoption`
- `pnpm smoke:mcp`
- `pnpm smoke:mcp:stdio`

## Behavior-assurance gates

- `aic validate behavior` accepts every shipped behavior contract.
- `pnpm --dir examples/nextjs-checkout-demo run aic:verify` passes.
- The proof contains executed evidence, all required observations, zero findings, and passed parity for the checkout scenarios.
- A deliberate WebMCP outcome divergence makes the verifier and CLI fail.
- Checked-in schemas match the public TypeScript types and validator behavior.
- Harnesses are reviewed as trusted code and CI uses least-privilege credentials.
- Documentation does not call an unsigned local proof a production attestation.

## Clean-workspace gate

- verification creates no unexpected tracked diffs;
- intentional generated proof fixtures are deterministic;
- local generated outputs are ignored or cleaned up; and
- README and documentation links target committed files.

## Contract and consumer gates

- runtime and reference-consumer tests pass;
- QA readiness and behavior proof are described as distinct evidence;
- supported-boundary and threat-model documents match the implementation; and
- generated AIC JSON is regenerated and reviewed rather than hand-edited.

## Repository release gates

- license, contribution, security, conduct, changelog, and service files are current;
- root and example READMEs show the current behavior-assurance workflow;
- CI, MCP stdio, and behavior-assurance workflows are enabled; and
- package descriptions and changesets match the release contents.

## npm alpha gates

- package manifests remain public and include publish metadata;
- tarball smoke tests pass;
- package matrix docs match the exact publish wave;
- `@aicorg/webmcp` and behavior assurance are not called published before registry verification; and
- the manual publish workflow completes its configured checks before publishing.

## Not a release claim

Passing these gates does not provide GA stability, non-React support, proof signing, deployment binding, or independent certification.
