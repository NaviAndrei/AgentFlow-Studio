# Session Handoff Command

When the user types /handoff, generate a session handoff entry and write it to docs/progress.md.

## Instructions

1. Summarize what was accomplished in this session (files touched, problems solved)
2. List any non-obvious decisions made (link to DECISIONS.md if you added entries)
3. State exactly where work stopped (file + line if relevant)
4. List the 1-3 most important next steps in priority order
5. Write the result to docs/progress.md under a new `## Handoff — [TODAY'S DATE]` heading (prepend, don't overwrite)
6. Confirm: "Handoff written to docs/progress.md. Resume next session with: @CLAUDE.md @docs/progress.md"

## Output format
```markdown
## Handoff — [DATE]

### What was completed
- [task + files modified]

### Decisions made this session
- [decision] — see DECISIONS.md if added

### Where work stopped
- File: [path], Line: [N] (if applicable)
- Task: [exact next step]

### Next steps (priority order)
1. [ ] [most important]
2. [ ] [second]
3. [ ] [third]

### Resume with
@CLAUDE.md @docs/progress.md
```
