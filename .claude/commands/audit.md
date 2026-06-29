---
description: Read-only full codebase audit. Produces AUDIT.md with prioritized findings. No file modifications.
argument-hint: [focus=full|security|performance|types|deadcode]
context: fork
agent: Explore
---

You are performing a READ-ONLY codebase audit of AgentFlow Studio.
Focus: $ARGUMENTS (default: full)
DO NOT modify any file. Document only. Output goes to AUDIT.md.

STEP 1 — ORIENTATION
Run: find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20
Run: npm run test 2>&1 | tail -5
Run: tsc --noEmit 2>&1 | head -40

STEP 2 — TYPE SAFETY
Count `as any`, `@ts-ignore`, `@ts-expect-error`:
grep -rn "as any\|@ts-ignore\|@ts-expect-error" src --include="*.ts" --include="*.tsx" | wc -l
List the top 10 files with the most violations.

STEP 3 — DEAD CODE
Run: npx knip 2>&1 | head -60
Also grep: grep -rn "TODO\|FIXME\|HACK\|XXX" src --include="*.ts" --include="*.tsx"
List all with file path + line number.

STEP 4 — PERFORMANCE
Find components missing React.memo:
grep -rn "export default function\|export const.*=.*(" src/components --include="*.tsx" | grep -v memo | grep -v test
Find inline object/array props (re-render triggers):
grep -rn "={{" src/components --include="*.tsx" | head -20
Find Zustand selectors subscribing to entire store (anti-pattern):
grep -rn "useCanvasStore()\|useUIStore()\|useLLMConfigStore()" src/components --include="*.tsx"

STEP 5 — BUNDLE SIZE
Run: npm run build 2>&1 | grep -E "chunk|asset|kB|MB" | tail -20
Flag any chunk over 300KB.
Check: grep -rn "import \* as\|from 'lodash'" src --include="*.ts" --include="*.tsx"

STEP 6 — SECURITY
grep -rn "sk-\|API_KEY\|secret\|password" src --include="*.ts" --include="*.tsx" | grep -v test | grep -v ".env"
grep -rn "dangerouslySetInnerHTML\|eval(" src --include="*.tsx"
Count fetch() calls missing try/catch:
grep -rn "fetch(" src --include="*.ts" --include="*.tsx" | grep -v "try\|catch" | head -20

STEP 7 — COVERAGE
Run: npm run test -- --coverage 2>&1 | grep -E "Uncovered|^\|.*0 " | head -30

OUTPUT — write AUDIT.md with exactly this structure:
# AgentFlow Studio Audit — [date]
## 🔴 Critical (fix before next feature)
## 🟠 High Priority (fix this sprint)
## 🟡 Medium Priority (next sprint)
## 🟢 Low / Nice-to-Have
## 🗑️ Dead Code to Delete
## ⚡ Performance Opportunities
## 🧪 Test Coverage Gaps
## 📦 Bundle Opportunities

Every entry: file path + line number + one-sentence description. No fixes, no suggestions — findings only.