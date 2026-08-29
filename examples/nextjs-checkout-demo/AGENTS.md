<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 5 -->
# AIC Agent Onboarding

This example demonstrates the recommended AIC coding-agent onboarding file set.

## Use In This Example

1. Update Next.js source under `app/`.
2. Keep `aic.project.json` aligned with app meaning.
3. Prefer explicit `agent*` metadata and AIC React components.
4. Generate and inspect artifacts before treating changes as complete.
5. Keep WebMCP task-level, feature-detected, native-first, and backed by authored `execution_ready` AIC action contracts.
6. Reuse the same checkout domain function for the human button and WebMCP tool.
7. Keep `aic-behavior-contract.json` aligned with the domain operation and run `pnpm aic:verify` before claiming parity.
8. Run `pnpm aic:verify:browser` for rendered/native claims, and treat signed claims or registry entries as issuer assertions rather than independent production certification.
9. Regenerate and verify the authored `aic.pack.checkout/complete` binding after any contract change.
10. Require the critical assurance policy to regenerate browser proof, pass all five scenarios, and verify the pinned origin/revision-bound CI claim.
