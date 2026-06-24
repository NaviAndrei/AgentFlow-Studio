# AgentFlow Studio

![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)
![Tests](https://img.shields.io/badge/tests-319%2F319%20passing-brightgreen)

## What it does

AgentFlow Studio is a visual, node-based editor for building and running LangGraph-style agent flows in the browser. It's built with React 19, Vite 6, and TypeScript in strict mode, with `@xyflow/react` for the canvas and Zustand for state management. The Vitest suite currently has 319/319 tests passing across 32 test files.

## Prerequisites

- Node.js 20+
- npm

## Quickstart

```bash
git clone <repo-url>
cd AgentFLow-Studio
npm install
npm run dev
```

The dev server starts on the default Vite port (usually `http://localhost:5173`).

## Key npm scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Start the local dev server |
| `npm run build` | `tsc --noEmit && vite build` | Type-check then build the production bundle |
| `npm run typecheck` | `tsc --noEmit` | Run TypeScript compiler checks only |
| `npm run test` | `vitest run` | Run the Vitest suite |
| `npm run preview` | `vite preview` | Preview the production build locally |

## Project structure

```
src/
  store/        Zustand stores (canvas, blueprint, simulation, llmConfig, ui, prompt, eval, runHistory)
  components/   UI components (panels, inspector, command palette, etc.)
  nodes/        Node type definitions and registration
  llm/          LLM provider integrations
  blueprints/   Blueprint load/save logic
  types/        Shared TypeScript types
  utils/        Shared utilities
  test/         Test helpers
docs/           Architecture notes, decisions, task backlog, session handoffs
```

## Known gaps

See [docs/progress.md](docs/progress.md) for the current session handoff. Notable open items:

- Cycle detection for flow graphs is incomplete in places.
- `SnapshotModal` confirmation flow needs work.
- `evalStore` lacks dedicated test coverage.

## Contributing

Before committing, the project's [CLAUDE.md](CLAUDE.md) invariants apply:

- No `any` types.
- No `// @ts-ignore` (or `@ts-expect-error` used to suppress real errors).
- `npm run typecheck && npm run build` must pass before every commit.

Scoped rules for components, stores, nodes, and code generation live in `.claude/rules/` — check those before editing files in their respective paths.
