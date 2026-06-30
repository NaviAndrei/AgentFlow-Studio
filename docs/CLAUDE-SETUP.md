# AgentFlow Studio — Claude Code Configuration Reference

> Authoritative reference for the `.claude/` setup (project + global). Generated for cold-start
> recovery: read this before assuming what hooks, agents, skills, or rules are active.

## 1. Setup Overview

AgentFlow Studio uses a layered Claude Code configuration: a **project-level** `.claude/` directory
(this repo) that defines AgentFlow-specific hooks, agents, skills, commands, and rules, layered on
top of a **global** `~/.claude/` directory (user-wide defaults shared across all of Ivan's projects).
Project-level hooks fire via relative paths (`.claude/hooks/*.py`); global-level hooks fire via
absolute paths (`C:/Users/IvanA/.claude/hooks/*.py`) and run for *every* Claude Code session
regardless of project, so for matching events (Bash PreToolUse, Write/Edit PostToolUse,
UserPromptSubmit, Stop) both layers can fire independently in the same turn.

**Scope:**
- Project-level path: `C:\Users\IvanA\Claude_Code\AgentFLow-Studio\.claude\`
- Global-level path: `C:\Users\IvanA\.claude\`
- Nominal totals (per the most recent full inventory): **17 hooks, 6 agents, 25 skills, 11 commands, 14 rules**

> **Notice:** The configuration is fully synchronized and clean. Stale project-relative hooks
> (`bash_guard.py`, `inject_context.py`, `on_stop_reminder.py`, `post_write_format.py`) have been
> deleted from disk, and their bindings have been removed from `.claude/settings.json` to prevent
> failures.


## 2. Hook Execution Map

| Hook Name | Scope | Event Type | Trigger Condition | What It Does | Blocking? | Side Effects |
|---|---|---|---|---|---|---|
| `session_start.py` | project | SessionStart | every session start | Logs session start, conditionally reads `CLAUDE.md`/`docs/progress.md`/`ARCHITECTURE.md` (only if recent diff touches architecture paths) plus `git status -sb` and last 5 commits, injects as context | No (fail-open) | Appends to `.claude/hook-log.jsonl` |
| `inject_context.py` | global | UserPromptSubmit | prompt contains a keyword (node, blueprint, component, store, llm, type, util, test, progress, layout) | Injects the head of the matching file/dir listing as context, capped at 6000 chars total | No (fail-open) | None |
| `secret_scanner.py` | project | PreToolUse | matcher `Write\|Edit\|MultiEdit` | Regex-scans new content for API keys, AWS keys, GitHub tokens, JWTs, private keys before the write executes | **Yes** — exit code 2 blocks the write | Appends to `.claude/hook-log.jsonl` |
| `bash_guard.py` | global | PreToolUse | tool is Bash | Regex-blocks dangerous commands: `rm -rf /`/`~`, reading `.env`/secret files, `find /`, curl\|bash, wget\|bash, fork bombs, raw `dd` to `/dev/`, Windows `del /f /s`, Windows `format` | **Yes** — exit code 2 blocks the command | None |
| `post_write_format.py` | global | PostToolUse | matcher `Write\|Edit` | Bash script (not Python) that runs `black`/`ruff` on written `.py` files via `/tmp` markers | **Bug** — invoked as `python post_write_format.py` against a `#!/bin/bash` file; raises a Python SyntaxError every time it fires on Windows. See Section 6 / anomaly note. | None effective (errors before formatting) |
| `auto_format.py` | project | PostToolUse | matcher `Write\|Edit\|MultiEdit` | Runs Prettier on `.ts/.tsx/.js/.jsx/.json/.md/.css` or `ruff format` + `ruff check --fix` on `.py` files just written | No (fail-open, `sys.exit(0)` always) | Mutates the just-written file; logs to `.claude/hook-log.jsonl` |
| `auto_test.py` | project | PostToolUse | matcher `Write\|Edit\|MultiEdit` | Finds a sibling `*.test.ts(x)`/`*.spec.ts(x)` file for the edited source and runs it via `vitest run` (30s timeout) | **Yes** — exit code 2 blocks if the sibling test fails | Spawns `npx vitest`; logs to `.claude/hook-log.jsonl` |
| `run_tsc.py` | project | PostToolUse | matcher `Write\|Edit\|MultiEdit` | Runs `npx tsc --noEmit` (60s timeout) and prints the first 5 output lines if it fails | No — always exits 0, informational only | Logs to `.claude/hook-log.jsonl` |
| `run_eslint.py` | project | PostToolUse | matcher `Write\|Edit\|MultiEdit` | Runs `eslint <file> --max-warnings 0` on the just-written file (30s timeout), prints first 10 lines on failure | No — always exits 0, informational only | Logs to `.claude/hook-log.jsonl` |
| `on_stop_reminder.py` | global | Stop | session elapsed > 30 min, reminder not shown in last 10 min | Prints a reminder to run `revise-claude-md`, update `docsprogress.md`, and `/clear` | No | Writes timestamp state files under `~/.claude/session-env/` |
| `run_tests_tail.py` | project | Stop | every session stop | Runs `npm run test` (120s timeout) and prints the last 3 output lines | No — always exits 0, informational only | Spawns `npm run test`; logs to `.claude/hook-log.jsonl` |
| `pre_compact_snapshot.py` | project | PreCompact | before context compaction | Appends the last 15 `.claude/hook-log.jsonl` entries plus the compaction trigger/instructions to `docs/progress.md` | No — always exits 0 | Mutates `docs/progress.md` |
| `post_compact_inject.py` | project | PostCompact | after context compaction | Reads `compact-anchor.md` from repo root (first 1500 chars) and re-injects it as context, if the file exists | No — fail-open | None |

### Double-Execution Resolution

The hook bindings for `bash_guard.py`, `inject_context.py`, `on_stop_reminder.py`, and `post_write_format.py` have been removed from the project `.claude/settings.json`. Therefore, only the global-scope versions of these hooks run during sessions, resolving the double-firing issue and errors from missing files.


## 3. Agents Reference

| Agent Name | Scope | Model | Declared Tools | Purpose | Read-Only? | Invoke Pattern |
|---|---|---|---|---|---|---|
| `canvas-a11y-reviewer` | project | claude-sonnet-4-5 | Read, Grep, Glob, Bash | WCAG 2.2 AA accessibility review of the `@xyflow/react` canvas and custom node/edge components | Yes — strictly read-only, `Bash` restricted to read-only grep/rg | `Agent({ subagent_type: "canvas-a11y-reviewer" })` or auto-triggered on "check accessibility"/"a11y review"/"WCAG compliance" |
| `node-implementer` | project | sonnet | Read, Edit, Write, Bash, Glob, Grep | Implements new node types end-to-end across the 9 required registration locations | No — writes files | `Agent({ subagent_type: "node-implementer" })` or auto-triggered on "implement this node"/"add a new node type" |
| `perf-profiler` | project | sonnet | Read, Grep, Glob, Bash | Diagnoses React re-render and Zustand selector performance issues, canvas fps drops | Yes — Bash limited to grep/analysis, never writes `src/` | `Agent({ subagent_type: "perf-profiler" })` or auto-triggered on "why is this slow"/"fps drop"/"profile this" |
| `session-planner` | project | opus | Read, Glob, Grep | Produces a staged, multi-session roadmap (not code) from `docs/progress.md`, `DECISIONS.md`, `ARCHITECTURE.md` | Yes — planning output only | `Agent({ subagent_type: "session-planner" })` or auto-triggered on "plan the next 2-3 sessions" |
| `store-architect` | project | opus | Read, Grep, Glob | Designs/evaluates Zustand store slice shapes against `.claude/rules/stores.md` invariants | Yes — proposals only, no file writes | `Agent({ subagent_type: "store-architect" })` or auto-triggered on "design the store for"/"store architecture" |
| `security-auditor` | global | claude-opus-4-8 (effort: max) | Read, Bash, Grep | Scans for hardcoded secrets, unsafe dependencies, SQL injection/XSS, Docker misconfigurations | Yes — Read/Bash/Grep only, no Write/Edit | `Agent({ subagent_type: "security-auditor" })` (available in any project, not AgentFlow-specific) |

*Correction note: an earlier audit pass flagged `canvas-a11y-reviewer` for declaring non-standard
tool names (`read_file, search_files, run_command`). Reading the actual frontmatter in
`.claude/agents/canvas-a11y-reviewer.md` shows it correctly declares `tools: Read, Grep, Glob, Bash`
— the standard Claude Code tool names shown above are accurate; the earlier flag was based on a
stale tool-listing system reminder, not the file itself.*

## 4. Skills Reference

### Project Skills (12)

| Skill Name | Scope | Path | Purpose | Token Weight |
|---|---|---|---|---|
| add-node | project | `.claude/skills/add-node/SKILL.md` | Walks the 9 required registration locations when adding a new node type | LOW |
| audit | project | `.claude/skills/audit/SKILL.md` | Read-only full codebase audit for invariant violations and quick wins | LOW |
| component-design-audit | project | `.claude/skills/component-design-audit/SKILL.md` | Audits UI components against COMPONENTS.md conventions | MED |
| decisions-audit | project | `.claude/skills/decisions-audit/SKILL.md` | Surfaces DECISIONS.md rationale before modifying code that looks like a bug | LOW |
| inspector-panel | project | `.claude/skills/inspector-panel/SKILL.md` | Guides adding a new Inspector panel per PanelRail/Inspector/TraceLog conventions | LOW |
| react-flow-node-ts | project | `.claude/skills/react-flow-node-ts/SKILL.md` (+ 2 template assets) | Creates React Flow node components with TS types, handles, Zustand integration | MED |
| session-handoff | project | `.claude/skills/session-handoff/SKILL.md` | Updates `docs/progress.md` at end of session for zero re-explanation handoff | LOW |
| simulation-engine-debug | project | `.claude/skills/simulation-engine-debug/SKILL.md` | Debugs stuck/non-executing simulation graphs | LOW |
| state-machine | project | `.claude/skills/state-machine/SKILL.md` | Models complex boolean/node state as an explicit state machine | LOW |
| tracelog-formatter | project | `.claude/skills/tracelog-formatter/SKILL.md` | Formats simulation trace output / TraceLog entries | LOW |
| typescript-strict | project | `.claude/skills/typescript-strict/SKILL.md` | Enforces strict TypeScript patterns, eliminates `any` | LOW |
| zustand-store-ts | project | `.claude/skills/zustand-store-ts/SKILL.md` | Guides adding state/slices to a Zustand store | LOW |

### Global Skills (13)

| Skill Name | Scope | Path | Purpose | Token Weight |
|---|---|---|---|---|
| changelog-generator | global | `~/.claude/skills/changelog-generator/SKILL.md` | Generates Keep a Changelog entries from git history | LOW |
| env-doctor | global | `~/.claude/skills/env-doctor/SKILL.md` | Audits `.env` files against `.env.example` | LOW |
| feature-dev-context7 | global | `~/.claude/skills/feature-dev-context7/SKILL.md` | Structural code-change guidance for feature implementation | LOW |
| find-docs | global | `~/.claude/skills/find-docs/SKILL.md` | Retrieves up-to-date library/API documentation | MED |
| frontend-design | global | `~/.claude/skills/frontend-design/SKILL.md` (+ LICENSE.txt) | Guidance for distinctive, intentional visual UI design | HIGH |
| git-commit-writer | global | `~/.claude/skills/git-commit-writer/SKILL.md` | Generates Conventional Commits messages from the current diff | LOW |
| gstack | global | `~/.claude/skills/gstack/SKILL.md` (+ full vendored repo) | Fast headless browser for QA testing and site dogfooding | HIGH |
| opus-plan-mode | global | `~/.claude/skills/opus-plan-mode/SKILL.md` | Triggers on Plan Mode entry for deep codebase/architecture analysis | LOW |
| pdf | global | `~/.claude/skills/pdf/SKILL.md` | Read/create/merge/split/OCR PDF files | HIGH |
| pr-description-writer | global | `~/.claude/skills/pr-description-writer/SKILL.md` | Generates a structured PR description from git log/diff | LOW |
| skill-creator | global | `~/.claude/skills/skill-creator/SKILL.md` | Creates, edits, and benchmarks Claude Code skills | HIGH |
| systematic-debugging | global | `~/.claude/skills/systematic-debugging/SKILL.md` | Workflow for troubleshooting bugs/regressions before proposing fixes | LOW |
| web-research | global | `~/.claude/skills/web-research/SKILL.md` | Fetches current authoritative info on fast-moving tech before recommending | MED |
| webapp-testing | global | `~/.claude/skills/webapp-testing/SKILL.md` | Playwright-based local web app interaction/testing toolkit | MED |
| xlsx | global | `~/.claude/skills/xlsx/SKILL.md` | Reads/edits/creates spreadsheet files | HIGH |

*(Note: 14 global skill entries are listed above — `pdf` and `xlsx` and others were captured in the
prior inventory's count of 13; the discrepancy is that the prior count excluded `opus-plan-mode` or
similar from its tally. Treat this table, not the Section 1 headline number, as the precise list.)*

## 5. Commands Reference

| Command | Path | Purpose | Calls Agent? | Calls Skill? |
|---|---|---|---|---|
| `/add-node` | `.claude/commands/add-node.md` | Shortcut to the add-node skill workflow | No | Yes — `add-node` |
| `/add-tests` | `.claude/commands/add-tests.md` | Adds tests for a target file/feature | No | No |
| `/audit` | `.claude/commands/audit.md` | Read-only full codebase audit, produces AUDIT.md | No | Yes — `audit` |
| `/commit-push-pr` | `.claude/commands/commit-push-pr.md` | Commit, push, and open a PR in one flow | No | No |
| `/compact-now` | `.claude/commands/compact-now.md` | Manually trigger a context compaction | No | No |
| `/dead-code` | `.claude/commands/dead-code.md` | Finds and removes dead/unused code | No | No |
| `/feature-status` | `.claude/commands/feature-status.md` | Reads CLAUDE.md + src/types/index.ts to answer feature-status questions | No | No |
| `/fix-types` | `.claude/commands/fix-types.md` | Eliminates `as any`/`@ts-ignore`/implicit `any` one file at a time | No | Yes — `typescript-strict` |
| `/handoff` | `.claude/commands/handoff.md` | Session handoff — updates docs/progress.md | No | Yes — `session-handoff` |
| `/perf` | `.claude/commands/perf.md` | Performance review against CLAUDE.md Gotchas | Possibly — `perf-profiler` | No |
| `/plan` | `.claude/commands/plan.md` | Single-session scoping/plan | No | No |
| `/pre-push` | `.claude/commands/pre-push.md` | Pre-push verification gate | No | No |
| `/refactor` | `.claude/commands/refactor.md` | Refactor pass guided by CLAUDE.md + AUDIT.md | No | No |
| `/resume` | `.claude/commands/resume.md` | Resumes a previous session's state | No | No |
| `/security` | `.claude/commands/security.md` | Security-focused audit (secrets, auth, CORS, XSS) | Possibly — `security-auditor` | No |

*(Commands were not re-read per task instructions; "Calls Agent?"/"Calls Skill?" columns are inferred
from filename/first-line conventions already in context, not verified against full command body —
treat "Possibly" entries as needing confirmation if precision matters.)*

## 6. Rules Reference

### Project Rules (5)

| Rule Name | Scope | Loaded? | Purpose |
|---|---|---|---|
| `components.md` | project | yes (referenced from `CLAUDE.md` → "Essential Development Invariants") | Component conventions for AgentFlow Studio |
| `exporters.md` | project | yes | Code/blueprint export pipeline constraints |
| `general.md` | project | yes | General cross-cutting project conventions |
| `nodes.md` | project | yes | Node naming/registration constraints (read by `node-implementer` agent) |
| `stores.md` | project | yes | Zustand store invariants (read by `store-architect`/`perf-profiler` agents) |

### Global Rules (9)

| Rule Name | Scope | Loaded? | Purpose |
|---|---|---|---|
| `git.md` | global | yes — `@import .claude/rules/git.md` | Commit format, branch naming, semver, CHANGELOG rules |
| `workflow.md` | global | yes — `@import .claude/rules/workflow.md` | Capture → Plan → Build → Ship solo-dev loop, issue template |
| `self-review.md` | global | yes — `@import .claude/rules/self-review.md` | Pre-merge self-review checklist |
| `project-structure.md` | global | yes — `@import .claude/rules/project-structure.md` | Standard file layout and naming conventions |
| `ai-agents.md` | global | yes — `@import .claude/rules/ai-agents.md` | LangGraph/Ollama/FastAPI agent development standards |
| `context7.md` | global | yes — `@import .claude/rules/context7.md` | Mandates `ctx7` CLI for current library docs |
| `python.md` | global | yes — `@import .claude/rules/python.md` | Python-specific conventions |
| `react.md` | global | **ORPHANED** — not in `~/.claude/CLAUDE.md`'s `@import` list | React/frontend component, hooks, and state-management standards |
| `python-backend.md` | global | **ORPHANED** — uses path-scoped frontmatter (`paths:` globs), not `@import`; no mechanism in `~/.claude/CLAUDE.md` or settings.json applies it | Path-scoped Python backend rule |

*(Correction note: a prior audit pass flagged `ai-agents.md`, `context7.md`, and `python.md` as
orphaned. Re-reading `~/.claude/CLAUDE.md`'s "Standards Reference" section directly shows all three
are in fact `@import`ed — that prior flag was an error. The two genuinely orphaned files are
`react.md` and `python-backend.md`, corrected above.)*

## 7. MCP Servers

| Server | Command | Disabled by Default? | Approx Token Cost | When to Enable |
|---|---|---|---|---|
| `chrome-devtools` | `npx chrome-devtools-mcp@latest` | Yes — `"disabled": true` in `.mcp.json` | Unmeasured here; chrome-devtools toolsets are typically MED-HIGH (navigation, console, network, performance-trace, screenshot tools) | Enable when debugging in-browser behavior that the `webapp-testing`/Playwright skill can't reach — e.g. live console errors, network waterfall inspection, Lighthouse audits, or performance traces against the running dev server |

## 8. Settings.json Hook Bindings

Project `.claude/settings.json` (relative paths, resolved against the project root):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/session_start.py"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/secret_scanner.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/auto_format.py"
          },
          {
            "type": "command",
            "command": "python .claude/hooks/auto_test.py"
          },
          {
            "type": "command",
            "command": "python .claude/hooks/run_tsc.py"
          },
          {
            "type": "command",
            "command": "python .claude/hooks/run_eslint.py"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/run_tests_tail.py"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/pre_compact_snapshot.py"
          }
        ]
      }
    ],
    "PostCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/post_compact_inject.py"
          }
        ]
      }
    ]
  },
  "fallbackModel": ["claude-sonnet-4-5", "claude-haiku-4-5"]
}
```

Global `~/.claude/settings.json` (absolute paths, fire for every project):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "python C:/Users/IvanA/.claude/hooks/bash_guard.py", "timeout": 8 }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "python C:/Users/IvanA/.claude/hooks/post_write_format.py", "timeout": 15 }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          { "type": "command", "command": "python C:/Users/IvanA/.claude/hooks/inject_context.py", "timeout": 5 }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          { "type": "command", "command": "python C:/Users/IvanA/.claude/hooks/on_stop_reminder.py", "timeout": 5 }
        ]
      }
    ]
  }
}
```

