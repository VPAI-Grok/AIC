<!-- AIC_AGENT_ONBOARDING_TEMPLATE_VERSION: 4 -->
# GitHub Copilot AIC Instructions

Use [AGENTS.md](../AGENTS.md) as the canonical AIC instruction set for this repo.

When implementing AIC:

- add explicit `agent*` metadata before relying on inference
- keep IDs stable and localization-safe
- add confirmation metadata for critical actions
- keep generated manifests machine-derived
- run `aic scan`, `aic generate project`, and `aic inspect report.json`
- use native protocol fields when equivalent and run `aic verify` for consequential multi-surface actions
