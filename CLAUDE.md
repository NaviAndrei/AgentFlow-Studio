# AgentFlow Studio
React 19 + Vite 6 + TS strict + @xyflow/react v12 + Zustand + Tailwind v4 + Lucide
Dark only. bg:#0d0e10 accent:#00c4cc

src/components/ canvas UI
src/nodes/      one file per node type
src/blueprints/ JSON blueprints
src/store/      Zustand (canvas, blueprint)
src/types/      TS interfaces
src/utils/      helpers
src/store/      Zustand (canvas, blueprint, simulation, llmConfig)

Rules:
- No localStorage/sessionStorage
- No any types
- No React state for canvas data
- One node type per file in src/nodes/

Colors:
Core: Start#16a34a LLM#7c3aed Agent#4f46e5 Tool#ea580c Memory#0891b2 Output#dc2626
Flow: Condition#ca8a04 Router#65a30d Guardrail#be123c Loop#475569 Human-in-Loop#db2777
Multi: Supervisor#b45309 Swarm Worker#0d9488

npm run dev | npm run build | npm run typecheck

Be concise. No summaries or narration. Code and errors only.
https://reactflow.dev/docs
https://docs.pmnd.rs/zustand