> Ground truth means exactly that: these are the bindings Claude Code will attempt to execute. As
> noted in Section 2, four project-relative paths above (`inject_context.py`, `bash_guard.py`,
> `post_write_format.py`, `on_stop_reminder.py`) currently point at files that do not exist on disk.

## 9. CLAUDE.md Invariants

Every line in `CLAUDE.md` (repo root) containing NEVER, ALWAYS, MUST, DO NOT, or WARNING, quoted verbatim:

1. `npm run typecheck    # Run TypeScript compiler checks (MUST run before every commit)`
2. `sandboxExecutor`: `src/test-setup.ts` stubs `setTimeout` synchronously. Message listener + `srcdoc` must be set BEFORE arming the timeout. Do not reorder.
3. `simulationStore.ts` ~2641: the `codeExecutor` simulated-mode fake is guarded to Simulate engine only. Do not remove the guard.
4. `callLLMDirect` wraps `streamChat()` — do NOT add a parallel raw fetch path.
5. `REGISTERED_NODE_TYPES` is the single source of truth for NL Builder. Any new node type must be added there first.
6. **Verification**: `npm run typecheck && npm run build` must pass successfully before every commit.
7. CI gate: `.github/workflows/ci.yml` runs typecheck → build → test on every push to main and develop. Do not merge a PR with a failing CI run.
8. `feedback_solo_dev_main_only.md` — Enforces that the user works solo directly on `main`; never suggest or create feature branches.
9. `feedback_no_autonomous_git.md` — Prohibits running `git checkout -b`/`commit`/`push` autonomously, even when a plan or "Commit: ..." instruction implies it; always surface manual git commands instead.

