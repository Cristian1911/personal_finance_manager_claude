# Model Strategy (Capability vs Cost)

Use a tiered strategy so context maintenance stays cheap while preserving quality on hard tasks.

## Default routing

Pick the model tier based on your agent provider:

| Tier | Claude Code | Codex / OpenAI |
|------|-------------|----------------|
| Fast (default) — context generation, drift checks, incremental updates | `claude-haiku-4-5` | `gpt-5-mini` |
| Deep — architecture synthesis, risky migrations, cross-domain refactors | `claude-sonnet-4-6` | `gpt-5` |

## Escalation rules

Escalate from the fast tier to the deep tier only if at least one is true:

1. Architecture decisions affect multiple apps/services.
2. The diff includes schema/auth/security-sensitive logic.
3. The first pass has unresolved ambiguity after targeted file reads.

Return to the fast tier for routine refresh loops and commit-time regeneration.

## Cost control guardrails

1. Read generated context first, then fetch only the files needed for the task.
2. Keep generated artifacts concise and structured.
3. Avoid full-repo deep reads unless there is hard evidence of stale or missing context.