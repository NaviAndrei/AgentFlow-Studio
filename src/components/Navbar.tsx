import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  Code2,
  Download,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  LayoutGrid,
  Map,
  Play,
  Settings,
  Share2,
  Square,
  Waves,
  Workflow,
  Zap,
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store/canvasStore'
import { useUIStore } from '../store/uiStore'
import { useLLMConfigStore } from '../store/llmConfigStore'
import { useSimulationStore } from '../store/simulationStore'
import { useToastStore } from '../store/toastStore'
import {
  deserializeCanvas,
  downloadCanvas,
  readCanvasFile,
} from '../utils/canvasSerializer'
import { encodeFlow } from '../utils/shareUrl'
import { estimatePreRunCost } from '../utils/estimateCost'
import {
  downloadCanvasScreenshot,
  downloadFullGraphScreenshot,
} from '../utils/screenshotCanvas'
import { PROVIDERS, listOllamaModels } from '../llm'
import { ConfirmDialog } from './Modal'
import { HintIcon } from './HintIcon'
import { HINTS } from '../data/hints'

export function Navbar() {
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const markClean = useCanvasStore((s) => s.markClean)
  const applyAutoLayout = useCanvasStore((s) => s.applyAutoLayout)
  const { getViewport } = useReactFlow()
  const nodes = useCanvasStore((s) => s.nodes)
  const hasNodes = nodes.length > 0
  const hasErrors = useCanvasStore((s) =>
    s.validationIssues.some((i) => i.level === 'error'),
  )
  const minimapVisible = useUIStore((s) => s.minimapVisible)
  const toggleMinimap = useUIStore((s) => s.toggleMinimap)
  const animatedEdgesEnabled = useUIStore((s) => s.animatedEdgesEnabled)
  const toggleAnimatedEdges = useUIStore((s) => s.toggleAnimatedEdges)
  const activeProvider = useLLMConfigStore((s) => s.activeProvider)
  const globalModel = useLLMConfigStore((s) => s.settings[s.activeProvider]?.model ?? '')
  const costEstimate = useMemo(
    () => estimatePreRunCost(nodes, globalModel),
    [nodes, globalModel, activeProvider],
  )
  const setExportOpen = useUIStore((s) => s.setExportOpen)
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)
  const setSnapshotOpen = useUIStore((s) => s.setSnapshotOpen)
  const simulationActive = useSimulationStore((s) => s.isActive)
  const startSimulation = useSimulationStore((s) => s.start)
  const stopSimulation = useSimulationStore((s) => s.stop)
  const liveMode = useSimulationStore((s) => s.liveMode)
  const setLiveMode = useSimulationStore((s) => s.setLiveMode)
  const liveError = useLLMConfigStore((s) => s.liveError)
  const setLiveError = useLLMConfigStore((s) => s.setLiveError)
  const setSettingsOpen = useLLMConfigStore((s) => s.setSettingsOpen)

  useEffect(() => {
    if (!liveError) return
    const timeout = window.setTimeout(() => setLiveError(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [liveError, setLiveError])

  const toggleLive = () => {
    if (liveMode) {
      setLiveMode(false)
      return
    }
    const { activeProvider, settings } = useLLMConfigStore.getState()
    const descriptor = PROVIDERS[activeProvider]
    const active = settings[activeProvider]
    if (descriptor.apiKey === 'required' && active.apiKey.trim() === '') {
      setLiveError(`Set a ${descriptor.label} API key in settings`)
      return
    }
    if (active.baseUrl.trim() === '') {
      setLiveError(`Set a ${descriptor.label} base URL in settings`)
      return
    }
    if (descriptor.transport !== 'ollama') {
      setLiveMode(true)
      return
    }
    // Local servers are pinged before enabling Live so a dead endpoint
    // surfaces immediately rather than mid-run.
    void listOllamaModels(active.baseUrl, descriptor.label)
      .then(() => setLiveMode(true))
      .catch((error: unknown) =>
        setLiveError(
          error instanceof Error
            ? error.message
            : `${descriptor.label} not reachable`,
        ),
      )
  }

  const [confirmNewOpen, setConfirmNewOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [screenshotMenuOpen, setScreenshotMenuOpen] = useState(false)

  const handleShare = async () => {
    const { nodes, edges } = useCanvasStore.getState()
    const url = await encodeFlow(nodes, edges)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this URL:', url)
      return
    }
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 2000)
  }

  const handleNew = () => {
    if (!hasNodes) {
      clearCanvas()
      return
    }
    setConfirmNewOpen(true)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    const { nodes, edges } = useCanvasStore.getState()
    downloadCanvas(nodes, edges, getViewport())
    // Mark the canvas clean once the download has been triggered.
    markClean()
  }

  const toastError = (error: unknown, fallback: string) => {
    useToastStore
      .getState()
      .pushToast(error instanceof Error ? error.message : fallback, 'warning')
  }

  const handleScreenshotViewport = () => {
    setScreenshotMenuOpen(false)
    void downloadCanvasScreenshot().catch((error: unknown) =>
      toastError(error, 'Could not capture the canvas'),
    )
  }

  const handleScreenshotFull = () => {
    setScreenshotMenuOpen(false)
    void downloadFullGraphScreenshot(useCanvasStore.getState().nodes).catch(
      (error: unknown) => toastError(error, 'Could not capture the canvas'),
    )
  }

  const handleOpenFile = (file: File) => {
    void readCanvasFile(file)
      .then((doc) => {
        const { nodes, edges, viewport } = deserializeCanvas(doc)
        useCanvasStore.getState().loadGraph(nodes, edges, viewport)
      })
      .catch((error: unknown) => {
        window.alert(
          error instanceof Error ? error.message : 'Could not open the file',
        )
      })
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-surface px-4">
      <div className="flex items-center gap-2">
        <Workflow size={18} className="text-accent" />
        <span className="text-sm font-bold tracking-tight text-gray-100">
          AgentFlow <span className="text-accent">Studio</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <FilePlus2 size={13} />
          New
        </button>
        <button
          onClick={handleSave}
          disabled={!hasNodes}
          title="Download the canvas as JSON (nodes, edges, viewport)"
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={13} />
          Save
        </button>
        <div className="relative flex items-center">
          <button
            onClick={handleScreenshotViewport}
            disabled={!hasNodes}
            title="Download a PNG of the current viewport"
            className="flex items-center gap-1.5 rounded-l-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Camera size={13} />
            Screenshot
          </button>
          <button
            onClick={() => setScreenshotMenuOpen((open) => !open)}
            disabled={!hasNodes}
            aria-label="Screenshot options"
            aria-expanded={screenshotMenuOpen}
            className="rounded-r-md border border-l-0 border-white/10 px-1.5 py-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronDown size={13} />
          </button>
          {screenshotMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setScreenshotMenuOpen(false)}
              />
              <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-white/10 bg-surface p-1 shadow-2xl">
                <button
                  onClick={handleScreenshotViewport}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-surface-2"
                >
                  Viewport
                </button>
                <button
                  onClick={handleScreenshotFull}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-surface-2"
                >
                  Full Graph
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => applyAutoLayout('TB')}
          disabled={!hasNodes}
          title="Auto-layout (Ctrl+L)"
          aria-label="Auto-layout"
          className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LayoutGrid size={13} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Open a saved canvas JSON file"
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <FolderOpen size={13} />
          Open
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleOpenFile(file)
            e.target.value = ''
          }}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => (simulationActive ? stopSimulation() : startSimulation())}
            disabled={!hasNodes && !simulationActive}
            title={
              !simulationActive && costEstimate.count > 0
                ? `~$${costEstimate.estimatedCostUsd.toFixed(4)} estimated across ${costEstimate.count} LLM node${costEstimate.count > 1 ? 's' : ''}`
                : undefined
            }
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              simulationActive
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-white/10 text-gray-300 hover:border-accent/50 hover:text-white'
            }`}
          >
            {simulationActive ? <Square size={13} /> : <Play size={13} />}
            {simulationActive ? 'Stop' : 'Simulate'}
          </button>
          {!simulationActive && costEstimate.count > 0 && (
            <span className="whitespace-nowrap rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
              ~${costEstimate.estimatedCostUsd.toFixed(4)} estimated
            </span>
          )}
          <HintIcon text={HINTS.controls.simulate} />
        </div>
        <div className="relative flex items-center gap-1">
          <button
            onClick={toggleLive}
            disabled={simulationActive}
            title={
              simulationActive
                ? 'Stop the simulation to switch modes'
                : liveMode
                  ? 'Disable live LLM execution'
                  : 'Enable live LLM execution'
            }
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              liveMode
                ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                : 'border-white/10 text-gray-300 hover:border-accent/50 hover:text-white'
            }`}
          >
            <Zap size={13} />
            Live
          </button>
          <HintIcon text={HINTS.controls.live} />
          {liveError && (
            <div className="absolute right-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-md border border-red-500/40 bg-red-950 px-2.5 py-1.5 text-[10px] text-red-300 shadow-xl">
              {liveError}
            </div>
          )}
        </div>
        <button
          onClick={toggleMinimap}
          title={minimapVisible ? 'Hide minimap' : 'Show minimap'}
          aria-label={minimapVisible ? 'Hide minimap' : 'Show minimap'}
          aria-pressed={minimapVisible}
          className={`rounded-md border p-1.5 transition-colors ${
            minimapVisible
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-white/10 text-gray-300 hover:border-accent/50 hover:text-white'
          }`}
        >
          <Map size={13} />
        </button>
        <button
          onClick={toggleAnimatedEdges}
          title="Animated edges"
          aria-label="Animated edges"
          aria-pressed={animatedEdgesEnabled}
          className={`rounded-md border p-1.5 transition-colors ${
            animatedEdgesEnabled
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-white/10 text-gray-500 hover:border-accent/50 hover:text-white'
          }`}
        >
          <Waves size={13} />
        </button>
        <button
          onClick={() => setSnapshotOpen(true)}
          title="Snapshot manager (Ctrl+Shift+S)"
          aria-label="Snapshot manager"
          className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <Bookmark size={13} />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title="LLM connection settings"
          aria-label="LLM connection settings"
          className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <Settings size={13} />
        </button>
        <button
          onClick={() => void handleShare()}
          title="Copy a shareable link to this flow"
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          {shareCopied ? <Check size={13} /> : <Share2 size={13} />}
          {shareCopied ? 'Copied!' : 'Share'}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExportOpen(true)}
            disabled={hasErrors || liveMode}
            title={
              hasErrors
                ? 'Fix validation errors before exporting'
                : liveMode
                  ? 'Disable Live mode to export'
                  : undefined
            }
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Code2 size={13} />
            Export Python
          </button>
          <HintIcon text={HINTS.controls.exportPython} />
        </div>
        <button
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
          className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <HelpCircle size={13} />
        </button>
      </div>
      <ConfirmDialog
        open={confirmNewOpen}
        title="Clear the canvas?"
        message="Unsaved work will be lost. Save first if you want to keep it."
        confirmLabel="Clear canvas"
        onConfirm={() => {
          clearCanvas()
          setConfirmNewOpen(false)
        }}
        onCancel={() => setConfirmNewOpen(false)}
      />
    </header>
  )
}
