#!/usr/bin/env bash
set -euo pipefail

# migrate.sh — Migrate any mrw-sdlc project to the latest framework version.
#
# Syncs framework-managed files from the mrw-sdlc repo into a target project.
# Backs up replaced files. Never touches project state (mrW-AI/, docs/, .claude/).
#
# Usage:
#   migrate.sh --target /path/to/project [--dry-run]
#   migrate.sh --target /path/to/project --mode update
#   migrate.sh --target /path/to/project --mode merge

usage() {
  cat <<'EOF'
Usage:
  migrate.sh --target DIR [--mode merge|update] [--dry-run]

Modes:
  merge   Install missing framework files without overwriting existing ones.
  update  (default) Refresh all framework-managed files, backing up replaced copies.

Flags:
  --target DIR   Target project directory (required).
  --source DIR   Framework repo directory. Defaults to this script's repo root.
  --mode MODE    One of: merge, update. Defaults to update.
  --dry-run      Print planned actions without changing files.
  --help         Show this help.

What gets synced (FRAMEWORK — always safe to overwrite):
  mrW-AI/prompts/roles/*.md         Shared agent role definitions
  mrW-AI/prompts/workflows/*.md     Shared workflow logic
  plugins/mrw-sdlc/.codex-plugin/plugin.json
  plugins/mrw-sdlc/agents/          Claude plugin agent wrappers
  plugins/mrw-sdlc/commands/        Claude plugin command wrappers
  plugins/mrw-sdlc/skills/          Codex plugin bootstrap skill bundle
  plugins/mrw-sdlc/scripts/         Codex plugin helper scripts
  plugins/mrw-sdlc/.claude-plugin/plugin.json
  plugins/mrw-sdlc/.gemini-extension/  Gemini CLI extension (hooks, commands, config)
  mrW-AI/codex/agents/              Codex agent wrappers
  mrW-AI/codex/commands/            Codex command wrappers
  mrW-AI/codex/orchestration/       Handoff contract, agent mapping, runtime rules
  mrW-AI/codex/manifest.json        Codex runtime metadata
  .claude-plugin/marketplace.json
  .agents/plugins/marketplace.json
  CLAUDE.md                         Claude Code entry point
  mrW-AI/AGENTS.md                  Codex entry point

What gets installed only if missing (CONFIG_TEMPLATE):
  plugins/mrw-sdlc/config/*.yml
  plugins/mrw-sdlc/templates/eval.yml
  mrW-AI/codex/config/*.yml
  mrW-AI/codex/templates/eval.yml

What is never touched (PROJECT_STATE):
  mrW-AI/                       Plans, tasks, findings, decisions, evals
  docs/                         Generated project documentation
  .claude/                      Claude local settings
  Source code, tests, etc.
EOF
}

log()  { printf '%s\n' "$*"; }
info() { printf '  %s\n' "$*"; }

# ── Helpers ──────────────────────────────────────────────────────────────────

run_cmd() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] $*"
  else
    "$@"
  fi
}

backup_file() {
  local path="$1"
  local rel="${path#$TARGET/}"
  [[ -e "$path" ]] || return 0
  run_cmd mkdir -p "$(dirname "$BACKUP_DIR/$rel")"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    cp -R "$path" "$BACKUP_DIR/$rel"
  fi
  info "backed up: $rel"
}

# Sync a single file. In update mode: backup + overwrite. In merge mode: skip existing.
sync_framework_file() {
  local src="$1"
  local dest="$2"
  local rel="${dest#$TARGET/}"

  if [[ ! -f "$src" ]]; then
    info "skip (source missing): $rel"
    return 0
  fi

  if [[ -f "$dest" ]]; then
    if [[ "$MODE" == "update" ]]; then
      # Check if content is identical — skip if unchanged
      if diff -q "$src" "$dest" >/dev/null 2>&1; then
        info "unchanged: $rel"
        return 0
      fi
      backup_file "$dest"
    else
      info "kept existing: $rel"
      return 0
    fi
  fi

  run_cmd mkdir -p "$(dirname "$dest")"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    cp "$src" "$dest"
  fi
  info "installed: $rel"
  CHANGED=$((CHANGED + 1))
}

# Sync an entire directory of framework files.
sync_framework_dir() {
  local src_dir="$1"
  local dest_dir="$2"

  if [[ ! -d "$src_dir" ]]; then
    info "skip (source dir missing): ${src_dir#$SOURCE/}"
    return 0
  fi

  find "$src_dir" -type f | sort | while read -r src_file; do
    local rel="${src_file#$src_dir/}"
    sync_framework_file "$src_file" "$dest_dir/$rel"
  done
}

# Install a config template only if the target file doesn't exist.
install_template() {
  local src="$1"
  local dest="$2"
  local rel="${dest#$TARGET/}"

  if [[ ! -f "$src" ]]; then
    return 0
  fi

  if [[ -f "$dest" ]]; then
    info "kept config: $rel"
    return 0
  fi

  run_cmd mkdir -p "$(dirname "$dest")"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    cp "$src" "$dest"
  fi
  info "created config: $rel"
  CHANGED=$((CHANGED + 1))
}

# Write a starter file only if it doesn't exist.
write_if_missing() {
  local path="$1"
  local content="$2"
  local rel="${path#$TARGET/}"

  if [[ -e "$path" ]]; then
    return 0
  fi

  run_cmd mkdir -p "$(dirname "$path")"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    printf '%s' "$content" > "$path"
  fi
  info "created: $rel"
  CHANGED=$((CHANGED + 1))
}

# ── Parse arguments ─────────────────────────────────────────────────────────

TARGET=""
SOURCE=""
MODE="update"
DRY_RUN=0
CHANGED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)  TARGET="$2";  shift 2 ;;
    --source)  SOURCE="$2";  shift 2 ;;
    --mode)    MODE="$2";    shift 2 ;;
    --dry-run) DRY_RUN=1;    shift   ;;
    --help|-h) usage; exit 0         ;;
    *) log "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  log "Error: --target is required"
  usage
  exit 1
fi

if [[ "$MODE" != "merge" && "$MODE" != "update" ]]; then
  log "Error: invalid mode '$MODE'. Must be merge or update."
  exit 1
fi

if [[ ! -d "$TARGET" ]]; then
  log "Error: target directory does not exist: $TARGET"
  exit 1
fi

TARGET="$(cd "$TARGET" && pwd)"

# Resolve source — default to this script's repo root.
if [[ -z "$SOURCE" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

if [[ ! -d "$SOURCE/prompts" ]]; then
  log "Error: source does not look like an mrw-sdlc repo (missing prompts/): $SOURCE"
  exit 1
fi

# Read version from the source repo.
VERSION="$(grep '"version"' "$SOURCE/plugins/mrw-sdlc/.claude-plugin/plugin.json" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")"

# Detect current version in target — check new location first, fall back to old.
CURRENT_VERSION="unknown"
if [[ -f "$TARGET/mrW-AI/.mrw/framework-version" ]]; then
  CURRENT_VERSION="$(cat "$TARGET/mrW-AI/.mrw/framework-version" | tr -d '[:space:]')"
elif [[ -f "$TARGET/.mrw/framework-version" ]]; then
  CURRENT_VERSION="$(cat "$TARGET/.mrw/framework-version" | tr -d '[:space:]')"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$TARGET/mrW-AI/.mrw/backups/$TIMESTAMP"

# ── Banner ───────────────────────────────────────────────────────────────────

log ""
log "mrw-sdlc migrate"
log "─────────────────────────────────────"
log "  source:  $SOURCE"
log "  target:  $TARGET"
log "  mode:    $MODE"
log "  from:    v$CURRENT_VERSION"
log "  to:      v$VERSION"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "  dry-run: yes"
fi
log ""

# ── 0. Migrate old root-level paths to mrW-AI/ ────────────────────────────

log "▸ Checking for pre-v6 root-level paths..."
MIGRATED=0

migrate_if_exists() {
  local old_path="$1"
  local new_path="$2"
  local rel_old="${old_path#$TARGET/}"
  local rel_new="${new_path#$TARGET/}"

  if [[ -e "$old_path" && ! -e "$new_path" ]]; then
    run_cmd mkdir -p "$(dirname "$new_path")"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      mv "$old_path" "$new_path"
    fi
    info "migrated: $rel_old -> $rel_new"
    MIGRATED=$((MIGRATED + 1))
  fi
}

# Move framework dirs/files from root to mrW-AI/
migrate_if_exists "$TARGET/prompts"              "$TARGET/mrW-AI/prompts"
migrate_if_exists "$TARGET/codex"                "$TARGET/mrW-AI/codex"
migrate_if_exists "$TARGET/AGENTS.md"            "$TARGET/mrW-AI/AGENTS.md"
migrate_if_exists "$TARGET/.mrw"                 "$TARGET/mrW-AI/.mrw"
migrate_if_exists "$TARGET/scripts/migrate.sh"   "$TARGET/mrW-AI/scripts/migrate.sh"
migrate_if_exists "$TARGET/security"             "$TARGET/mrW-AI/security"

# Clean up empty scripts/ dir if migrate.sh was the only file
if [[ -d "$TARGET/scripts" && -z "$(ls -A "$TARGET/scripts" 2>/dev/null)" ]]; then
  run_cmd rmdir "$TARGET/scripts"
fi

# ── Path rewriting in config files (after migration) ──────────────────────

REWRITTEN=0

rewrite_paths_in_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then return 0; fi

  local tmpfile
  tmpfile="$(mktemp)"

  # Two-pass approach: first strip any existing mrW-AI/ prefixes to normalise,
  # then re-add them. This prevents double-prefixing if the file was already
  # partially updated.
  sed \
    -e 's|mrW-AI/prompts/workflows/|prompts/workflows/|g' \
    -e 's|mrW-AI/prompts/roles/|prompts/roles/|g' \
    -e 's|mrW-AI/prompts/instructions/|prompts/instructions/|g' \
    -e 's|mrW-AI/codex/config/|codex/config/|g' \
    -e 's|mrW-AI/codex/agents/|codex/agents/|g' \
    -e 's|mrW-AI/codex/commands/|codex/commands/|g' \
    -e 's|mrW-AI/scripts/migrate\.sh|scripts/migrate.sh|g' \
    -e 's|mrW-AI/\.mrw/framework-version|.mrw/framework-version|g' \
    -e 's|mrW-AI/security/audit-report|security/audit-report|g' \
    -e 's|prompts/workflows/|mrW-AI/prompts/workflows/|g' \
    -e 's|prompts/roles/|mrW-AI/prompts/roles/|g' \
    -e 's|prompts/instructions/|mrW-AI/prompts/instructions/|g' \
    -e 's|codex/config/|mrW-AI/codex/config/|g' \
    -e 's|codex/agents/|mrW-AI/codex/agents/|g' \
    -e 's|codex/commands/|mrW-AI/codex/commands/|g' \
    -e 's|scripts/migrate\.sh|mrW-AI/scripts/migrate.sh|g' \
    -e 's|\.mrw/framework-version|mrW-AI/.mrw/framework-version|g' \
    -e 's|security/audit-report|mrW-AI/security/audit-report|g' \
    "$file" > "$tmpfile"

  if ! diff -q "$file" "$tmpfile" >/dev/null 2>&1; then
    local count
    count=$(diff "$file" "$tmpfile" | grep -c '^[<>]' || true)
    count=$((count / 2))
    if [[ "$DRY_RUN" -eq 0 ]]; then
      mv "$tmpfile" "$file"
    else
      info "[dry-run] would update: ${file#$TARGET/} ($count replacements)"
      rm -f "$tmpfile"
    fi
    info "updated: ${file#$TARGET/} ($count path replacements)"
    REWRITTEN=$((REWRITTEN + 1))
  else
    rm -f "$tmpfile"
  fi
}

if [[ "$MIGRATED" -gt 0 ]]; then
  log ""
  log "▸ Rewriting path references in config files..."
  rewrite_paths_in_file "$TARGET/CLAUDE.md"

  # Rewrite .gitignore framework entries
  if [[ -f "$TARGET/.gitignore" ]]; then
    GITIGNORE_TMP="$(mktemp)"
    sed \
      -e 's|^prompts/$|mrW-AI/prompts/|' \
      -e 's|^codex/$|mrW-AI/codex/|' \
      -e 's|^\.mrw/$|mrW-AI/.mrw/|' \
      -e 's|^scripts/migrate\.sh$|mrW-AI/scripts/migrate.sh|' \
      "$TARGET/.gitignore" > "$GITIGNORE_TMP"
    if ! diff -q "$TARGET/.gitignore" "$GITIGNORE_TMP" >/dev/null 2>&1; then
      if [[ "$DRY_RUN" -eq 0 ]]; then mv "$GITIGNORE_TMP" "$TARGET/.gitignore"; fi
      info "updated: .gitignore"
      REWRITTEN=$((REWRITTEN + 1))
    else
      rm -f "$GITIGNORE_TMP"
    fi
  fi

  # Rewrite .github/workflows/*.yml if present
  if [[ -d "$TARGET/.github/workflows" ]]; then
    for wf in "$TARGET/.github/workflows"/*.yml; do
      [[ -f "$wf" ]] || continue
      rewrite_paths_in_file "$wf"
    done
  fi
fi

# ── 1. Framework files (always sync in update mode) ─────────────────────────

log ""
log "▸ Syncing shared prompts layer..."
sync_framework_dir "$SOURCE/prompts/roles"     "$TARGET/mrW-AI/prompts/roles"
sync_framework_dir "$SOURCE/prompts/workflows"  "$TARGET/mrW-AI/prompts/workflows"

log ""
log "▸ Syncing Claude plugin (agents + commands)..."
sync_framework_file "$SOURCE/plugins/mrw-sdlc/.codex-plugin/plugin.json" \
                    "$TARGET/plugins/mrw-sdlc/.codex-plugin/plugin.json"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/agents"   "$TARGET/plugins/mrw-sdlc/agents"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/commands"  "$TARGET/plugins/mrw-sdlc/commands"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/skills"    "$TARGET/plugins/mrw-sdlc/skills"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/scripts"   "$TARGET/plugins/mrw-sdlc/scripts"

# Orphan cleanup: warn if the pre-rename skill directory still exists in the target.
# The skill was renamed from mrw-codex-bootstrap to mrw-bootstrap in v5.3.0.
# The stale directory is never automatically removed (to avoid data loss), but the
# user should delete it manually: rm -rf plugins/mrw-sdlc/skills/mrw-codex-bootstrap/
if [[ -d "$TARGET/plugins/mrw-sdlc/skills/mrw-codex-bootstrap" ]]; then
  log ""
  log "DEPRECATION WARNING: stale skill directory detected in target:"
  log "  $TARGET/plugins/mrw-sdlc/skills/mrw-codex-bootstrap/"
  log "  This directory was renamed to mrw-bootstrap in v5.3.0 and is no longer used."
  log "  Remove it manually: rm -rf plugins/mrw-sdlc/skills/mrw-codex-bootstrap/"
fi
sync_framework_file "$SOURCE/plugins/mrw-sdlc/.claude-plugin/plugin.json" \
                    "$TARGET/plugins/mrw-sdlc/.claude-plugin/plugin.json"

log ""
log "▸ Syncing Gemini extension..."
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/.gemini-extension" \
                   "$TARGET/plugins/mrw-sdlc/.gemini-extension"

log ""
log "▸ Syncing Codex runtime (agents + commands + orchestration)..."
sync_framework_dir "$SOURCE/codex/agents"         "$TARGET/mrW-AI/codex/agents"
sync_framework_dir "$SOURCE/codex/commands"        "$TARGET/mrW-AI/codex/commands"
sync_framework_dir "$SOURCE/codex/orchestration"   "$TARGET/mrW-AI/codex/orchestration"
sync_framework_file "$SOURCE/codex/manifest.json"  "$TARGET/mrW-AI/codex/manifest.json"

log ""
log "▸ Syncing root framework files..."
sync_framework_file "$SOURCE/CLAUDE.md"  "$TARGET/CLAUDE.md"
sync_framework_file "$SOURCE/AGENTS.md"  "$TARGET/mrW-AI/AGENTS.md"
sync_framework_file "$SOURCE/.claude-plugin/marketplace.json" \
                    "$TARGET/.claude-plugin/marketplace.json"
sync_framework_file "$SOURCE/.agents/plugins/marketplace.json" \
                    "$TARGET/.agents/plugins/marketplace.json"

log ""
log "▸ Syncing migration tooling..."
sync_framework_file "$SOURCE/scripts/migrate.sh" "$TARGET/mrW-AI/scripts/migrate.sh"
if [[ "$DRY_RUN" -eq 0 && -f "$TARGET/mrW-AI/scripts/migrate.sh" ]]; then
  chmod +x "$TARGET/mrW-AI/scripts/migrate.sh"
fi

# ── 2. Config templates (install only if missing) ───────────────────────────

log ""
log "▸ Installing config templates (if missing)..."

for cfg in docs.yml jira.yml token-budget.yml; do
  install_template "$SOURCE/plugins/mrw-sdlc/config/$cfg" "$TARGET/plugins/mrw-sdlc/config/$cfg"
  install_template "$SOURCE/codex/config/$cfg"             "$TARGET/mrW-AI/codex/config/$cfg"
done

install_template "$SOURCE/plugins/mrw-sdlc/templates/eval.yml" "$TARGET/plugins/mrw-sdlc/templates/eval.yml"
install_template "$SOURCE/codex/templates/eval.yml"             "$TARGET/mrW-AI/codex/templates/eval.yml"

# ── 3. Initialize mrW-AI/ structure (if missing) ────────────────────────────

log ""
log "▸ Ensuring mrW-AI/ structure..."

run_cmd mkdir -p \
  "$TARGET/mrW-AI/shared" \
  "$TARGET/mrW-AI/tasks/done" \
  "$TARGET/mrW-AI/plans" \
  "$TARGET/mrW-AI/evals/baselines" \
  "$TARGET/mrW-AI/evals/reports" \
  "$TARGET/docs"

write_if_missing "$TARGET/mrW-AI/findings.md" "# Project Findings & Learnings

> Read \`## Active\` before starting any task. Write after any mistake or discovery.
> See \`mrW-AI/prompts/instructions/shared-context.md\` for read/write rules.

## Active


## Archive
"

write_if_missing "$TARGET/mrW-AI/shared/constraints.md" "# Project Constraints

> Edit this file to define coding rules, testing expectations, architecture constraints, and style requirements for this project.
"

write_if_missing "$TARGET/mrW-AI/shared/decisions.md" "# Decision Log

> Append-only. Record non-obvious decisions with context, rationale, and consequences.
"

write_if_missing "$TARGET/mrW-AI/shared/glossary.md" "# Glossary

> Domain terms and definitions for consistent language across planning, implementation, and review.
"

write_if_missing "$TARGET/mrW-AI/tasks/backlog.md" "# Task Backlog

> Generated plans and tasks should be tracked here.
"

write_if_missing "$TARGET/mrW-AI/mrw-plans.yml" "plans: []
"

write_if_missing "$TARGET/mrW-AI/evals/index.yml" "evals: []
"

write_if_missing "$TARGET/mrW-AI/evals/trends.md" "# Eval Trends

> Recurring quality patterns and unresolved issues across evaluations.
"

# ── 4. Write version stamp ──────────────────────────────────────────────────

log ""
log "▸ Writing version stamp..."

run_cmd mkdir -p "$TARGET/mrW-AI/.mrw"
if [[ "$DRY_RUN" -eq 0 ]]; then
  printf '%s\n' "$VERSION" > "$TARGET/mrW-AI/.mrw/framework-version"
  printf '%s\n' "migrate.sh"  > "$TARGET/mrW-AI/.mrw/framework-source"
  printf '%s\n' "$CURRENT_VERSION -> $VERSION @ $TIMESTAMP" >> "$TARGET/mrW-AI/.mrw/migration-log"
fi
info "version: $CURRENT_VERSION -> $VERSION"

# ── Summary ──────────────────────────────────────────────────────────────────

log ""
log "─────────────────────────────────────"
if [[ "$CHANGED" -gt 0 ]]; then
  log "Done. $CHANGED file(s) installed or updated."
else
  log "Done. Already up to date."
fi

if [[ "$MODE" == "update" && -d "$BACKUP_DIR" ]]; then
  log "Backups: mrW-AI/.mrw/backups/$TIMESTAMP/"
fi

if [[ "$MIGRATED" -gt 0 ]]; then
  log ""
  log "Migration summary:"
  log "  Moved $MIGRATED path(s) from root to mrW-AI/"
  if [[ "$REWRITTEN" -gt 0 ]]; then
    log "  Updated $REWRITTEN config file(s) with new paths"
  fi
fi

log ""
log "What was synced:"
log "  ✓ mrW-AI/prompts/roles/ + mrW-AI/prompts/workflows/   (shared truth)"
log "  ✓ plugins/mrw-sdlc/                      (Claude plugin)"
log "  ✓ plugins/mrw-sdlc/.gemini-extension/   (Gemini extension)"
log "  ✓ mrW-AI/codex/                          (Codex runtime)"
log "  ✓ CLAUDE.md + mrW-AI/AGENTS.md           (entry points)"
log ""
log "What was NOT touched:"
log "  · mrW-AI/     (project state)"
log "  · docs/       (generated docs)"
log "  · .claude/    (local settings)"
log "  · config/*.yml (your customizations)"
log ""
