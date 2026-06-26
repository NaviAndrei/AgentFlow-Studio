---
name: audit
description: Use when auditing the AgentFlow Studio codebase for invariant violations — drag-handler setState, cross-store access, non-abortable delays, shallow trace clones, TypeScript any, missing node registration, or quick-win cleanups. Produces severity-grouped findings.
---

# Codebase Audit

> Invoke to run a structured codebase audit of AgentFlow Studio.

## Audit Checklist

### Critical (fix immediately)
- [ ] Any `setState` calls in drag event handlers (pointerdown→pointerup path)
- [ ] Any direct reads/writes to `canvasStore` from components other than canvas
- [ ] Any `await delay()` (not `abortableDelay`) in simulation retry paths
- [ ] Any `spread` operator used instead of `structuredClone` when archiving trace data
- [ ] TypeScript `any` usage

### High Priority
- [ ] Components with local `useState` for panel open/close (should be in uiStore)
- [ ] Missing `touch-action: none` on draggable elements
- [ ] Missing `setPointerCapture` before `pointermove` handlers
- [ ] Node types without full registration (check ARCHITECTURE.md checklist)

### Quick Wins
- [ ] Unused imports
- [ ] Console.log statements left in production code
- [ ] Missing error boundaries on panels
- [ ] Missing `aria-label` on icon-only buttons

## Output format
Group findings by severity. For each finding:
- File + line number
- What's wrong
- Suggested fix (one sentence)
