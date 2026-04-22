---
description: Resolve git merge conflicts using task context, change-intent manifests, and semantic analysis
argument-hint: [--file path/to/file] [--dry-run]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

## Pre-flight: version check

Before doing anything else, check if the framework is up to date:

1. Read `codex/manifest.json` → extract `version` (expected version)
2. Read `.mrw/framework-version` (if exists) → installed version
3. If missing OR installed < expected:
   - Run: `./scripts/migrate.sh --target . --mode update 2>&1 || true`
   - If migrate.sh doesn't exist: tell user to run it from mrw-sdlc repo
4. If versions match, proceed silently.

---

Read `prompts/workflows/conflict-resolve.md` for the complete conflict resolution workflow.

Arguments: $ARGUMENTS
