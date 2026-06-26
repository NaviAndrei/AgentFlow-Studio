# AgentFlow Studio — Developer Guide & Memory
<!-- Stack: React 19 · Vite 6 · TS strict · @xyflow/react v12 · Zustand · Tailwind v4 -->
<!-- Platform: Windows 11 · PowerShell only — no bash scripts, no /tmp paths -->

## Build & Test Commands
```bash
npm run dev          # Start local dev server (default port 3000)
npm run build        # Build production bundle
npm run typecheck    # Run TypeScript compiler checks (MUST run before every commit)
npm run test         # Run Vitest suite
```

## Core Stack
- **Framework**: React 19, Vite 6, TypeScript (strict mode)
- **Flow Engine**: `@xyflow/react` v12 (React Flow)
- **State Management**: Zustand
- **Styling**: Tailwind CSS v4, Lucide Icons

## Active Stores
| Store | Owns |
|-------|------|
| `canvasStore` | nodes, edges, selection |
| `blueprintStore` | blueprint load/save |
| `simulationStore` | run engine, abort, retries |
| `llmConfigStore` | provider registry |
| `uiStore` | panel visibility, railOffsetPx, inspectorWidth |
| `promptStore` | prompt registry |
| `evalStore` | eval suite, dataset import |
| `runHistoryStore` | run records, trace archive |

## Essential Development Invariants
- **Verification**: `npm run typecheck && npm run build` must pass successfully before every commit.
- **Rules & Constraints**: Scoped rules for components, stores, nodes, and code generation reside in `.claude/rules/`. Familiarize yourself with those rules before editing files in those paths.

## Git Commit Rules
- CI gate: `.github/workflows/ci.yml` runs typecheck → build → test on every push to main and develop. Do not merge a PR with a failing CI run.

## Session Rituals
- Before code: run `/resume` to restore context. Plan a session with `/plan` (writes `docs/session-plan.md`, waits for Y before opening files).

## References
- Stores, engine, node registration → [ARCHITECTURE.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/ARCHITECTURE.md)
- Components, layout details → [COMPONENTS.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/COMPONENTS.md)
- Decision rationale & logs → [DECISIONS.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/DECISIONS.md)
- Task backlog & progress → [TASKS.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/TASKS.md)
- Session handoff → [progress.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/docs/progress.md)
- Pre-push CI → `scripts/pre-push-check.ps1` (typecheck → build → test pipeline)
