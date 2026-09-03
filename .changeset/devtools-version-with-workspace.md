---
"@aicorg/devtools": patch
---

Version the devtools package with the rest of the workspace.

It was excluded from changesets while still being included in the publish plan, so its packed
manifest changed every time an internal dependency bumped while its own version stayed put. The
publish job then failed the "already present with identical bytes" check and stopped before the
remaining packages, including the CLI.
