import { Suspense, lazy, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { PanelRightOpen } from 'lucide-react'
import { useCanvasStore } from './store/canvasStore'
import { useUIStore } from './store/uiStore'
import { decodeFlow } from './utils/shareUrl'
import { warnMissingTokens } from './utils/warnMissingTokens'
import { BlueprintGallery } from './components/BlueprintGallery'
import { Canvas } from './components/Canvas'
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary'
import { CommandPalette } from './components/CommandPalette'
import { PanelErrorBoundary } from './components/PanelErrorBoundary'
import { CostPanel } from './components/CostPanel'
import { EvalPanel } from './components/EvalPanel'
import { ExportModal } from './components/ExportModal'
import { HumanInLoopModal } from './components/HumanInLoopModal'
const Inspector = lazy(() => import('./components/Inspector').then((m) => ({ default: m.Inspector })))
import { LastRunSummaryBar } from './components/LastRunSummaryBar'
import { LLMSettingsModal } from './components/LLMSettingsModal'
import { NLFlowBuilderModal } from './components/NLFlowBuilderModal'
import { Navbar } from './components/Navbar'
import { PanelRail } from './components/PanelRail'
import { MCPServersPanel } from './components/MCPServersPanel'
import { ProblemsPanel } from './components/ProblemsPanel'
import { QuickAddPopup } from './components/QuickAddPopup'
import { MetricsBar } from './components/MetricsBar'
import { PromptRegistryPanel } from './components/PromptRegistryPanel'
import { RunHistoryPanel } from './components/RunHistoryPanel'
import { ShortcutsModal } from './components/ShortcutsModal'
import { Sidebar } from './components/Sidebar'
import { SnapshotModal } from './components/SnapshotModal'
import { ToastHost } from './components/ToastHost'
import { TraceLog } from './components/TraceLog'
import { useKeyboardShortcuts } from './components/useKeyboardShortcuts'
import { ValidationBar } from './components/ValidationBar'
import { WelcomeOverlay } from './components/WelcomeOverlay'

export default function App() {
  useKeyboardShortcuts()

  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const toggleInspector = useUIStore((s) => s.toggleInspector)
  // Inspector pulls in heavy sub-imports (callLLMDirect, mcpClient, a2aClient,
  // etc.) that we don't want paid for until the user actually opens it. Mount
  // it once on first open and keep it mounted to avoid remount cost on close.
  const [inspectorEverOpened, setInspectorEverOpened] = useState(inspectorOpen)

  useEffect(() => {
    if (inspectorOpen) setInspectorEverOpened(true)
  }, [inspectorOpen])

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('flow')
    if (!param) return
    void decodeFlow(param).then((result) => {
      if (!result) return
      const clean = new URL(window.location.href)
      clean.searchParams.delete('flow')
      window.history.replaceState({}, '', clean.toString())
      useCanvasStore.getState().loadGraph(result.nodes, result.edges)
      warnMissingTokens(result.nodes)
    })
  }, [])

  useEffect(() => {
    warnMissingTokens()
  }, [])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-canvas font-mono text-gray-200">
        <Navbar />
        <LastRunSummaryBar />
        <CanvasErrorBoundary>
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="relative min-w-0 flex-1">
              <ValidationBar />
              <Canvas />
              <WelcomeOverlay />
            </main>
            <PanelErrorBoundary name="Inspector">
              {inspectorEverOpened ? (
                <Suspense fallback={null}>
                  <Inspector />
                </Suspense>
              ) : (
                <div className="flex w-9 shrink-0 flex-col items-center border-l border-white/10 bg-surface py-2">
                  <button
                    onClick={toggleInspector}
                    title="Show inspector"
                    aria-label="Show inspector"
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-surface-2 hover:text-white"
                  >
                    <PanelRightOpen size={15} />
                  </button>
                </div>
              )}
            </PanelErrorBoundary>
          </div>
          <BlueprintGallery />
          <ExportModal />
          <ShortcutsModal />
          <SnapshotModal />
          <QuickAddPopup />
          <LLMSettingsModal />
          <NLFlowBuilderModal />
          <PanelErrorBoundary name="Debugger">
            <TraceLog />
          </PanelErrorBoundary>
          <PanelErrorBoundary name="Eval">
            <EvalPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary name="Cost">
            <CostPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary name="Prompt Registry">
            <PromptRegistryPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary name="Run History">
            <RunHistoryPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary name="Problems">
            <ProblemsPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary name="MCP Servers">
            <MCPServersPanel />
          </PanelErrorBoundary>
          <PanelRail />
          <MetricsBar />
          <HumanInLoopModal />
          <CommandPalette />
          <ToastHost />
        </CanvasErrorBoundary>
      </div>
    </ReactFlowProvider>
  )
}
