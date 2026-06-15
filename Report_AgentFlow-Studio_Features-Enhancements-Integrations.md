# REPORT SECTION 1: "What AgentFlow Studio Already Has"

### Canvas & Graph Engine
- [x] Visual node canvas built on @xyflow/react v12 with custom node/edge renderers (`Canvas.tsx`, `FlowEdge.tsx`)
- [x] **30 node types** total — 28 executable + 2 annotation (`note`, `group`) — one file per type in `src/nodes/`
- [x] Node categories: core, flow, multiagent, annotation
- [x] 3 edge kinds: `direct`, `conditional`, `bidirectional` (with distinct markers via `edgeKinds.ts`)
- [x] Named source handles (router routes, guardrail pass/fail) auto-adopt handle name as edge label
- [x] Undo/redo with 50-step history; throttled snapshots so typing collapses into single undo steps; drag snapshots once per drag
- [x] Group frames: wrap ≥2 nodes, collapse/expand, child re-anchoring on group delete (`groupSelected`, `toggleGroupCollapse`)
- [x] Multi-select, duplicate (with edge cloning), delete, select-all, box-select
- [x] Live graph validation on every mutation (`validateGraph`) → errors/warnings in `ValidationBar`
- [x] O(1) node-type lookup map maintained for per-edge selectors
- [x] Dirty-state tracking + `beforeunload` warning on unsaved changes
- [x] Mini-map, pan/zoom, snap (xyflow defaults)
- [x] Save/Open canvas as versioned JSON document (`canvasSerializer.ts`, schema-versioned, round-trips groups + edge kinds)

### Simulation Engine
- [x] Dynamic next-step walker (not pre-built topological pass) — queue grows as nodes execute (`simulationStore.ts`, ~2143 lines)
- [x] Two run modes: **Simulated** (fake data) and **Live** (real provider calls for LLM/router/guardrail/evaluator/join/output/start/condition)
- [x] Playback controls: start, stop, play, pause, step, restart
- [x] Routing resolution shared by sim + live engines (condition / router / guardrail / evaluator)
- [x] Skip-marking of non-taken branches with `skipped` trace entries
- [x] Join barriers (wait for all incoming branches; bounded defer to avoid livelock)
- [x] Loop/cycle support bounded by `MAX_NODE_VISITS = 2`
- [x] Map (Send) fan-out: per-item virtual-node expansion between Map and downstream Join
- [x] Nested Subgraph execution via isolated sub-walker with input/output variable mapping
- [x] Human-in-the-loop approval gates (`pendingApproval`, approve/reject)
- [x] Streaming output with rAF-batched token buffering (`StreamingText.tsx`)
- [x] Trace log with per-node status/engine/duration/input/output, parent-node nesting (`TraceLog.tsx`)
- [x] State inspector for run state (`StateInspector.tsx`)
- [x] Metrics: step index/total, active node count, elapsed timer, token counter (`MetricsBar.tsx`, `simulationMetricsStore.ts`)
- [x] Token counting via `estimateTokens` heuristic
- [x] Abort controller cancels in-flight live fetch on stop/pause/restart; run-token guards stale writes

### Eval Suite
- [x] Test cases (input / expectedOutput / description) managed in `evalStore.ts`
- [x] Auto-runs on simulation finish if test cases exist
- [x] Scoring per case: `pass` / `partial` / `fail` / `pending` with numeric score (`evalScorer.ts`)
- [x] Aggregate quality score per run (`computeQualityScore`)
- [x] Run history retained (`runs[]`), surfaced in `EvalPanel.tsx`
- [x] Scores against terminal Output node trace or last assistant message

### Cost Analytics
- [x] Per-node cost attribution for costed types (llm/agent/router/guardrail/evaluator/supervisor/swarmWorker)
- [x] Static pricing table for **8 models** (`modelPricing.ts`) + default fallback
- [x] Per-node model resolution (override → node model → global) with 70/30 in/out token split
- [x] Run cost summary: entries, total tokens, total USD, resolved model
- [x] Flame-bar cost visualization + total in navbar badge (`CostPanel.tsx`)

