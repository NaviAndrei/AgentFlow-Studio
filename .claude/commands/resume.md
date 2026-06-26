# Session Resume Command

When the user types /resume, restore just enough context to continue — without opening any source file.

## Instructions

1. Read only these context files: `CLAUDE.md`, `docs/progress.md`, `DECISIONS.md`, and
   `docs/session-plan.md` (if it exists). Do NOT open, read, or edit any source file.
2. From the latest handoff in `docs/progress.md`, extract the last session date, where work
   stopped (file + task), and the single highest-priority next action.
3. Pull "open / under-review" items from `DECISIONS.md` and unchecked `docs/progress.md` TODOs.
4. Output in the exact format below. Keep it tight — this is orientation, not a full report.

## Output format
```markdown
Resume — [DATE TIME]
Last session: [date from latest progress.md handoff]
Where we stopped: [exact file + task from last handoff]
5 key facts:
1. [most important context]
2. [second]
3. [third]
4. [fourth]
5. [fifth]
⚡ Single next action: [one task, specific file, one sentence]
⚠️ Open decisions (Under Review in DECISIONS.md): [list or "None"]
```
