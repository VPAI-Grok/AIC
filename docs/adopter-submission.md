# Submit an AIC Adopter Claim

The AIC adopter list is evidence-first. It exists to help humans and agents find real implementations without asking them to trust a logo wall.

## Before submitting

Your application must be owned or controlled by the submitting team. Pick one consequential operation that is available through two or more surfaces, such as a human UI plus WebMCP, MCP, or HTTP/OpenAPI. Route those surfaces to the same domain operation and author the behavior contract explicitly.

Do not submit generated, inferred, AI-suggested, placeholder, or demonstration-only action contracts as production evidence.

## Required public artifacts

- application name, repository or documentation URL, and exact HTTPS origin;
- immutable application source revision and deployment identity;
- AIC behavior contract and applicable conformance-pack binding;
- raw observation bundle and passed behavior proof;
- deployment-bound signed attestation;
- public trust-store entry restricted to the submitted origin;
- verifier and conformance output produced from the public artifacts; and
- maintainer consent to list the application.

Secrets, session cookies, personal data, payment details, and other sensitive payloads must not be included. Redact at collection time, not after signing.

## Review process

1. Run the repository's ecosystem conformance workflow against the exact submitted artifacts.
2. Recompute canonical digests and proof results instead of trusting summary fields.
3. Verify signature, key validity, origin scope, deployment identity, source revision, freshness, and conformance policy.
4. Check that the application and issuer are genuinely external to the AIC project.
5. Add the entry only after all required checks pass.

Start with the [verified adopter issue form](../.github/ISSUE_TEMPLATE/verified_adopter.yml). Reviewers may request a fresh remote observation before merging a registry entry.

## What acceptance means

Acceptance means the disclosed claim passed the open verifier under the recorded policy at a specific time. It does not mean AIC independently audited the whole application, guarantees future behavior, or endorses the operator. Consumers must continue to pin their own trust policy and verify current evidence.
