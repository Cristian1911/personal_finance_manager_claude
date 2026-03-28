#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$ROOT_DIR/.githooks"
HOOK_FILE="$HOOKS_DIR/pre-commit"
GEN_SCRIPT="$ROOT_DIR/.claude/skills/codebase-context/scripts/build_context.py"

if [[ ! -f "$GEN_SCRIPT" ]]; then
  echo "Missing generator script: $GEN_SCRIPT"
  exit 1
fi

mkdir -p "$HOOKS_DIR"

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
GEN_SCRIPT="$ROOT_DIR/.claude/skills/codebase-context/scripts/build_context.py"

if [[ ! -f "$GEN_SCRIPT" ]]; then
  exit 0
fi

python3 "$GEN_SCRIPT" --project-root "$ROOT_DIR" --output-dir "$ROOT_DIR/docs/agent"
git add "$ROOT_DIR/docs/agent/PROJECT_CONTEXT.md" "$ROOT_DIR/docs/agent/project_context.json"
EOF

chmod +x "$HOOK_FILE"
git config core.hooksPath .githooks

echo "Installed pre-commit hook at $HOOK_FILE"
echo "Configured core.hooksPath=.githooks"

