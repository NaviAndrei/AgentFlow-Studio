# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`
> See docs/progress-archive.md for Sessions 1–13 (and Session 8 and earlier, archived previously).







---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 22 — feat(tool-nodes): wire tool:/retriever: to HTTP endpoint via callTool())

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/components/Inspector.test.tsx`
- [x] Modified `src/components/Inspector.tsx`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 331/331 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
## Handoff — 2026-06-26 (Session 21 — Inspector endpoint fields for tool: nodes)

### What was completed
- Recon confirmed `endpointUrl`/`authToken` existed on `AgentFlowNodeData`
  (`src/types/index.ts:74`, Session 20) but were not yet rendered anywhere in
  `Inspector.tsx` — `ToolFields` and `RetrieverFields` had no UI for them.
- Added a shared `ToolEndpointFields({ data, update })` component
  (`Inspector.tsx`, after `ToolFields`) modeled on the `MCPServerFields`
  `serverUrl`/`authToken` pattern: "Endpoint URL" input (`type="url"`),
  "Auth Token" input (`type="password"`, masked), and a hint paragraph
  ("Leave Endpoint URL empty to use the LLM-only fallback mode."). Mounted
  it at the end of both `ToolFields` and `RetrieverFields`. ✅
- TDD: added 4 tests under `"Inspector tool: node — endpoint fields"` in
  `Inspector.test.tsx` (Endpoint URL label renders, Auth Token label renders,
  typing in Endpoint URL updates `node.data.endpointUrl` via the real
  `canvasStore`, retriever: node renders both fields too). All 4 failed
  pre-implementation (verified), all pass after. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (929 KB / 282 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **331/331 passing** (32 files), +4 net (327 → 331) |
| Browser smoke test | ✅ 5/5 — tool: node shows both fields, typing persists across deselect/reselect, retriever: node shows both fields |

### Decisions made this session
- `type="password"` on Auth Token — matches the masking already used for
  `authToken` on `A2AAgentFields` and `MCPServerFields`.
- Shared `ToolEndpointFields` helper instead of duplicating the two inputs
  in `ToolFields` and `RetrieverFields` separately — both node kinds use the
  identical `endpointUrl`/`authToken` shape from `AgentFlowNodeData`.
- Did not touch `MCPServerFields` (`serverUrl`/`authToken`), `default:`,
  `llm:`, or any simulation/store logic — UI-only change, the dispatch logic
  landed in Session 20.

### Known edge cases / deferred
- No validation on Endpoint URL format — a malformed URL will only surface
  as a failure at `callTool` time (toast), not inline in the Inspector.
- `authToken` is stored in plain Zustand state, not encrypted at rest —
  acceptable for MVP, same as the existing `MCPServerFields`/`A2AAgentFields`
  pattern.

### What to load at resume
```
@CLAUDE.md @docs/progress.md @ARCHITECTURE.md
```
---
## Handoff — 2026-06-26 (Session 20 — tool: HTTP endpoint dispatch)

### What was completed
- Added `endpointUrl?: string` to `AgentFlowNodeData` (`src/types/index.ts`) —
  reused the existing `authToken?: string` field rather than adding a
  duplicate, since it's already untyped/shared across node kinds.
- `tool:`/`retriever:` case in `executeLiveNode` (`src/store/simulationStore.ts`)
  now branches: if `node.data.endpointUrl` is set, dispatches via `callTool()`
  (same signature/pattern as the `mcpServer:` case) instead of calling the LLM.
  Falls back to the existing `buildToolContext` + `streamChat` LLM path when
  `endpointUrl` is unset. ✅
- TDD: added 4 tests under `"executeLiveNode tool: branch — HTTP endpoint
  dispatch"` in `simulationStore.test.ts` (tool: with endpoint dispatches to
  callTool not streamChat; tool: without endpoint falls back to streamChat;
  retriever: with endpoint dispatches to callTool; callTool throws → toast,
  no fallback to streamChat). 3 of 4 failed pre-implementation as expected
  (the no-endpointUrl case already passed against old code); all 4 pass after. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (928 KB / 282 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **327/327 passing** (32 files), +4 net (323 → 327) |
| Browser verification | N/A — store-level engine change, not browser-observable |

### Decisions made this session
- Fail loudly on `callTool` error (toast, no silent LLM fallback) — preserves
  user trust: if a tool endpoint is configured, a silent degrade to LLM would
  mask a broken integration.
- Did not add a new `authToken` field — reused the existing one already on
  `AgentFlowNodeData` (shared with the A2A Remote Agent node).
- Did not touch `mcpServer:`, `default:`, `llm:`, abort/retry core, or
  `callTool`/`parseToolCall` themselves — only the `tool:`/`retriever:` branch.

### Known edge cases / deferred
- No UI yet for setting `endpointUrl`/`authToken` on `tool:`/`retriever:` nodes
  in the canvas (fields exist on the type, not exposed in NodeConfigPanel) —
  tracked in TASKS.md as a Session 21 candidate.
- `callTool`'s response shape is assumed to match the `mcpServer:` case
  (JSON-stringified into the transcript) — not yet verified against a real
  external tool endpoint, only via the mocked test.

### What to load at resume
```
@CLAUDE.md @docs/progress.md @ARCHITECTURE.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-25 -->
## Handoff — 2026-06-25 (Session 19 — feat(hooks): auto-fill session handoff and sync Open TODOs on stop)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/store/simulationStore.test.ts`
- [x] Modified `src/store/simulationStore.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 323/323 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
## Handoff — 2026-06-25 (Session 18 — wire tool metadata into tool:/retriever: system prompt)

### What was completed
- Recon (Step 0) confirmed `node.data.tools`/`toolName` were declared in
  `AgentFlowNodeData` (`src/types/index.ts:66,69`) but never read anywhere in
  `simulationStore.ts`. `mcpServer:` already has a real tool-dispatch loop
  (`parseToolCall` + `callTool`), but it depends on `serverUrl`/`authToken`
  fields that `tool:` nodes don't have — no local tool-function registry
  exists anywhere, and no `src/llm/` transport parses structured tool-call
  responses. Building a full dispatch loop for `tool:` nodes would require
  new infrastructure, so scoped down to **Option B**: inject the node's
  declared tool metadata into the system prompt sent to `streamChat`.
- Added `buildToolContext(data: AgentFlowNodeData): string` next to
  `parseToolCall` (`simulationStore.ts:115`) — renders `toolName`/`tools[]`/
  `description` as a `"You have access to the following tool(s): ..."`
  addendum, returning `''` when no tool metadata is set.
- Wired it into the `case 'tool': case 'retriever':` branch
  (`simulationStore.ts:1253`) — system prompt is now
  `toolContext ? \`${basePrompt}\n\n${toolContext}\` : basePrompt` instead of
  ignoring `node.data.tools`/`toolName` entirely. ✅
- TDD: added 4 tests to `simulationStore.test.ts` under
  `"executeLiveNode — tool: branch — system prompt includes tool metadata"`
  (toolName+description, tools[] array, no-metadata no-crash case, retriever:
  variant). All 4 failed pre-implementation (verified), all pass after. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run test` | ✅ **323/323 passing** (32 files), +4 net (319 → 323) |

### Decisions made this session
- Did not touch `mcpServer:`, `default:`, `llm:`, abort, or retry logic — per
  session invariant.
- Did not add `serverUrl`/`authToken` to `tool:` node data or attempt to
  reuse `callTool` — that's the Option A full-dispatch path, deliberately
  out of scope (no real tool-execution backend exists for plain `tool:`
  nodes today).

### Known edge cases / deferred
- `tool:` nodes still make a plain LLM call — the model is now *told* about
  its declared tools via the system prompt, but there is still no real
  function/tool execution loop. A genuine dispatch loop (Option A) would
  need either a local tool-function registry or extending `tool:` nodes to
  carry MCP server connection fields, reusing `parseToolCall`/`callTool` —
  deferred as a larger, separate feature.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Handoff — 2026-06-25 (Session 17 — tool:/retriever: real execution)

### What was completed
- Task A — already real, no change needed. `case 'tool': case 'retriever':` in
  `executeLiveNode` (`simulationStore.ts:1240-1287`) already calls
  `streamChat(withMaxTokens(config, node.data.maxTokens), chat, onChunk, abortController.signal)`,
  identical pattern to the `default:`/`llm:` cases, with abort wiring and a toast +
  `{ error }` fallback on failure. Confirmed via test coverage already present
  (`simulationStore.test.ts:969`, `"executeLiveNode — tool/retriever branches real LLM"`). ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean |
| `npm run test` | ✅ 319/319 passing (32 files) |

### Decisions made this session
- No code change made — recon (per the session brief's Step 0 stop condition) found
  the branch already wired to real `streamChat` calls, so no test-first/implementation
  cycle was needed.
- Noted but out of scope: `node.data.tools?: string[]` and `toolName?: string`
  (`src/types/index.ts:66,69`) exist on node data but aren't consumed by the `tool:`
  case — execution is a plain LLM call, not an actual external tool/MCP invocation.
  That's a larger, separate feature (real tool-call dispatch), not a stub-removal fix.

### Known edge cases / deferred
- Wiring `node.data.tools`/`toolName` into an actual tool-call dispatch loop (vs. the
  current LLM-only call) is deferred — out of scope for this session.
- Non-live simulated engine path (`runSubgraph` inner fallback, top-level `else` when
  `liveMode` is false) intentionally still uses `fakeOutputFor`/`fakeTokensFor`/
  `fakeStreamTextFor` — that's the simulated mode's actual implementation, not a gap.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Handoff — 2026-06-24 (Session 16 — wire real LLM calls into executeLiveNode default:)

### What was completed
- Task A — already implemented (fakeStreamTextFor confirmed absent from `executeLiveNode`'s
  `default:` case via grep). The remaining `fakeStreamTextFor`/`fakeOutputFor`/`fakeTokensFor`
  hits are all in the non-live simulated engine path (the `else` branch taken when
  `liveMode` is false) and in `runSubgraph`'s own simulated fallback — by design, not
  leftover stubs. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (927.5 KB / 281.7 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **319/319 passing** (32 files) |

### Decisions made this session
- Recon (3 greps per the session brief) showed `executeLiveNode`'s `default:` case
  (`simulationStore.ts:1561`) already calls `streamChat(withMaxTokens(config, node.data.maxTokens), ...)`
  with abort-signal wiring and `onChunk` streaming — identical pattern to the `llm:` case.
  Existing coverage in `simulationStore.test.ts:912` (`"executeLiveNode — default branch real LLM"`)
  already asserts `streamChat` is called with the right model/system prompt, handles rejection
  with a toast, and tallies real tokens. No code change made; this TODO was stale.

### Known edge cases / deferred
- tool:/retriever: cases still use fakeOutputFor — separate task, not in scope here
- `runSubgraph`'s inner-node simulated fallback (lines ~2299-2371) and the top-level
  non-live `else` branch (lines ~2300-2371) intentionally keep `fakeOutputFor`/
  `fakeTokensFor`/`fakeStreamTextFor` — those power the simulated (non-live) engine mode,
  not a missing live-mode wire-up.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Handoff — 2026-06-24 (Session 15 — remove duplicate MetricsBar Approve/Reject buttons)

### What was completed
- Pre-flight recon confirmed: `MetricsBar.tsx` rendered its own inline Approve/Reject
  buttons (wired to `simulationStore.approve`/`reject`) gated on `pendingApproval`, fully
  duplicated by `HumanInLoopModal.tsx` (the canonical Human-in-Loop UX, with its own
  `reject`-on-cancel wiring).
- Task A — wrote `MetricsBar.test.tsx` first (2 tests: no Approve/Reject text when
  `pendingApproval` is set, and when it's null), watched it fail (found the real "Approve"
  button in the rendered output), then removed the inline button JSX, the `Check`/`X`
  icon imports, and the `approve`/`reject` store-hook lines that existed solely for those
  buttons. Kept `pendingApproval` (still drives the "Awaiting approval" label and the
  `disabled` props on Play/Step) and the "Awaiting approval" text itself — not part of the
  duplicate-button removal. Did not touch `HumanInLoopModal.tsx` or any `simulationStore`
  action. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (927.5 KB / 281.7 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **319/319 passing** (32 files), +2 net (317 → 319) |

### Decisions made this session
- Left `pendingApproval` wired into `MetricsBar` — it's still consumed by the "Awaiting
  approval" label and the Play/Step `disabled` conditions, so it isn't dead state.
- Approval/rejection now only happens through `HumanInLoopModal`; `MetricsBar` is
  read-only status display for that gate.

### Known edge cases / deferred
- None new this session.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Handoff — 2026-06-24 (Session 14 — CommandPalette confirm, pre-push hook, on_stop idempotency)

### What was completed
- Task A (CommandPalette "Clear Canvas" confirm) — recon found this was already fully
  implemented and tested in a prior session: `confirmClearOpen` state + the shared
  `ConfirmDialog` component, identical pattern to `Navbar.tsx`'s "New" button, with 2
  passing tests in `CommandPalette.test.tsx`. No code change needed. ✅
- Task B (wire pre-push hook) — `.git/hooks/pre-push` already existed but hardcoded
  `powershell.exe` with no fallback. Rewrote it to prefer `pwsh`, fall back to
  `powershell.exe`, and exit 0 with a warning (not a block) if neither is installed.
  Verified by running the hook directly: full typecheck/build/test pipeline fired,
  exited 0. ✅
- Task C (on_stop_reminder.py idempotency) — added a guard in `main()`: if the first
  ~400 chars of `docs/progress.md` already contain `(TODO: fill session name)`, skip
  the prepend and log `"skipped"` instead of writing a second empty template. Verified
  by running the hook twice in a row: first run prepends one block, second run is a
  no-op (still exactly 1 template block in the file). ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (928 KB / 282 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **317/317 passing** (31 files) |
| Pre-push hook dry-run | ✅ `.git/hooks/pre-push` invoked directly — full pipeline ran, exit 0 |

### Decisions made this session
- Did not modify `scripts/pre-push-check.ps1` (per constraint) — only the thin
  `.git/hooks/pre-push` wrapper script changed.
- Idempotency check uses a cheap substring match on the first 400 chars rather than
  parsing the markdown structure — the template's `(TODO: fill session name)` marker
  is unique enough and sits within that prefix immediately after the fixed header.
- Tested the idempotency fix against the real `docs/progress.md` (backed up first,
  restored after) rather than a throwaway fixture, since the hook's insertion-point
  logic depends on the file's real `---` separator structure.

### Known edge cases / deferred
- The idempotency guard only catches the *exact* unfilled-template case (`TODO: fill
  session name` still present). If a future session partially fills the header but
  leaves other TODO fields blank, a duplicate block could still be prepended — out of
  scope for this fix per the brief's "single guard, not a rewrite" constraint.
- `pwsh` and `powershell.exe` were both available in this environment, so the
  neither-installed warning path was reasoned through but not exercised by an actual
  missing-binary test.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Active Architecture Decisions
> Decisions made — preserves WHY across sessions

- **Cycles are warnings, not errors**: `MAX_NODE_VISITS = 2` is the runtime guard; `detectCycle` only toasts a warning for unguarded cycles (no router/condition/guardrail). See Session 10 Task B.
- **localStorage exception for snapshots**: `snapshotStore` uses `localStorage` (scoped exception to the "no localStorage" rule) — manual save slots require it. See Session 9 Task A.
- **`html-to-image` with `skipFonts: true`**: Cross-origin Google Fonts stylesheet causes SecurityError — exported PNGs use system monospace. See Session 8 Task A.
- **PowerShell-only CI**: `scripts/pre-push-check.ps1` — no bash. See Session 10 Prompt 10.

## Next Session Entrypoint
> Paste this into the agent at the start of the next session:

```
@CLAUDE.md @docs/progress.md
Continue from Session 15. Key context: 319/319 tests passing (32 files),
MetricsBar duplicate Approve/Reject buttons removed (modal is now the sole HIL UX).
Next priority: wire real LLM calls into default: branch of executeLiveNode in
src/store/simulationStore.ts (agent/supervisor/loop currently use fakeStreamTextFor
/ fakeOutputFor/fakeTokensFor stubs — confirmed still present via grep, Session 13).
```

## Open TODOs
- [x] Wire `pre-push-check.ps1` as a Git pre-push hook — done (Session 14); `.git/hooks/pre-push` prefers `pwsh`, falls back to `powershell.exe`, warns + exits 0 if neither found
- [x] Wire real LLM calls into `default:` branch of `executeLiveNode` (agent/supervisor/loop) — done (confirmed already implemented, Session 16); remaining fake* stubs are intentional, gating the non-live simulated engine path, not missing live wiring
- [x] Wire real execution into `tool:`/`retriever:` cases of `executeLiveNode` — done (confirmed already implemented, Session 17); both already call `streamChat` identically to `default:`/`llm:`
- [x] Wire `node.data.tools`/`toolName` into the `tool:`/`retriever:` system prompt — done (Session 18); scoped to Option B (system-prompt injection via `buildToolContext`), since no real tool-execution backend exists for plain `tool:` nodes (full dispatch loop remains deferred, see Known Gaps)
- [x] Add `maxTokens?: number` to `AgentFlowNodeData` — done (Session 12); wired into the actual provider request body (was previously display-only)
- [x] Remove inline Approve/Reject buttons from `MetricsBar.tsx` (duplicated by modal) — done (Session 15)
- [x] Wire `tool:`/`retriever:` nodes into real tool-dispatch loop — done (Session 20); HTTP endpoint path via `callTool()` reuse, gated on `node.data.endpointUrl`; LLM-only path remains the fallback
- [x] Expose `endpointUrl`/`authToken` fields on `tool:`/`retriever:` nodes in NodeConfigPanel — done (Session 21); added via shared `ToolEndpointFields` in `Inspector.tsx`
- [ ] Consider `-StepOnly` param for `pre-push-check.ps1` — human — LOW

## Known Gaps (intentionally deferred)
- **Viewport screenshot in headless**: stalls on html-to-image resource loading in the preview env — works in real browser. Not a regression.
- **TraceLog virtualization untested at scale**: engine clears trace per run, so 50+ entries never reached naturally. Re-verify if a merge-trace feature is added.
- **`G` shortcut escape hatch**: fires globally without `isEditableTarget` check — low risk today, re-evaluate if custom focusable editors are added.
- ~~**`on_stop_reminder.py` duplicate hook**: fires multiple times per session
  end producing N identical empty template blocks.~~ — fixed Session 14: guard checks
  if `(TODO: fill session name)` is in the first 400 chars before prepending.
