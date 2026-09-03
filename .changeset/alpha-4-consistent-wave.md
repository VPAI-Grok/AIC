---
"@aicorg/ai-bootstrap": patch
"@aicorg/ai-bootstrap-http": patch
"@aicorg/ai-bootstrap-openai": patch
"@aicorg/automation-core": patch
"@aicorg/cli": patch
"@aicorg/conformance-packs": patch
"@aicorg/devtools": patch
"@aicorg/evidence-core": patch
"@aicorg/evidence-http": patch
"@aicorg/evidence-mcp": patch
"@aicorg/evidence-playwright": patch
"@aicorg/integrations-radix": patch
"@aicorg/integrations-shadcn": patch
"@aicorg/mcp-server": patch
"@aicorg/plugin-next": patch
"@aicorg/plugin-vite": patch
"@aicorg/reliance-server": patch
"@aicorg/rely": patch
"@aicorg/runner-remote": patch
"@aicorg/runtime": patch
"@aicorg/sdk-react": patch
"@aicorg/spec": patch
"@aicorg/verify-core": patch
"@aicorg/webmcp": patch
---

Publish a consistent alpha.4 wave.

The alpha.3 wave published 17 of 24 packages before the publish job stopped. Re-running it failed
again on a package that had already published, because the repacked tarball did not match the
registry bytes and the guard correctly refuses to republish differing content under an existing
version. Moving the whole workspace to a fresh version lets every package publish cleanly instead
of depending on byte-identical repacking.
