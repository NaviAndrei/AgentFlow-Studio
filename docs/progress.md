# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`
> See docs/progress-archive.md for Sessions 1–13 (and Session 8 and earlier, archived previously).












---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 27 — feat(ux): warn on mount when tool/retriever nodes have endpointUrl but no authToken)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/store/snapshotStore.test.ts`
- [x] Modified `src/store/snapshotStore.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 354/354 passing |
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
## Handoff — 2026-06-26 (Session 26 — warnMissingTokens wired to real triggers)

### What was completed
- Extracted the authToken-missing warning logic from `App.tsx`'s inline mount
  effect into `src/utils/warnMissingTokens.ts` (`warnMissingTokens(nodes?)`,
  defaults to reading `useCanvasStore.getState().nodes` when called with no
  argument). `App.tsx`'s mount effect now just calls `warnMissingTokens()`. ✅
- `?flow=` decode callback (`App.tsx`) now also calls
  `warnMissingTokens(result.nodes)` right after `loadGraph` — closes the gap
  noted in Session 25's handoff (the mount-effect warning ran before the async
  decode resolved, so a `?flow=`-restored node never got checked). ✅
- `restoreSnapshot` (`src/store/snapshotStore.ts`) now calls
  `warnMissingTokens(snapshot.nodes)` after `loadGraph`/`markClean` — closes
  the other gap from Session 25 (manual Snapshot Manager restores also ran
  after the one-shot mount check).
