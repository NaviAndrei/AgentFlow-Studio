# Manual Compact Command

When the user types /compact-now, trigger a deliberate, well-prepared context compaction instead of waiting for the automatic compact at 95% usage.

## Instructions

1. Read the last 20 entries of `.claude/hook-log.jsonl` (if it exists) and report how active this session has been so far (rough count of tool calls / hook events, any errors logged). If the file does not exist, say so and skip this step.
2. Run the pre-compact snapshot directly so `docs/progress.md` is captured before anything is summarized away:
   ```
   python .claude/hooks/pre_compact_snapshot.py
   ```
   Confirm the script ran without error and that `docs/progress.md` (and `compact-anchor.md`, if produced) reflect the current session state.
3. Instruct the user:
   > "Run `/compact` now — your anchor will be re-injected automatically via the PostCompact hook."
4. After the user runs `/compact` and the conversation resumes, verify the re-injection happened:
   - Check the last entry of `.claude/hook-log.jsonl` for a PostCompact hook firing.
   - Confirm `compact-anchor.md` content appears to have been re-injected into context (e.g. project state/anchor facts are present without needing to re-explain them).
   - If the PostCompact hook did not fire or the anchor wasn't injected, tell the user explicitly and suggest manually re-reading `compact-anchor.md` and `docs/progress.md`.

## When to use this
- After completing a large feature or debugging session.
- When starting a new, unrelated task in the same session.
- When Claude's responses start getting less precise or seem to be missing project context.
- Before a complex architectural decision that needs full reasoning capacity — compact early rather than letting auto-compact trigger mid-decision.
- Best used around 60–70% context usage, not at the last minute.
