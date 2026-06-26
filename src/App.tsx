import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCanvasStore } from './store/canvasStore'
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
import { Inspector } from './components/Inspector'
import { LastRunSummaryBar } from './components/LastRunSummaryBar'
import { LLMSettingsModal } from './components/LLMSettingsModal'
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
              <Inspector />
            </PanelErrorBoundary>
          </div>
          <BlueprintGallery />
          <ExportModal />
          <ShortcutsModal />
          <SnapshotModal />
          <QuickAddPopup />
          <LLMSettingsModal />
          <PanelErrorBoundary name="Debugger">
            <TraceLog />
          </PanelErrorBoundary>
          <EvalPanel />
          <CostPanel />
          <PromptRegistryPanel />
          <PanelErrorBoundary name="Run History">
            <RunHistoryPanel />
          </PanelErrorBoundary>
          <ProblemsPanel />
          <MCPServersPanel />
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
