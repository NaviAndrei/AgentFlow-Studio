import { useEffect, useRef, useState } from 'react'
import {
  Code2,
  Download,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  LayoutTemplate,
  Play,
  Settings,
  Square,
  Workflow,
  Zap,
} from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'
import { useBlueprintStore } from '../store/blueprintStore'
import { useLLMConfigStore } from '../store/llmConfigStore'
import { useSimulationStore } from '../store/simulationStore'
import {
  deserializeCanvas,
  downloadCanvas,
  readCanvasFile,
} from '../utils/canvasSerializer'
import { listOllamaModels } from '../utils/llmClient'
import { ConfirmDialog } from './Modal'

export function Navbar() {
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const hasNodes = useCanvasStore((s) => s.nodes.length > 0)
  const hasErrors = useCanvasStore((s) =>
    s.validationIssues.some((i) => i.level === 'error'),
  )
  const setGalleryOpen = useBlueprintStore((s) => s.setGalleryOpen)
  const setExportOpen = useBlueprintStore((s) => s.setExportOpen)
  const setShortcutsOpen = useBlueprintStore((s) => s.setShortcutsOpen)
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
    const config = useLLMConfigStore.getState()
    if (config.provider === 'gemini') {
      if (config.geminiApiKey.trim() === '') {
        setLiveError('Set a Gemini API key in settings')
        return
      }
      setLiveMode(true)
      return
    }
    void listOllamaModels(config.ollamaUrl)
      .then(() => setLiveMode(true))
      .catch((error: unknown) =>
        setLiveError(
          error instanceof Error ? error.message : 'Ollama not reachable',
        ),
      )
  }

  const [confirmNewOpen, setConfirmNewOpen] = useState(false)

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
    downloadCanvas(nodes, edges)
  }

  const handleOpenFile = (file: File) => {
    void readCanvasFile(file)
      .then((doc) => {
        const { nodes, edges } = deserializeCanvas(doc)
        useCanvasStore.getState().loadGraph(nodes, edges)
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
          title="Download the canvas as JSON"
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={13} />
          Save
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
        <button
          onClick={() => setGalleryOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <LayoutTemplate size={13} />
          Blueprints
        </button>
        <button
          onClick={() => (simulationActive ? stopSimulation() : startSimulation())}
          disabled={!hasNodes && !simulationActive}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            simulationActive
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-white/10 text-gray-300 hover:border-accent/50 hover:text-white'
          }`}
        >
          {simulationActive ? <Square size={13} /> : <Play size={13} />}
          {simulationActive ? 'Stop' : 'Simulate'}
        </button>
        <div className="relative">
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
          {liveError && (
            <div className="absolute right-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-md border border-red-500/40 bg-red-950 px-2.5 py-1.5 text-[10px] text-red-300 shadow-xl">
              {liveError}
            </div>
          )}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          title="LLM connection settings"
          className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          <Settings size={13} />
        </button>
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
        <button
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard shortcuts"
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