- TDD: new `src/utils/warnMissingTokens.test.ts` (3 tests: warns with node
  label, silent on empty list, silent when authToken set) — all failed
  pre-implementation (module didn't exist), all pass after. Added 2 tests to
  `snapshotStore.test.ts` under "restoreSnapshot warns about missing tokens"
  (warns when restored node missing token, silent when token present) — first
  failed pre-implementation as expected, both pass after. Existing
  `App.test.tsx` suite (4 tests) continues to pass unchanged against the
  refactored `App.tsx`, confirming the extraction preserved behavior.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (931.88 KB / 282.89 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **354/354 passing** (34 files), +5 net (349 → 354) |
| Browser verification | N/A — store/utility-level wiring, not independently browser-observable beyond what Session 25's smoke test already covered |

### Decisions made this session
- Single shared helper (`warnMissingTokens`) instead of three copies of the
  filter/toast logic — same check now runs from mount, `?flow=` decode, and
  manual snapshot restore.
- Helper takes an optional `nodes` param (defaulting to live `canvasStore`
  state) so callers that already have the relevant node list in hand
  (`?flow=` decode result, snapshot's own `nodes`) can pass it directly
  instead of re-reading from `canvasStore` after the write.

### Known edge cases / deferred
- None new — this session closes both edge cases flagged in Session 25's
  handoff (the `?flow=` async-resolution gap and the Snapshot Manager restore
  path).

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 26 — fix(security+export): authToken excluded from localStorage + BaseRetriever export)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 349/349 passing |
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
## Handoff — 2026-06-26 (Session 25 — authToken reload warning)

### What was completed
- Recon: no `onRehydrateStorage`/persist hook anywhere — `canvasStore` has no
  Zustand `persist` middleware (confirmed again, same finding as Session 24).
  Snapshots in `snapshotStore` are manual save slots, not auto-restored on
  page load. `toastStore` exposes `pushToast(text, tone)`, not `.warn`/`.info`
  — used that API instead of the brief's hypothetical `useToastStore.warn()`.
- `App.tsx`: added a second one-shot `useEffect` (`[]` deps, alongside the
  existing `?flow=` URL-decode effect) that reads `useCanvasStore.getState().nodes`
  once on mount and pushes a `'warning'` toast naming any `tool:`/`retriever:`
  node that has `endpointUrl` set but no `authToken` — the state Session 24's
  snapshot-stripping leaves a restored node in. ✅
- TDD: created `src/App.test.tsx` (new file) — 4 tests under "App mount —
  authToken reload warning": warns with node label when endpointUrl set/no
  token; silent when both set; silent when no endpointUrl; silent when no
  tool:/retriever: nodes. Spied on `useToastStore.getState().pushToast` rather
  than reading `toasts` from state, since the test harness's `window.setTimeout`
  mock (`src/test-setup.ts`) fires the toast's auto-dismiss synchronously,
  which would otherwise make the toast invisible by the time the test asserts.
  Test A failed pre-implementation as expected (3/4 passed vacuously as
  correct regression guards), all 4 pass after. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (931.83 KB / 282.86 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **349/349 passing** (33 files), +4 net (345 → 349) |
| Browser verification | ⚠️ see below |

### Decisions made this session
- Used `pushToast(text, 'warning')` (the real `toastStore` API) instead of the
  brief's hypothetical `.warn()`/`.info()` methods, which don't exist.
- Spy on `pushToast` in tests instead of asserting on `toasts` array length —
  the synchronous-timer test mock auto-dismisses toasts within the same tick.
- Kept the check in `App.tsx` per the brief, even though `components.md`'s
  "no business logic in App.tsx" rule technically applies — the existing
  `?flow=` decode effect is the same shape of one-shot mount logic, so this
  follows established precedent rather than introducing a new pattern.

### Known edge cases / deferred
- **Functionally this warning cannot fire via a real page reload today**:
  `canvasStore` has no persistence, so `nodes` is always `[]` at mount time
  in normal use. The only way to populate the canvas is (a) the `?flow=`
  query-param decode, which resolves *after* this effect already ran (its
  `decodeFlow(...).then(...)` is async), or (b) the user manually opening the
  Snapshot Manager and clicking Restore — also after mount. Browser smoke
  test confirmed canvas starts empty on load (no nodes, no toast) — expected,
  not a bug, given the lack of auto-rehydration. The implemented mount-check
  is correct per the brief and is exercised by the unit tests; closing the
  real-world gap would require also running the same check inside
  `restoreSnapshot` (snapshotStore.ts) and/or the `?flow=` decode callback —
  out of scope for this session, flagged here for a future session if the
  warning needs to actually surface in practice.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
## Handoff — 2026-06-26 (Session 24 — authToken security + retriever export)

### What was completed
- Recon found `canvasStore` has no Zustand `persist` middleware at all — the
  actual localStorage write path for node data is `snapshotStore.ts`'s manual
  `saveSnapshot`, which deep-cloned `nodes`/`edges` verbatim (including
  `authToken`) before `localStorage.setItem`. Adapted Task A to that real path.
- Task A — `saveSnapshot` (`src/store/snapshotStore.ts`) now strips
  `authToken` (sets it to `undefined`) from each node's `data` before the
  `JSON.parse(JSON.stringify(...))` deep clone that gets persisted, so the
  secret never reaches `localStorage`. ✅
- Task B — `retriever:` case with `endpointUrl` set (`src/utils/codeExporter.ts`)
  now emits a `BaseRetriever` subclass (`_get_relevant_documents` returning
  `List[Document]`) instead of a plain `RunnableLambda`-style function; the
  graph node function calls `.invoke()` on an instance of that class. The
  no-endpoint placeholder path is unchanged. `from langchain_core.retrievers
  import BaseRetriever` / `from langchain_core.documents import Document` /
  `List` import are gated on `hasHttpRetriever`. ✅
- TDD: 2 new tests in `snapshotStore.test.ts` (localStorage write excludes
  `authToken`/its value; reload from storage leaves `node.data.authToken`
  `undefined`). 3 new tests in `codeExporter.test.ts` under "LangGraph export
  — retriever: proper class" (`BaseRetriever` + `_get_relevant_documents`
  present, no `RunnableLambda`; no-endpoint path unchanged; authToken never
  verbatim). All failed pre-implementation as expected, all pass after. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (931.48 KB / 282.71 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **345/345 passing** (32 files), +5 net (340 → 345) |

### Decisions made this session
- `authToken: undefined` (not `''`) when stripping before persistence —
  `undefined` means "never set / not in this snapshot", `''` would mean "user
  explicitly cleared it", a different state.
- `BaseRetriever` over `RunnableLambda` — matches LangChain's standard
  retriever interface (`_get_relevant_documents` is the sync contract);
  `_aget_relevant_documents` (async) intentionally not added — MVP scope.
- Class name derived from the existing deduped `name` identifier
  (`${Name}Retriever`) rather than a new naming scheme, keeping generated
  code consistent with how other node names are already resolved.
- Did not touch `canvasStore.ts` (no `persist` middleware exists there —
  the Task A brief's `partialize` pattern didn't apply) or the `tool:` case
  in `codeExporter.ts` (out of scope; only `retriever:` needed the class
  treatment per the session brief).

### Known edge cases / deferred
- `authToken` is lost from snapshots on reload by design — no UI warning yet
  if a restored `tool:`/`retriever:` node has `endpointUrl` set but an empty
  `authToken`.
- `BaseRetriever._get_relevant_documents` is sync only; no async
  `_aget_relevant_documents` override — acceptable for MVP, same posture as
  prior sessions' HTTP-endpoint stubs.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 24 — feat(tool-nodes): URL validation guard + authToken plain-text warning)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/utils/codeExporter.test.ts`
- [x] Modified `src/utils/codeExporter.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 340/340 passing |
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
## Handoff — 2026-06-26 (Session 23 — LangGraph export verification for tool:/retriever: endpointUrl/authToken)

### What was completed
- Recon found the real gap: `case 'tool'`/`case 'retriever'` in `exportPython`
  (`src/utils/codeExporter.ts`) never read `node.data.endpointUrl`/`authToken`
  at all — both emitted a static `@tool` stub (`raise NotImplementedError`) or
  a `# TODO: wire a real vector store` stub regardless of those fields.
- `tool:` case now branches: if `endpointUrl` is set, emits an `httpx.post`-backed
  node function (`Authorization: Bearer {os.environ.get(...)}`) instead of the
  `@tool` stub; falls back to the existing stub when `endpointUrl` is empty.
  `toolNodes`/`hasTools` filters updated so the unused `@tool` stub/import isn't
  emitted for endpoint-backed tool nodes. ✅
- `retriever:` case gets the same `httpx.post` branch (includes `top_k` in the
  request body), falling back to the existing vector-store TODO stub when
  `endpointUrl` is empty. ✅
- Added `authTokenEnvVar(nodeId)` helper — `authToken` is never exported
  verbatim; the request always reads `os.environ.get('TOOL_{NODEID}_AUTH_TOKEN', '')`.
  `exportRequirements` and the global `import httpx`/`import os` conditions
  extended to cover endpoint-backed `tool:`/`retriever:` nodes. ✅
- TDD: 4 new tests under `"exportPython — tool:/retriever: nodes with
  endpointUrl/authToken"` in `codeExporter.test.ts` (no-endpoint stub has no
  endpointUrl/authToken strings; with-endpoint tool emits the URL + env-var
  auth; with-endpoint retriever same; authToken value never appears verbatim).
  All 3 endpoint-dependent tests failed pre-implementation as expected (the
  no-endpoint case already passed against old code); all 4 pass after. ✅
- Manual smoke check (ad-hoc vitest run, not the browser UI — this is a pure
  export function, not browser-observable): confirmed `https://api.example.com/search`
  appears in the output and `sk-secret` does not; `os.environ.get('TOOL_T_AUTH_TOKEN', '')`
  appears instead.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (930.79 KB / 282.48 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **340/340 passing** (32 files), +4 net (336 → 340) |
| Browser verification | N/A — pure codegen function, not browser-observable (per project's preview-skip rule) |

### Decisions made this session
- Used `httpx` (already imported for `a2aAgent`/`httpRequest` nodes) instead
  of `requests` — keeps the generated file's dependency surface consistent,
  avoids adding a second HTTP library to `exportRequirements`.
- `os.environ.get('TOOL_{NODEID}_AUTH_TOKEN', '')` (default `''`, not a
  `KeyError`-raising `os.environ[...]`) — a misconfigured/missing env var
  should not crash the generated script at import time.
- Did not touch `simulationStore.ts`, `Inspector.tsx`, or `types/index.ts` —
  scoped entirely to `codeExporter.ts` + its test file, per session brief.

### Known edge cases / deferred
- `retriever:` HTTP export reuses the same `httpx.post` shape as `tool:` —
  may warrant a dedicated LangGraph retriever class for production use.
- Generated imports (`httpx`, `os`) aren't checked for conflicts with a
  user's pre-existing custom graph imports — acceptable for MVP, same as
  the existing `a2aAgent`/`httpRequest` import logic.

### What to load at resume
```
@CLAUDE.md @docs/progress.md @ARCHITECTURE.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 23 — feat(inspector): expose endpointUrl + authToken fields for tool:/retriever: nodes)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/components/Inspector.test.tsx`
- [x] Modified `src/components/Inspector.tsx`
- [x] Modified `src/store/simulationStore.test.ts`
- [x] Modified `src/store/simulationStore.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 336/336 passing |
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
## Handoff — 2026-06-26 (Session 22 — URL validation + authToken warning)

### What was completed
- Task A — `URL.canParse()` guard added in `executeLiveNode`'s `tool:`/`retriever:`
  branch (`src/store/simulationStore.ts`), right before the existing
  `callTool` dispatch. A malformed `endpointUrl` now toasts an "Invalid
  endpoint URL on node ..." warning and returns `{ error }` immediately —
  no `callTool` or `streamChat` call. Empty-string `endpointUrl` is still
  falsy, so it's unaffected and continues to fall back to `streamChat`. ✅
- Task B — added a plain-text export warning in `Inspector.tsx`'s
  `ToolEndpointFields`, shown directly under the Auth Token input when
  `data.authToken` is non-empty, styled with the existing
  `text-amber-400` pattern (matches `MCPServerFields`'s insecure-URL
  warning). ✅
- TDD: 3 new tests in `simulationStore.test.ts` under
  `"executeLiveNode tool: branch — endpointUrl validation"` (malformed URL
  toasts + no dispatch, empty string falls back to streamChat, valid URL
  still calls callTool as a regression guard). 2 new tests in
  `Inspector.test.tsx` under `"Inspector tool: node — authToken export
  warning"` (warning renders when authToken is typed, absent when empty).
  All failed pre-implementation as expected, all pass after. ✅

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (929 KB / 282 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **336/336 passing** (32 files), +5 net (331 → 336) |

### Decisions made this session
- `URL.canParse()` over `new URL()` try/catch — cleaner, no exception
  overhead, available in the project's modern browser/Node target.
- Early-exit on invalid URL returns `{ error }` without calling `callTool`
  OR `streamChat` — fail loudly, consistent with the existing Session 20
  decision that a misconfigured tool node should not silently degrade to
  the LLM-only path.
- Warning shown inline in the Inspector (not a modal) — non-blocking,
  visible exactly when the user is editing the Auth Token field.

### Known edge cases / deferred
- `authToken` is still plain Zustand state, not encrypted at rest — same
  acceptable-for-MVP posture as Session 21/20; would need a secrets store
  for production hardening.
- URL validation only checks format via `URL.canParse()`, not reachability
  — a syntactically valid URL pointing at a dead server still fails at
  `callTool` time with the existing network-error toast.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
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