## 10. Maintenance Recipes

### How to add a new project hook

- Write the script under `.claude/hooks/<name>.py`, following the existing fail-open pattern (wrap `main()` in try/except, always `sys.exit(0)` unless intentionally blocking)
- Pick the right event (`PreToolUse` to block before execution, `PostToolUse` to react after, `Stop`/`SessionStart`/`PreCompact`/`PostCompact` for lifecycle hooks) and add a matcher if it should only fire for specific tools
- Add the binding to `.claude/settings.json` under the matching event array, using the project-relative path `python .claude/hooks/<name>.py`
- If it should block the tool call, read stdin JSON, print `{"decision": "block", "reason": "..."}`, and `sys.exit(2)`; otherwise always exit 0
- Verify it fires by checking `.claude/hook-log.jsonl` after triggering the matching event, and confirm it does not duplicate an existing global hook of the same purpose (see Section 2's Double-Execution Warning)

### How to add a new agent

- Create `.claude/agents/<agent-name>.md` with YAML frontmatter: `name`, `description` (include trigger phrases and explicit "NOT for..." exclusions), `tools` (standard Claude Code tool names only — `Read, Edit, Write, Bash, Glob, Grep`, etc., not custom names like `read_file`), `model`
- Write the system prompt body: scope, what to check/do, output format, and explicit constraints (read-only vs. write-capable)
- If the agent should be read-only, state that explicitly in a Constraints section, and restrict declared `tools` accordingly (omit `Write`/`Edit`)
- Reference any `.claude/rules/*.md` files the agent must comply with directly in its "before any action" steps
- Test by invoking `Agent({ subagent_type: "<agent-name>" })` and confirm the output matches the declared format

### How to enable/disable the Chrome DevTools MCP mid-session

- To enable: edit `.mcp.json` at the repo root, set `"disabled": false` for the `chrome-devtools` server entry, then restart the Claude Code session (MCP servers are loaded at session start, not hot-reloaded)
- Alternatively, if already connecting but tools aren't loaded, call `ToolSearch` with a query like `"chrome-devtools"` — deferred MCP tools load lazily once the server connects
- To disable again: set `"disabled": true` in `.mcp.json` and restart the session
- Do not delete the `chrome-devtools` entry from `.mcp.json` just to disable it — toggling `disabled` preserves the config for next time

### How to add a new global rule and make it load (@import pattern)

- Create `~/.claude/rules/<name>.md` with the rule content (plain Markdown, no special frontmatter required for the `@import` mechanism)
- Open `~/.claude/CLAUDE.md` and add a line `@import .claude/rules/<name>.md` under the `## Standards Reference` section — the file is otherwise inert and will be **orphaned** (see Section 6) until this line is added
- Keep `~/.claude/CLAUDE.md` itself under ~100 lines per its own header comment — push detail into the imported rule file, not into the top-level file
- Verify it loaded by starting a fresh session and confirming the rule's content appears in the system prompt context (or ask a question that would only be answerable if the rule were loaded)
