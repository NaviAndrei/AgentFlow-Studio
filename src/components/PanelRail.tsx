import { useRef } from 'react'
import {
  BookOpen,
  CircleDollarSign,
  FlaskConical,
  History,
  LayoutTemplate,
  PanelRight,
  ScrollText,
} from 'lucide-react'
import { useEvalStore } from '../store/evalStore'
import { usePromptStore } from '../store/promptStore'
import { useRunHistoryStore } from '../store/runHistoryStore'
import { useSimulationMetricsStore } from '../store/simulationMetricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { useUIStore } from '../store/uiStore'

/** Navbar height (h-12 = 3rem) — the rail must not be dragged above it. */
const NAVBAR_H = 48
/** TraceLog height when open (h-60 = 15rem) — the rail must not be dragged below it. */
const TRACE_H = 240
/** Minimum pointer travel (px) before a pointerdown on the trigger counts as a drag. */
const DRAG_THRESHOLD = 4
/** Keyboard reposition step (px) via ArrowUp/ArrowDown on the focused trigger. */
const KEYBOARD_STEP = 20

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001'
  if (usd < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

interface RailButton {
  key: string
  label: string
  icon: typeof LayoutTemplate
  active: boolean
  badge: string | number | null
  onClick: () => void
}

/**
 * Right-edge icon rail for secondary panel toggles, following the pattern
 * used by n8n/Figma/LangFlow-style canvas tools (icon rail + tooltip,
 * panels slide in from the same edge). Frees the top Navbar for primary
 * controls (run/stop/live, file ops, export) and the new Problems chip.
 *
 * "Deploy" is intentionally omitted: there is no standalone deploy panel/
 * store flag — the deploy bundle lives inside ExportModal's "deploy" tab,
 * which stays reachable via the Navbar's "Export Python" button.
 */
export function PanelRail() {
  const railRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(
    null,
  )
  const isDraggingRef = useRef(false)
  const collapseTimeoutRef = useRef<number | null>(null)

  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const inspectorWidth = useUIStore((s) => s.inspectorWidth)
  const setGalleryOpen = useUIStore((s) => s.setGalleryOpen)
  const galleryOpen = useUIStore((s) => s.galleryOpen)
  const setCostPanelOpen = useUIStore((s) => s.setCostPanelOpen)
  const costPanelOpen = useUIStore((s) => s.costPanelOpen)
  const closeAllModals = useUIStore((s) => s.closeAllModals)

  const setRegistryOpen = usePromptStore((s) => s.setRegistryOpen)
  const registryOpen = usePromptStore((s) => s.registryOpen)
  const promptEntryCount = usePromptStore((s) => s.entries.length)

  const setRunHistoryOpen = useRunHistoryStore((s) => s.setPanelOpen)
  const runHistoryOpen = useRunHistoryStore((s) => s.panelOpen)
  const runCount = useRunHistoryStore((s) => s.runs.length)

  const setEvalOpen = useEvalStore((s) => s.setEvalOpen)
  const evalOpen = useEvalStore((s) => s.evalOpen)

  const traceOpen = useSimulationStore((s) => s.traceOpen)
  const setTraceOpen = useSimulationStore((s) => s.setTraceOpen)

  const costSummary = useSimulationMetricsStore((s) => s.costSummary)
  const problemsPanelOpen = useUIStore((s) => s.problemsPanelOpen)
  const railOffsetPx = useUIStore((s) => s.railOffsetPx)
  const setRailOffsetPx = useUIStore((s) => s.setRailOffsetPx)

  // Slide-in panels (w-96) and the rail share the right edge — shift the
  // rail left so it never overlaps an open panel's content.
  const anyPanelOpen =
    galleryOpen ||
    registryOpen ||
    runHistoryOpen ||
    evalOpen ||
    costPanelOpen ||
    problemsPanelOpen

  // Hug the rail against the Inspector's left edge so it never overlaps the
  // Inspector (or State Inspector) content. Slide-in panels take priority
  // since they overlay the Inspector at the viewport's right edge.
  const railRight = anyPanelOpen
    ? '24rem'
    : inspectorOpen
      ? `${inspectorWidth}px`
      : '2.25rem'

  // Toggle a panel open/closed, ensuring only one panel is open at a time.
  const togglePanel = (isOpen: boolean, setOpen: (open: boolean) => void) => {
    closeAllModals()
    setTraceOpen(false)
    if (!isOpen) setOpen(true)
  }

  const buttons: RailButton[] = [
    {
      key: 'blueprints',
      label: 'Blueprints',
      icon: LayoutTemplate,
      active: galleryOpen,
      badge: null,
      onClick: () => togglePanel(galleryOpen, setGalleryOpen),
    },
    {
      key: 'prompts',
      label: 'Prompts',
      icon: BookOpen,
      active: registryOpen,
      badge: promptEntryCount > 0 ? promptEntryCount : null,
      onClick: () => togglePanel(registryOpen, setRegistryOpen),
    },
    {
      key: 'history',
      label: 'History',
      icon: History,
      active: runHistoryOpen,
      badge: runCount > 0 ? runCount : null,
      onClick: () => togglePanel(runHistoryOpen, setRunHistoryOpen),
    },
    {
      key: 'eval',
      label: 'Eval',
      icon: FlaskConical,
      active: evalOpen,
      badge: null,
      onClick: () => togglePanel(evalOpen, setEvalOpen),
    },
    {
      key: 'cost',
      label: 'Cost',
      icon: CircleDollarSign,
      active: costPanelOpen,
      badge: costSummary ? formatCost(costSummary.totalCostUsd) : null,
      onClick: () => togglePanel(costPanelOpen, setCostPanelOpen),
    },
    {
      key: 'trace',
      label: 'Trace',
      icon: ScrollText,
      active: traceOpen,
      badge: null,
      onClick: () => {
        const wasOpen = traceOpen
        closeAllModals()
        setTraceOpen(!wasOpen)
      },
    },
  ]

  const anyActive =
    galleryOpen ||
    registryOpen ||
    runHistoryOpen ||
    evalOpen ||
    costPanelOpen ||
    traceOpen

  // Clamp a vertical drag offset so the rail (centered via top-1/2) never
  // overlaps the Navbar above or the TraceLog (when open) below.
  const clampOffset = (offset: number) => {
    const height = railRef.current?.getBoundingClientRect().height ?? 42
    const viewportH = window.innerHeight
    const centerY = viewportH / 2
    const traceH = traceOpen ? TRACE_H : 0
    const min = NAVBAR_H - centerY + height / 2
    const max = viewportH - traceH - centerY - height / 2
    return Math.min(max, Math.max(min, offset))
  }

  // Clear the imperative force-expand override, returning to the
  // default hover/focus-driven grid-rows animation.
  const releaseForcedExpand = () => {
    const grid = gridRef.current
    if (!grid) return
    grid.style.gridTemplateRows = ''
    grid.style.transitionDuration = ''
    grid.style.transitionDelay = ''
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startOffset: railOffsetPx, moved: false }
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
    // Force-expand immediately, bypassing :hover and the expand delay, so
    // the rail stays open for the full duration of the drag gesture.
    if (gridRef.current) {
      gridRef.current.style.transitionDuration = '0s'
      gridRef.current.style.transitionDelay = '0s'
      gridRef.current.style.gridTemplateRows = '1fr'
    }
    isDraggingRef.current = true
    e.currentTarget.style.cursor = 'grabbing'
    document.body.style.cursor = 'grabbing'
    if (railRef.current) railRef.current.style.opacity = '0.8'
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const delta = e.clientY - drag.startY
    if (!drag.moved && Math.abs(delta) < DRAG_THRESHOLD) return
    drag.moved = true
    const next = clampOffset(drag.startOffset + delta)
    if (railRef.current) {
      railRef.current.style.transform = `translateY(calc(-50% + ${next}px))`
    }
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    e.currentTarget.style.cursor = ''
    document.body.style.cursor = ''
    if (railRef.current) railRef.current.style.opacity = ''
    if (drag.moved) {
      setRailOffsetPx(clampOffset(drag.startOffset + (e.clientY - drag.startY)))
      // Let the user see where the rail landed before it collapses back
      // to its normal hover-driven state.
      const trigger = e.currentTarget
      collapseTimeoutRef.current = window.setTimeout(() => {
        releaseForcedExpand()
        // Drop focus so group-focus-within doesn't hold the rail open
        // once the pointer has left it.
        trigger.blur()
        collapseTimeoutRef.current = null
      }, 200)
    } else {
      releaseForcedExpand()
    }
    dragRef.current = null
    isDraggingRef.current = false
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setRailOffsetPx(clampOffset(railOffsetPx - KEYBOARD_STEP))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setRailOffsetPx(clampOffset(railOffsetPx + KEYBOARD_STEP))
    }
  }

  return (
    <div
      ref={railRef}
      style={{ right: railRight, transform: `translateY(calc(-50% + ${railOffsetPx}px))` }}
      className="group fixed top-1/2 z-30 flex w-11 flex-col overflow-hidden rounded-l-lg border-l border-y border-white/[0.08] bg-white/5 shadow-lg backdrop-blur-sm"
    >
      <div
        title="Panel controls — drag to reposition, arrow keys to nudge"
        role="slider"
        aria-label="Drag to reposition panel rail"
        aria-orientation="vertical"
        aria-valuenow={railOffsetPx}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        className="relative flex h-10 w-full shrink-0 cursor-grab touch-none select-none items-center justify-center text-gray-400"
      >
        <PanelRight size={18} />
        {anyActive && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent"
          />
        )}
      </div>
      <div
        ref={gridRef}
        className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-100 ease-in group-hover:duration-300 group-hover:delay-200 group-hover:ease-out group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] motion-reduce:transition-none motion-reduce:delay-0"
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 border-t border-white/[0.08] py-1.5 pl-1">
            {buttons.map((btn) => {
              const Icon = btn.icon
              return (
                <button
                  key={btn.key}
                  onClick={btn.onClick}
                  title={btn.label}
                  aria-label={btn.label}
                  className={`relative flex h-10 w-full shrink-0 items-center rounded-l-lg border-l-2 transition-colors ${
                    btn.active
                      ? 'border-accent bg-white/10 text-white'
                      : 'border-transparent text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-10 w-9 shrink-0 items-center justify-center">
                    <Icon size={20} className="shrink-0" />
                  </span>
                  {btn.badge !== null && (
                    <span className="absolute -left-1 -top-1 rounded bg-accent px-1 text-[9px] font-semibold text-black">
                      {btn.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
