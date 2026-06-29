---
description: Detects and safely removes unused exports, imports, files, and dependencies. Runs knip, verifies each finding, removes in small commits.
argument-hint: [detect|cleanup] default: detect
---

Read CLAUDE.md. Read AUDIT.md if it exists.
Run: npm run test 2>&1 | tail -3 — record baseline.
Mode: $ARGUMENTS (default: detect)

PHASE 1 — DETECT
Run: npx knip 2>&1
Run: tsc --noUnusedLocals --noUnusedParameters --noEmit 2>&1 | grep "error" | head -40

For EVERY flagged item, verify it is truly unused:
1. Search for dynamic imports: grep -rn "import(.*SymbolName\|require(.*SymbolName" src
2. Search for JSX usage: grep -rn "<SymbolName" src
3. Search for string references (reflection): grep -rn "'SymbolName'\|\"SymbolName\"" src
4. Check if it is a public API export in an index.ts barrel

Only flag items as "confirmed dead" if they fail ALL four checks.

Output a report:
## Dead Code Report
### Confirmed Dead (safe to remove)
- [file:line] [symbol] — [reason it's confirmed unused]
### Likely Dead (needs human review)
- [file:line] [symbol] — [why it might still be used]
### False Positives (do NOT remove)
- [file:line] [symbol] — [why knip flagged it incorrectly]

If mode=detect: STOP HERE. Do not remove anything.

PHASE 2 — CLEANUP (only if mode=cleanup)
Remove "Confirmed Dead" items only. One category per commit:
1. Unused imports first (lowest risk)
2. Unused local variables
3. Unused exported functions (internal only)
4. Orphaned files

After each removal: npm run test → must pass. tsc --noEmit → 0 errors.
If any test fails after a removal: git revert that removal immediately, move it to "Likely Dead" list.

Commit format: "cleanup: remove unused [category] — [N items]"