### Export & Deploy
- [x] LangGraph **Python** export (`exportPython`) — sync or async mode, advanced architectures
- [x] `requirements.txt` generation deduped by import (`exportRequirements`)
- [x] **Mermaid** diagram export (`exportMermaid`)
- [x] Deploy bundle ZIP (`deployExporter.ts`): `main.py`, FastAPI `server.py` (`POST /invoke`), `Dockerfile`, `docker-compose.yml`, `README.md`, `requirements.txt`
- [x] Deploy docs target Docker / Railway / Render
- [x] Multi-provider model setup in export (Gemini, Ollama, Groq, OpenRouter, OpenAI-compat) via `exportModels.ts`
- [x] Export blocked while validation errors exist or Live mode is on
- [x] Copy-to-clipboard + per-file download in `ExportModal.tsx` (tabs: main.py / requirements.txt / diagram.mmd / deploy)

### Version History
- [x] Undo/redo stack (50 steps, in-memory) — `history` / `future`
- [x] Save/Open full canvas as JSON file (manual, schema-versioned)
- [ ] **No** dedicated snapshot timeline, named tags, visual diff, or restore-to-point feature (does not exist beyond undo/redo + manual JSON save)

### LLM Configuration
- [x] **7 providers**: Ollama, LM Studio, Gemini, Groq, OpenRouter, OpenAI, Custom URL (`llm/registry.ts`)
- [x] **3 transports**: ollama, gemini, openai-compat (declarative — new provider = one descriptor)
- [x] Per-provider settings (baseUrl / apiKey / model), edits isolated per provider
- [x] Local (Ollama/LM Studio) vs Cloud grouping in settings modal
- [x] Dynamic Ollama model discovery via `/api/tags`
- [x] Per-node model override field (`modelOverride`)
- [x] Connectivity ping before enabling Live for local servers
- [x] Settings modal (`LLMSettingsModal.tsx`); API keys in memory only (no persistence)

