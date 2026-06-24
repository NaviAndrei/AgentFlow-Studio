# AgentFlow Studio — Layout Fix Log

> Append new entries at the top. Never edit past entries.
> This is the authoritative record of layout geometry changes and their verified measurements.

---

## 2026-06-15 — PanelRail Drag System Overhaul

**Problem:** Rail collapsed to narrow state during active drag. After drag, rail stayed expanded permanently due to `group-focus-within` retaining focus on the drag handle.

**Root cause (collapse):** `isDragging` was `useState` — each `pointermove` triggered a React re-render, causing Tailwind to re-evaluate `group-hover`, which evaluated as false during pointer capture (hover left the element), collapsing the rail mid-drag.

**Root cause (stuck open):** Drag handle button retained browser focus after `pointerup`, keeping `group-focus-within` active indefinitely.

**Fix:**
- `isDragging` useState → `isDraggingRef` useRef (zero re-renders during drag)
- Added `touch-action: none` on drag trigger
- Added `will-change: transform` on rail container
- Imperative `style.transform` mutation per `pointermove` frame
- Single `setRailOffsetPx` commit on `pointerup`
- `trigger.blur()` called after 200ms post-drag to release `group-focus-within`

**Verified:** Rail expands/collapses normally before drag. During drag: stable, no collapse. After drag: collapses correctly after 100ms.

**Files:** `src/components/PanelRail.tsx`, `src/store/uiStore.ts`

**Gate:** typecheck ✅ | build ✅ | tests ✅ 158/158

**What was NOT changed and why:** `group` class on PanelRail container — permanent, expansion CSS depends on it. PanelRail z-index — not needed, drag system fix was sufficient.

---

## 2026-06-15 — TraceLog Dock Fix

**Problem:** TraceLog open panel's top edge overlapped PanelRail by ~25px, obscuring "Clear" button and down-arrow controls.

**Root cause:** `bottom-12` (48px gap) placed TraceLog top edge at y≈512 on 800px viewport. PanelRail bottom edge is at y=537. Overlap = ~25px.

**Fix:**
- `bottom-12` → `bottom-0` (dock flush to viewport bottom)
- `translate-y-[calc(100%+3rem)]` → `translate-y-full` (closed state — the +3rem compensated for the removed gap)

**Geometry verified (getBoundingClientRect @ 1280×800):**
- PanelRail: y=263–537 (272px tall, centered via `top-1/2 -translate-y-1/2`)
- TraceLog top edge after fix: y=560
- Clearance: 23px ✅ overlap: false ✅

**Files:** `src/components/TraceLog.tsx` only. PanelRail.tsx unchanged.

**Gate:** typecheck ✅ | build ✅ | tests ✅ 158/158

**What was NOT changed and why:** PanelRail z-index — geometry fix was sufficient. Z-index swap would either bury rail under full-width panel or leave original bug. Bottom-12 is gone — do not reintroduce.
- `C:\Users\IvanA\Claude_Code\AgentFLow-Studio\CLAUDE.md` edited at 2026-06-24 18:24 UTC
