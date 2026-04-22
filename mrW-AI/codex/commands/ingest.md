# Codex Command: ingest

> Read `mrW-AI/findings.md` before starting. Write all outputs to disk —
> do not rely on shared live context between spawned agents.

## Pre-flight: version check

Before doing anything else, check if the framework is up to date:

1. Read `codex/manifest.json` → extract `version` (this is the **expected** version).
2. Read `.mrw/framework-version` (if it exists) → this is the **installed** version.
3. If the file is missing OR the installed version is older than the expected version:
   - Run: `./scripts/migrate.sh --target . --mode update 2>&1 || true`
   - If `scripts/migrate.sh` doesn't exist yet, report: "Framework v{installed} is outdated (latest: v{expected}). Run `scripts/migrate.sh --target .` from your mrw-sdlc repo to update."
4. If versions match, proceed silently.

---

Read `prompts/workflows/ingest.md` for the complete ingest workflow and operating instructions.

Arguments: $ARGUMENTS