### UI/UX
- [x] Dark-only theme (bg #0d0e10, accent #00c4cc), Tailwind v4, Lucide icons
- [x] Navbar actions: New, Save, Open, Blueprints, Eval, Cost, Simulate, Live, Settings, Export Python, Shortcuts
- [x] Left palette sidebar + right node Inspector (resizable 240–480px, collapsible)
- [x] Modals: Blueprint Gallery, Export, LLM Settings, Shortcuts, Quick-Add, Welcome overlay, Confirm dialogs
- [x] Quick-Add popup (`QuickAddPopup.tsx`); selection toolbar (`SelectionToolbar.tsx`)
- [x] Keyboard shortcuts (`useKeyboardShortcuts.ts`, `ShortcutsModal.tsx`)
- [x] Contextual hint icons (`HintIcon.tsx`, `data/hints.ts`)
- [x] Responsive panel defaults (collapse <1024px)
- [x] Blueprint thumbnails (`BlueprintThumbnail.tsx`) + gallery (`BlueprintGallery.tsx`) — **25 blueprints**
- [x] `prefers-reduced-motion` respected in simulation animation

### Integrations
- [x] LLM providers: Ollama, LM Studio, Gemini, Groq, OpenRouter, OpenAI, Custom (live-callable)
- [x] MCP: `mcpServer` node type + `mcpClient.ts` (client utility) — **partial** (node config + client, not full tool-call loop)
- [x] A2A remote agent node (config-level: agentUrl, authToken)
- [x] Computer-Use node (config-level)
- [x] Retriever / knowledge-base node (config-level: knowledgeBase, topK, threshold) — **no native vector store / embeddings**
- [ ] No webhook/cron/Slack/GitHub/Notion/observability-platform integrations wired
- [ ] No persistence backend, auth, or multi-user infrastructure

---

# REPORT SECTION 2: "Competitor Feature Matrix"

| Feature | AgentFlow | Dify | Langflow | Flowise | n8n AI | Vellum | Rivet | Wordware |
|---|---|---|---|---|---|---|---|---|
| Visual node canvas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (doc-style) |
| Multi-model provider switching | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RAG / knowledge base nodes | 🟡 (stub) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Native vector store | ❌ | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ❌ | ✅ |
| MCP protocol support | 🟡 (partial) | ✅ | ✅ | ✅ | ✅ | 🟡 | ❌ | 🟡 |
| Streaming output (SSE) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Human-in-the-loop / approval | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | 🟡 | 🟡 |
| Sub-flows / nested execution | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Loop / iteration nodes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| API auto-deploy from flow | 🟡 (bundle) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Embedded chat widget / share link | ❌ | ✅ | 🟡 | ✅ | 🟡 | ✅ | ❌ | ✅ |
| Prompt versioning / registry | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ | ❌ | 🟡 |
| A/B testing / comparison mode | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ | ❌ | 🟡 |
| Built-in eval framework | ✅ | 🟡 | ❌ | ❌ | ❌ | ✅ | ❌ | 🟡 |
| Per-run cost analytics | ✅ | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ❌ | ✅ |
| Observability / drift detection | ❌ | 🟡 | 🟡 | 🟡 | 🟡 | ✅ | ❌ | 🟡 |
| Scheduled / cron triggers | ❌ | 🟡 | ❌ | ❌ | ✅ | ✅ | ❌ | 🟡 |
| Webhook triggers | ❌ | ✅ | 🟡 | ✅ | ✅ | ✅ | ❌ | ✅ |
| Git sync / version control | ❌ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ✅ (in-app) | ❌ |
| Multi-tenant / team workspaces | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| SSO / RBAC | ❌ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ❌ | 🟡 |
| Custom code nodes (Python/JS) | 🟡 (sim only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Template marketplace | 🟡 (25 built-in) | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ |
| LangSmith / Langfuse integration | ❌ | 🟡 | ✅ | ✅ | 🟡 | 🟡 | ❌ | 🟡 |
| One-click deploy bundle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |

### Gap Analysis — Top 10 Missing Features (ranked by user impact)
1. **Live API endpoint / hosted run** — competitors run flows behind a URL; AgentFlow only emits a downloadable bundle.
2. **Embedded chat widget / shareable link** — every chat-oriented competitor ships this; AgentFlow has none.
3. **Native vector store + real RAG** — retriever is a config stub with no embeddings/ingestion.
4. **Persistence / accounts / workspaces** — in-memory only; no save-to-cloud, no teams.
5. **Webhook & scheduled triggers** — no event/cron entry points; flows are manual-run only.
6. **Observability export (LangSmith/Langfuse/Helicone)** — no trace forwarding or production monitoring.
7. **Prompt registry / versioning** — prompts live inline on nodes; no central, versioned store.
8. **Real custom-code execution** — Code Executor node is simulated only.
9. **A/B / comparison mode** — no side-by-side model/prompt comparison.
10. **Git sync / RBAC / SSO** — no real version control or access control for teams.

---

# REPORT SECTION 3A: "Feature Ideas"

### Node Types
- **Document Loader Node** `M` — Ingest PDF/CSV/MD/URL into chunked text for retrieval. Closes the RAG gap (Dify/Flowise/Langflow all have loaders).
- **Embedding Node** `M` — Generate vectors from text via a provider. Prerequisite for any real retriever; currently absent.
- **Vector Upsert/Query Node** `M` — Write/read embeddings to a vector index. Powers genuine RAG vs. today's stub.
- **HTTP Request Node** `S` — Generic REST call with headers/body/auth. n8n's core primitive; unlocks arbitrary tool integration.
- **Webhook Trigger Node** `M` — Flow entry point fired by inbound HTTP. n8n/Dify/Flowise all support event-driven runs.
- **Schedule Trigger Node** `S` — Cron-style entry node. Enables unattended recurring agents (n8n, Vellum).
- **Reranker Node** `S` — Re-score retrieved chunks before LLM. Standard in advanced RAG (Vellum, Dify).
- **Email/Slack Send Node** `S` — Push results to a channel. Common "last mile" action users expect.
- **SQL Query Node** `M` — Run parameterized queries against a DB. n8n/Dify data-source parity.
- **Parser/Extractor Node** `S` — Regex/JSONPath/XPath extraction without an LLM. Cheap deterministic transforms.
- **Branch/Switch Node (multi-case)** `S` — N-way deterministic switch distinct from LLM router. Langflow/n8n have it.
- **Aggregator Node** `S` — Collect streamed/looped items into one array. Complements Map/Join.

### Flow Control
- **Try/Catch (Error Boundary) Node** `M` — Catch a node failure and route to a fallback path. No error handling exists today; all competitors do.
- **Retry-with-Backoff Wrapper** `S` — Auto-retry a failed node N times. Production resilience; n8n/Vellum standard.
- **Parallel Execution Group** `M` — Explicitly run independent branches concurrently (today only Map fans out). Addresses latency.
- **Timeout Guard** `S` — Abort a node after T seconds and route onward. Prevents hung runs.
- **Rate Limiter Node** `S` — Throttle provider calls. Avoids 429s in long fan-outs.
- **Conditional Loop with break condition** `M` — Richer loop than visit-count cap (real while/until). Enhances ReAct fidelity.

### Execution & Runtime
- **Live Hosted Run / API endpoint** `L` — Execute the flow server-side behind a URL, not just a downloadable bundle. Biggest competitive gap.
- **Embedded Chat Widget + Share Link** `L` — Publish a flow as a shareable chat UI. Dify/Wordware/Flowise core offering.
- **Real Code Execution Sandbox** `L` — Run Code Executor in a real sandbox (Pyodide/WASM or remote). Currently simulated only.
- **Streaming-to-client transport** `M` — SSE/WebSocket out of a hosted run for partial tokens. Extends current in-canvas streaming.
- **Batch Run Mode** `M` — Run a flow over a dataset of inputs in one pass. Powers evals + bulk processing.
- **Checkpoint/Resume Runtime** `M` — Persist run state and resume after HITL pause across sessions. LangGraph-native concept.

### Collaboration
- **Cloud Persistence + Accounts** `L` — Save flows/runs to a backend with user auth. Foundation for everything multi-user.
- **Real-time Multiplayer Canvas** `L` — Concurrent editing with presence cursors. Modern table-stakes (Figma-style).
- **Node Comments / Annotations Threads** `S` — Pin discussion to a node beyond the existing Note. Aids team review.
- **Git Sync (export/import to repo)** `M` — Commit flow JSON to a Git provider. n8n/Vellum/Rivet parity.
- **Workspace + RBAC** `L` — Teams, roles, shared template library. Enterprise requirement.

### Observability
- **Trace Export to Langfuse/LangSmith/Helicone** `M` — Forward run traces to an observability platform. Langflow/Flowise have this.
- **Run History Persistence + Search** `M` — Store past runs and query by status/cost/latency. Today traces are ephemeral.
- **Budget Alerts** `S` — Warn/halt when a run exceeds a USD threshold. Builds on existing cost analytics.
- **Latency/Drift Dashboard** `L` — Track p50/p95 latency and output drift over time. Vellum's differentiator.
- **Structured Logging Sink** `S` — Emit JSON logs to a configurable endpoint. Production monitoring.

### AI-Native
- **Prompt Registry** `M` — Central versioned prompt library referenced by nodes. Vellum's core feature; eliminates inline drift.
- **A/B Comparison Mode** `M` — Run two model/prompt variants side-by-side on the same input. Vellum/Dify have it.
- **Semantic Memory Backend** `L` — Real persistent store for longTermStore/memoryWriter nodes (currently simulated). Closes the memory gap.
- **Auto-Eval Dataset Generation** `M` — LLM-generate eval cases from a flow's purpose. Accelerates the existing Eval suite.
- **Prompt Optimizer** `M` — Suggest prompt improvements from eval failures. AI-native differentiator.
- **Tool Auto-Discovery from MCP** `M` — Populate available tools by introspecting a connected MCP server. Completes partial MCP support.

---

# REPORT SECTION 3B: "Integration Ideas"

### LLM Providers (not in pricing table / registry)
- **Anthropic (direct API)** — [LLM Provider] First-class Claude access (Opus/Sonnet/Haiku) with accurate native pricing instead of OpenRouter passthrough.
- **AWS Bedrock** — [LLM Provider] Enterprise-gated access to Claude/Llama/Titan via IAM.
- **Azure OpenAI** — [LLM Provider] Compliance-sensitive enterprises that require Azure-hosted models.
- **Mistral (direct)** — [LLM Provider] Native Mistral/Codestral access with EU data residency.
- **Together AI / Fireworks** — [LLM Provider] Cheap fast open-model inference for high-volume flows.

### Vector Databases (for RAG nodes)
- **Pinecone** — [Vector DB] Managed serverless vector store; the default users expect for production RAG.
- **Qdrant** — [Vector DB] Self-hostable, popular OSS index for local-first users.
- **Weaviate** — [Vector DB] Hybrid (keyword+vector) search out of the box.
- **pgvector (Postgres)** — [Vector DB] RAG inside an existing Postgres; no new infra.
- **Chroma** — [Vector DB] Lightweight local store matching AgentFlow's local-first ethos.

### Tools & APIs
- **Slack** — [Tool] Post run results / receive trigger messages in channels.
- **GitHub** — [Tool] Read issues/PRs, open issues, trigger on events for dev-agent flows.
- **Notion** — [Tool] Read/write pages as a knowledge source and output sink.
- **Google Drive / Sheets** — [Data Source] Pull docs for RAG, write tabular results.
- **Tavily / SerpAPI** — [Tool] Real web search for research-agent blueprints (currently faked).
- **Jira / Linear** — [Tool] Ticketing actions for ops/eng automation.

### Observability Platforms
- **Langfuse** — [Observability] Self-hostable trace/cost/eval dashboards; OSS-friendly.
- **LangSmith** — [Observability] LangGraph-native tracing — natural fit for the Python export.
- **Helicone** — [Observability] Proxy-based logging/caching with one base-URL swap.
- **Arize Phoenix** — [Observability] Open-source drift/quality monitoring.

### Data Sources
- **Postgres / MySQL** — [Data Source] Query relational data inside flows.
- **S3 / GCS** — [Data Source] Bulk document ingestion for RAG.
- **REST/GraphQL endpoints** — [Data Source] Generic API pull via the proposed HTTP node.
- **Inbound Webhooks** — [Data Source] Event-driven flow triggers.

### Auth & Security
- **OAuth providers (Google/GitHub)** — [Auth] User sign-in for cloud persistence.
- **SAML / OIDC SSO** — [Auth] Enterprise identity for workspaces.
- **Secrets Manager (Vault / Doppler / AWS SM)** — [Security] Store provider keys outside the browser instead of in-memory.
- **Per-key scoping / encryption-at-rest** — [Security] Safe key handling once persistence exists.

---

# REPORT SECTION 3C: "Enhancement Ideas"

### Canvas UX
- **Auto-layout / tidy** `M` → canvas — Manual placement gets messy on large graphs; add a Dagre-style one-click arrange.
- **Edge re-routing / orthogonal edges** `S` → canvas/FlowEdge — Edges overlap nodes; offer smart/step routing.
- **Search / jump-to-node palette** `S` → canvas — No way to find a node in a big flow; add Cmd-K node search.
- **Copy/paste across canvases** `M` → canvasStore — Duplicate works in-canvas only; support clipboard JSON paste between flows.

### Node Inspector
- **Inline field validation + help text** `S` → Inspector — Bad JSON in mapping fields fails silently at runtime; validate live with the existing hint system.
- **Schema-aware form for JSON fields** `M` → Inspector — `inputMapping`/`jsonSchema` are raw text; render a guided key/value editor.
- **Variable autocomplete** `M` → Inspector — Users guess upstream variable names; autocomplete from upstream node outputs.

### Simulation Engine
- **Replay a past trace** `M` → simulationStore — Traces are ephemeral; let users re-open and step through a finished run.
- **Configurable visit cap / true loop control** `S` → simulationStore — `MAX_NODE_VISITS=2` is hard-coded; expose per-loop iteration limits.
- **Real tool execution in Live mode** `L` → simulationStore — Tools/retriever/MCP are stubbed even in Live; wire actual calls.
- **Per-node latency injection for realism** `S` → fakeData — Fixed step durations; let users model real provider latency.

### Eval Suite
- **Dataset import (CSV/JSON)** `S` → evalStore — Test cases entered one-by-one; bulk import a dataset.
- **LLM-as-judge scoring mode** `M` → evalScorer — Scoring is string-similarity; add a rubric-based judge (the Evaluator node logic already exists).
- **Regression tracking across runs** `M` → EvalPanel — Runs are listed but not compared; chart quality-score trend and flag regressions.

### Cost Analytics
- **Historical cost trends** `M` → CostPanel — Cost resets each run; persist and chart cost/tokens over time.
- **Budget cap with halt** `S` → simulationStore — No spend guardrail; stop a run when projected cost exceeds a limit.
- **Provider price comparison** `S` → modelPricing/CostPanel — Single resolved model shown; show "this flow on model X vs Y" cost delta.
- **Live pricing refresh** `S` → modelPricing — Prices are hard-coded and will drift; load from a maintained table/remote.

### Version History
- **Named snapshots + restore** `M` → new store — Only undo/redo + manual JSON save exist; add named checkpoints with restore.
- **Visual diff between versions** `L` → new util — No way to see what changed; render node/edge add/remove/modify diff.
- **Auto-save / draft recovery** `M` → new store — In-memory only risks loss (CLAUDE.md bars localStorage); add opt-in cloud autosave once persistence lands.

### Export & Deploy
- **Environment-variables UI** `S` → ExportModal/deployExporter — Bundle assumes env vars are set manually; add a key/value editor that writes `.env.example`.
- **TypeScript / LangGraph.js export target** `L` → codeExporter — Python only; add a JS export for Node-deploy users.
- **CI/CD scaffold (GitHub Actions)** `S` → deployExporter — Bundle has Docker but no pipeline; emit a deploy workflow file.
- **One-click cloud deploy** `L` → new integration — Bundle is download-only; add direct Railway/Render/Fly deploy via API.

---

# REPORT SECTION 4: "Recommended Next 5 Features to Build"

**1. Native RAG Stack — Document Loader + Embedding + Vector Query nodes** `L`
- **Why now:** RAG is the #1 use case across every competitor and AgentFlow's retriever is a non-functional stub — the single biggest credibility gap.
- **What it unlocks:** Genuinely working RAG blueprints, real knowledge-base agents, and a reason to choose AgentFlow over a toy.
- **Depends on:** New node types in `src/nodes/` + registry/defaults/validation; a vector-DB integration (start with Chroma/pgvector for local-first); embedding provider call (reuse `llm/` transport layer).
- **Risk:** Browser-only architecture makes ingestion/embedding awkward — likely needs the hosted-runtime work or a local server shim.

**2. Live Hosted Run + Embedded Chat Widget / Share Link** `L`
- **Why now:** Competitors all let you run a flow behind a URL; AgentFlow stops at a downloadable bundle, so nothing is actually usable post-design.
- **What it unlocks:** Shareable demos, real end-user chat, and the foundation for webhooks/scheduling/observability.
- **Depends on:** A backend/persistence layer (currently none); the existing `exportPython` + FastAPI bundle is a strong starting point to host.
- **Risk:** Introduces server infrastructure the project has deliberately avoided — large architectural shift and security surface (key handling).

**3. Error Handling: Try/Catch + Retry-with-Backoff** `M`
- **Why now:** Every production flow needs failure paths; AgentFlow has zero error handling while n8n/Vellum treat it as core.
- **What it unlocks:** Resilient flows, fallback model routing, and trustworthy Live runs.
- **Depends on:** New flow-control node(s) + walker support in `simulationStore.ts` (the routing/skip machinery already exists to build on); export support in `codeExporter.ts`.
- **Risk:** The dynamic walker's skip/join/visit invariants are intricate — adding catch paths risks livelock or orphaned joins.

**4. Prompt Registry + A/B Comparison Mode** `M`
- **Why now:** Prompts live inline and drift; Vellum's prompt registry + comparison is its headline differentiator and AgentFlow already has the eval scaffolding to support it.
- **What it unlocks:** Versioned prompts referenced across nodes, plus side-by-side variant runs that feed the existing Eval suite.
- **Depends on:** New `promptStore`; node fields to reference a registry entry; comparison run mode in `simulationStore` (batch run helps here).
- **Risk:** Comparison runs double execution cost/latency and need careful trace separation in the metrics/cost stores.

**5. Observability Export to Langfuse/LangSmith** `M`
- **Why now:** Once flows run live, users need production monitoring; this is cheap relative to its enterprise appeal and the trace model already exists.
- **What it unlocks:** Production drift/cost/latency dashboards without leaving AgentFlow; enterprise credibility.
- **Depends on:** A trace-forwarding util mapping existing `TraceEntry`/`RunCostSummary` to the platform schema; an integration config surface for API keys.
- **Risk:** Trace schema mapping must stay accurate as the walker evolves, and key handling reintroduces the secrets-storage problem.