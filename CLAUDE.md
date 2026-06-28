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
| `canvasStore` | nodes, edges, selection, `pendingNodes`/`pendingEdges` (ghost nodes from NL Builder, commit via `commitPendingFlow()`) |
| `blueprintStore` | blueprint load/save |
| `simulationStore` | run engine, abort, retries |
| `llmConfigStore` | provider registry |
| `uiStore` | panel visibility, railOffsetPx, inspectorWidth, `currentRole` (WorkspaceRole, localStorage-persisted), `checkPermission(action)` (RBAC is UI-only / demo mode — backend auth is V2) |
| `promptStore` | prompt registry |
| `evalStore` | eval suite, dataset import |
| `runHistoryStore` | run records, trace archive |

## Utilities (`src/utils/`)
| File | Purpose |
|------|---------|
| `callLLMDirect.ts` | Thin async wrapper over `streamChat()`; used by F13 Suggest + F14 NL Builder. Never call from Zustand actions. |
| `wordDiff.ts` | Pure LCS word-diff, zero imports. Used by `SuggestionDiffPreview`. |
| `buildSuggestionPrompt.ts` | Builds the system prompt string for the ✨ Suggest feature. |
| `nlToFlow.ts` | Schema-constrained LLM→graph generator; validates against `REGISTERED_NODE_TYPES` whitelist. Used by `NLFlowBuilderModal`. |
| `a2aClient.ts` | `fetchAgentCard` / `sendA2ATask` / `pollA2ATask` — A2A v1.0 JSON-RPC. Never throws. |
| `sandboxExecutor.ts` | iframe JS sandbox + lazy Pyodide Python. V1 security model (see file header). V2: E2B. |

## Hooks (`src/hooks/`)
| File | Purpose |
|------|---------|
| `usePermission.ts` | `usePermission(action)` — selector hook for RBAC; reads `uiStore.checkPermission`. |

## Gotchas & Pitfalls
- `sandboxExecutor`: `src/test-setup.ts` stubs `setTimeout` synchronously. Message listener + `srcdoc` must be set BEFORE arming the timeout. Do not reorder.
- `simulationStore.ts` ~2641: the `codeExecutor` simulated-mode fake is guarded to Simulate engine only. Do not remove the guard.
- `callLLMDirect` wraps `streamChat()` — do NOT add a parallel raw fetch path.
- `REGISTERED_NODE_TYPES` is the single source of truth for NL Builder. Any new node type must be added there first.

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
