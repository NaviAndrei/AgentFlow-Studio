# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`
> See docs/progress-archive.md for Sessions 1–13 (and Session 8 and earlier, archived previously).



---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-24 -->
## Handoff — 2026-06-24 (Session 18 — docs: initialize project documentation and add architectural context logs)

### What was completed
- [x] Modified `.claude/hooks/on_stop_reminder.py`
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 319/319 passing |
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
- [ ] Wire `node.data.tools`/`toolName` into an actual tool-call dispatch loop for `tool:` nodes (currently a plain LLM call, no real external tool invocation) — Session 17 — MEDIUM
- [x] Add `maxTokens?: number` to `AgentFlowNodeData` — done (Session 12); wired into the actual provider request body (was previously display-only)
- [x] Remove inline Approve/Reject buttons from `MetricsBar.tsx` (duplicated by modal) — done (Session 15)
- [ ] Consider `-StepOnly` param for `pre-push-check.ps1` — human — LOW

## Known Gaps (intentionally deferred)
- **Viewport screenshot in headless**: stalls on html-to-image resource loading in the preview env — works in real browser. Not a regression.
- **TraceLog virtualization untested at scale**: engine clears trace per run, so 50+ entries never reached naturally. Re-verify if a merge-trace feature is added.
- **`G` shortcut escape hatch**: fires globally without `isEditableTarget` check — low risk today, re-evaluate if custom focusable editors are added.
- ~~**`on_stop_reminder.py` duplicate hook**: fires multiple times per session
  end producing N identical empty template blocks.~~ — fixed Session 14: guard checks
  if `(TODO: fill session name)` is in the first 400 chars before prepending.
