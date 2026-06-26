# Session Plan Command

When the user types /plan, scope the session and get explicit sign-off BEFORE touching any source file.

## Instructions

1. Silently read `docs/progress.md` and `DECISIONS.md`. Do not output their contents.
2. From the latest handoff in `docs/progress.md`, derive the current state and 3 candidate
   tasks (pull from "Open TODOs" / "Next Session Entrypoint" / "Known Gaps").
3. Output the Session Plan in the exact format below.
4. Prepend the same plan to `docs/session-plan.md` under a new `## Session Plan — [DATE]`
   heading (create the file if absent; never overwrite earlier plans).
5. Ask exactly: **"Confirm this plan before I open any files? (Y to proceed / N to adjust)"**
6. Do NOT open, read, or edit any source file until the user replies `Y`. On `N`, revise.

## Output format
```markdown
## Session Plan — [DATE]

**Current state:** [2-sentence summary from latest progress.md handoff]

**3 candidate tasks:**
| Task | Files in scope | Effort (S/M/L) | Risk |
|------|----------------|----------------|------|
| [task 1] | [paths] | [S/M/L] | [low/med/high] |
| [task 2] | [paths] | [S/M/L] | [low/med/high] |
| [task 3] | [paths] | [S/M/L] | [low/med/high] |

**Recommended next task:** [single most important task + one-line why]

**Active decisions that constrain this session:** [relevant entries from DECISIONS.md, or "None"]
```
