---
description: Refactors a specific file or concern: splits large files, extracts pure utilities, improves naming. Behavior-preserving only.
argument-hint: [filepath] e.g. src/components/Inspector.tsx
---

Read CLAUDE.md top-to-bottom. Read AUDIT.md if it exists.
Run: npm run test 2>&1 | tail -3 — record baseline. It must not change.

TARGET: $ARGUMENTS

STEP 1 — ANALYZE FIRST (no writes yet)
Read the target file completely.
Answer:
- How many lines? If over 400, it MUST be split.
- Does it mix concerns? (UI rendering + business logic + store access all in one component)
- Are there pure functions that could move to src/utils/?
- Are there repeated patterns that could become sub-components?
- Is there state in useState that belongs in a Zustand store?
Propose a split/extraction plan. Wait for confirmation if the change affects more than 3 files.

STEP 2 — EXECUTE (behavior-preserving only)
If splitting a large file:
- Create sub-files FIRST, copy the code, then update the original to re-export from them
- Never break existing import paths — use barrel exports (index.ts) if needed
- The original file path must continue to work for all existing imports

If extracting a pure utility:
- New file goes in src/utils/[domain].ts
- Export the function with full TypeScript types
- Add it to CLAUDE.md Utilities section

RULES:
- Zero behavior changes — same inputs, same outputs, same renders
- If you discover a bug during refactor: document it in AUDIT.md, do NOT fix it here
- Run tsc --noEmit after every file change, before the next change
- Run npm run test after each logical step

Commit: "refactor([filename]): [what changed — e.g., split into 3 sub-components]"