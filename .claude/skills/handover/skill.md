---
name: handover
description: Generate a HANDOVER.md summarizing everything relevant from the current session — changes made, decisions taken, open issues, and context for the next session.
---

## Instructions

Generate a handover document at `HANDOVER.md` (project root) that gives a future Claude session full context to continue where this session left off.

### Structure

Write the file with these sections:

#### 1. Session Summary
One paragraph describing what was accomplished this session at a high level.

#### 2. Changes Made
For each file changed, added, or deleted:
- **File path** and what was done (created / modified / deleted)
- One-line description of the change
- Group by feature or area when multiple files relate to the same change

#### 3. Key Decisions
Bullet list of architectural or design decisions made and **why**. Include:
- Alternatives that were considered and rejected
- User preferences expressed (e.g., "markdown over HTML")
- Constraints discovered during implementation

#### 4. Current State
- Does the build pass? (`pnpm build`)
- Are there known errors, warnings, or TODOs?
- What is the git status? (branch, uncommitted changes)

#### 5. Open Issues & Gotchas
Anything discovered but NOT fixed. Bugs, tech debt, edge cases, or things that need attention. Be specific — include file paths and line numbers.

#### 6. Suggested Next Steps
Ordered list of what to work on next, based on what was done and what remains. Be actionable and specific.

#### 7. Context for Claude
Any non-obvious context that a fresh session would need:
- Relevant external packages (paths, versions, APIs)
- Database state assumptions
- Environment quirks
- Patterns or conventions followed that aren't in CLAUDE.md

### Guidelines

- **Be concise** — this is a reference doc, not a narrative. Use bullets and short sentences.
- **Include file paths** with line numbers where relevant so the next session can jump straight in.
- **Don't repeat CLAUDE.md** — only add context that's session-specific or not already documented.
- **Check git status and build** before writing — include real, current info.
- Review the full conversation to capture everything. Don't miss decisions made early in the session.