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
  prompts/roles/*.md            Shared agent role definitions
  prompts/workflows/*.md        Shared workflow logic
  plugins/mrw-sdlc/.codex-plugin/plugin.json
  plugins/mrw-sdlc/agents/      Claude plugin agent wrappers
  plugins/mrw-sdlc/commands/    Claude plugin command wrappers
  plugins/mrw-sdlc/skills/      Codex plugin bootstrap skill bundle
  plugins/mrw-sdlc/scripts/     Codex plugin helper scripts
  plugins/mrw-sdlc/.claude-plugin/plugin.json
  codex/agents/                 Codex agent wrappers
  codex/commands/               Codex command wrappers
  codex/orchestration/          Handoff contract, agent mapping, runtime rules
  codex/manifest.json           Codex runtime metadata
  .claude-plugin/marketplace.json
  .agents/plugins/marketplace.json
  CLAUDE.md                     Claude Code entry point
  AGENTS.md                     Codex entry point

What gets installed only if missing (CONFIG_TEMPLATE):
  plugins/mrw-sdlc/config/*.yml
  plugins/mrw-sdlc/templates/eval.yml
  codex/config/*.yml
  codex/templates/eval.yml

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

# Detect current version in target.
CURRENT_VERSION="unknown"
if [[ -f "$TARGET/.mrw/framework-version" ]]; then
  CURRENT_VERSION="$(cat "$TARGET/.mrw/framework-version" | tr -d '[:space:]')"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$TARGET/.mrw/backups/$TIMESTAMP"

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

# ── 1. Framework files (always sync in update mode) ─────────────────────────

log "▸ Syncing shared prompts layer..."
sync_framework_dir "$SOURCE/prompts/roles"     "$TARGET/prompts/roles"
sync_framework_dir "$SOURCE/prompts/workflows"  "$TARGET/prompts/workflows"

log ""
log "▸ Syncing Claude plugin (agents + commands)..."
sync_framework_file "$SOURCE/plugins/mrw-sdlc/.codex-plugin/plugin.json" \
                    "$TARGET/plugins/mrw-sdlc/.codex-plugin/plugin.json"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/agents"   "$TARGET/plugins/mrw-sdlc/agents"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/commands"  "$TARGET/plugins/mrw-sdlc/commands"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/skills"    "$TARGET/plugins/mrw-sdlc/skills"
sync_framework_dir "$SOURCE/plugins/mrw-sdlc/scripts"   "$TARGET/plugins/mrw-sdlc/scripts"
sync_framework_file "$SOURCE/plugins/mrw-sdlc/.claude-plugin/plugin.json" \
                    "$TARGET/plugins/mrw-sdlc/.claude-plugin/plugin.json"

log ""
log "▸ Syncing Codex runtime (agents + commands + orchestration)..."
sync_framework_dir "$SOURCE/codex/agents"         "$TARGET/codex/agents"
sync_framework_dir "$SOURCE/codex/commands"        "$TARGET/codex/commands"
sync_framework_dir "$SOURCE/codex/orchestration"   "$TARGET/codex/orchestration"
sync_framework_file "$SOURCE/codex/manifest.json"  "$TARGET/codex/manifest.json"

log ""
log "▸ Syncing root framework files..."
sync_framework_file "$SOURCE/CLAUDE.md"  "$TARGET/CLAUDE.md"
sync_framework_file "$SOURCE/AGENTS.md"  "$TARGET/AGENTS.md"
sync_framework_file "$SOURCE/.claude-plugin/marketplace.json" \
                    "$TARGET/.claude-plugin/marketplace.json"
sync_framework_file "$SOURCE/.agents/plugins/marketplace.json" \
                    "$TARGET/.agents/plugins/marketplace.json"

log ""
log "▸ Syncing migration tooling..."
sync_framework_file "$SOURCE/scripts/migrate.sh" "$TARGET/scripts/migrate.sh"
if [[ "$DRY_RUN" -eq 0 && -f "$TARGET/scripts/migrate.sh" ]]; then
  chmod +x "$TARGET/scripts/migrate.sh"
fi

# ── 2. Config templates (install only if missing) ───────────────────────────

log ""
log "▸ Installing config templates (if missing)..."

for cfg in docs.yml jira.yml token-budget.yml; do
  install_template "$SOURCE/plugins/mrw-sdlc/config/$cfg" "$TARGET/plugins/mrw-sdlc/config/$cfg"
  install_template "$SOURCE/codex/config/$cfg"             "$TARGET/codex/config/$cfg"
done

install_template "$SOURCE/plugins/mrw-sdlc/templates/eval.yml" "$TARGET/plugins/mrw-sdlc/templates/eval.yml"
install_template "$SOURCE/codex/templates/eval.yml"             "$TARGET/codex/templates/eval.yml"

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

> Read before starting any task. Write after any mistake or discovery.

## Critical (Read First)

## Recent

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

run_cmd mkdir -p "$TARGET/.mrw"
if [[ "$DRY_RUN" -eq 0 ]]; then
  printf '%s\n' "$VERSION" > "$TARGET/.mrw/framework-version"
  printf '%s\n' "migrate.sh"  > "$TARGET/.mrw/framework-source"
  printf '%s\n' "$CURRENT_VERSION -> $VERSION @ $TIMESTAMP" >> "$TARGET/.mrw/migration-log"
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
  log "Backups: .mrw/backups/$TIMESTAMP/"
fi

log ""
log "What was synced:"
log "  ✓ prompts/roles/ + prompts/workflows/   (shared truth)"
log "  ✓ plugins/mrw-sdlc/                      (Claude plugin)"
log "  ✓ codex/                                  (Codex runtime)"
log "  ✓ CLAUDE.md + AGENTS.md                   (entry points)"
log ""
log "What was NOT touched:"
log "  · mrW-AI/     (project state)"
log "  · docs/       (generated docs)"
log "  · .claude/    (local settings)"
log "  · config/*.yml (your customizations)"
log ""
