---
name: session-handoff
description: >
  This skill should be used at the END of every Claude Code session, before
  running /clear, or when the user says "end session", "save progress",
  "wrap up", "I am done for today", or "handoff". Updates docs/progress.md
  with current state so the next session can resume with zero re-explanation.
allowed-tools:
  - Read
  - Edit
  - Bash
---

## Procedure

1. Run: `git status` and `git log --oneline -5` to capture current state.
2. Read current `docs/progress.md` to see the previous handoff.
3. Archive the previous handoff: append it to `docs/progress-archive.md`
   with a `## [date]` header.
4. Write a NEW entry at the top of `docs/progress.md` with:
   ### Status: [what state is the project in right now]
   ### Completed This Session: [bullet list]
   ### In Progress: [what was started but not finished]
   ### Next Steps: [exact next actions, specific enough to act on cold]
   ### Key Decisions Made: [any architectural choices made this session]
   ### Do Not Touch: [anything fragile discovered this session]
   ### Files Changed: [list from git status]
5. Run: `revise-claude-md` to update CLAUDE.md with any new learnings.
6. Confirm: docs/progress.md has exactly 1 active handoff entry.

## Rule

Max 1 active handoff in docs/progress.md at all times.
All older entries live in docs/progress-archive.md only.
