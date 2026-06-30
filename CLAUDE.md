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

## Gotchas & Pitfalls
- `sandboxExecutor`: `src/test-setup.ts` stubs `setTimeout` synchronously. Message listener + `srcdoc` must be set BEFORE arming the timeout. Do not reorder.
- `simulationStore.ts` ~2641: the `codeExecutor` simulated-mode fake is guarded to Simulate engine only.
- `callLLMDirect` wraps `streamChat()` for LLM interaction.
- `REGISTERED_NODE_TYPES` is the single source of truth for NL Builder. Any new node type must be added there first.

## Essential Development Invariants
- **Verification**: `npm run typecheck && npm run build` must pass successfully before every commit.
- **Rules & Constraints**: Scoped rules for components, stores, nodes, and code generation reside in `.claude/rules/`. Familiarize yourself with those rules before editing files in those paths.

## Git Commit Rules
- CI gate: `.github/workflows/ci.yml` runs typecheck → build → test on every push to main and develop.

## References
- Stores, engine, node registration → [ARCHITECTURE.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/ARCHITECTURE.md)
- Components, layout details → [COMPONENTS.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/COMPONENTS.md)
- Decision rationale & logs → [DECISIONS.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/DECISIONS.md)
- Task backlog & progress → [TASKS.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/TASKS.md)
- Session handoff → [progress.md](file:///c:/Users/IvanA/Claude_Code/AgentFLow-Studio/docs/progress.md)
- Pre-push CI → `scripts/pre-push-check.ps1` (typecheck → build → test pipeline)

## Auto-Memory & Feedback Rules
> Synced from `C:\Users\IvanA\.claude\projects\C--Users-IvanA-Claude-Code-AgentFLow-Studio\memory\`.

- `project_audit_2026-06-11_status.md` — Tracks the AgentFlow audit plan as complete; Blueprint thumbnails are intentionally deferred and should not be flagged as outstanding work.
- `feedback_solo_dev_main_only.md` — Development occurs solo directly on `main` branch.
- `feedback_reconcile_session_specs_with_code.md` — Requires verifying numbered "Session N" task specs against the live codebase first, since prior sessions may have already built features differently than the spec assumes.
- `feedback_no_autonomous_git.md` — Surface manual git commands for user approval instead of executing them autonomously.
