---
description: Audits and fixes React rendering performance: memoization, Zustand selector granularity, useCallback, lazy loading, bundle splitting.
argument-hint: [audit|fix] default: audit
---

Read CLAUDE.md. Specifically re-read the Gotchas section.
Run: npm run test 2>&1 | tail -3 — record baseline.
Mode: $ARGUMENTS (default: audit)

AUDIT TARGETS (always run first):

1. ZUSTAND ANTI-PATTERN — entire store subscriptions
   grep -rn "useCanvasStore()\|useUIStore()\|useSimulationStore()\|useLLMConfigStore()" src/components --include="*.tsx"
   Each hit re-renders the component on ANY store change. Must use selector: useCanvasStore(s => s.nodes)

2. MISSING REACT.MEMO
   grep -rn "^export default function\|^const.*: React.FC\|^export const.*= (" src/components --include="*.tsx" | grep -v memo | grep -v test | grep -v stories
   Every custom node component and every panel component must be wrapped in React.memo().

3. INLINE OBJECT/ARRAY PROPS (new reference every render)
   grep -rn "={{[^}]*}}\|={\[" src/components --include="*.tsx" | grep -v "className\|style={{" | head -20
   These break React.memo. Must be extracted to constants or useRef.

4. MISSING useCallback ON HANDLERS PASSED AS PROPS
   grep -rn "onChange={(\|onClick={(\|onSubmit={(" src/components --include="*.tsx" | head -20
   Arrow functions as props = new reference every render. Must use useCallback.

5. MISSING useMemo ON EXPENSIVE COMPUTATIONS
   grep -rn "\.filter(\|\.map(\|\.reduce(" src/components --include="*.tsx" | grep -v "useMemo\|useCallback" | head -20

6. REACT.LAZY CANDIDATES (panels not needed on initial render)
   List all panel components in src/components/ over 100 lines that are conditionally rendered.
   These should be React.lazy() + Suspense.

Output audit report with effort estimates (Low/Med/High) per fix.

If mode=fix:
- Fix Zustand selectors first (highest ROI, lowest risk)
- Then React.memo additions
- Then useCallback/useMemo
- Then React.lazy
- After each fix: npm run test → baseline must hold, tsc --noEmit → 0 errors
- Commit after each category: "perf([category]): [description]"