---
name: codebase-context
description: Use when starting work on an unknown codebase, before implementing significant changes, or after code edits to keep project context docs current.
---

## Instructions

Create and keep an always-updated project context so agents do not re-read the whole repository every time.

### 1. Generate context artifacts

Run:

```bash
python3 .claude/skills/codebase-context/scripts/build_context.py
```

This writes:

- `docs/agent/PROJECT_CONTEXT.md` (human quick-read)
- `docs/agent/project_context.json` (machine-readable for agents)

### 2. Refresh policy during edits

Follow this policy on every coding task:

1. Before major edits, run the generator once to load current context.
2. After edits are done, run it again to refresh docs.
3. If changes are committed, ensure updated context files are included in the same commit.

### 3. Keep context focused and cheap

Do not dump full file contents in generated docs. Keep summaries short and structured:

- architecture and directory map
- commands and entrypoints
- detected patterns and conventions
- cross-module dependencies at folder level
- recent changed files

### 4. Enforce automatic updates on commit

Install the hook once per clone:

```bash
bash .claude/skills/codebase-context/scripts/install_git_hook.sh
```

This configures `core.hooksPath=.githooks` and installs a `pre-commit` hook that regenerates and stages the context files.

### 5. Model strategy (capability vs cost)

Use a tiered model based on task complexity. Pick the equivalent for your agent provider:

| Tier | Claude Code | Codex / OpenAI |
|------|-------------|----------------|
| Fast/cheap — scans, incremental refreshes | `claude-haiku-4-5` | `gpt-5-mini` |
| Deep — architecture synthesis, risky migrations | `claude-sonnet-4-6` | `gpt-5` |

Escalate model only when needed:

- Default to the fast tier; escalate only for ambiguous architecture decisions, cross-module redesign, or security-sensitive diffs.
- Fall back to the fast tier for routine refresh loops and commit-time regeneration.
