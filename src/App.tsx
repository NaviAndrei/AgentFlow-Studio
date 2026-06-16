import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCanvasStore } from './store/canvasStore'
import { decodeFlow } from './utils/shareUrl'
import { BlueprintGallery } from './components/BlueprintGallery'
import { Canvas } from './components/Canvas'
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary'
import { CostPanel } from './components/CostPanel'
import { EvalPanel } from './components/EvalPanel'
import { ExportModal } from './components/ExportModal'
import { Inspector } from './components/Inspector'
import { LLMSettingsModal } from './components/LLMSettingsModal'
import { Navbar } from './components/Navbar'
import { PanelRail } from './components/PanelRail'
import { ProblemsPanel } from './components/ProblemsPanel'
import { QuickAddPopup } from './components/QuickAddPopup'
import { MetricsBar } from './components/MetricsBar'
import { PromptRegistryPanel } from './components/PromptRegistryPanel'
import { RunHistoryPanel } from './components/RunHistoryPanel'
import { ShortcutsModal } from './components/ShortcutsModal'
import { Sidebar } from './components/Sidebar'
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
    })
  }, [])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-canvas font-mono text-gray-200">
        <Navbar />
        <CanvasErrorBoundary>
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="relative min-w-0 flex-1">
              <ValidationBar />
              <Canvas />
              <WelcomeOverlay />
            </main>
            <Inspector />
          </div>
          <BlueprintGallery />
          <ExportModal />
          <ShortcutsModal />
          <QuickAddPopup />
          <LLMSettingsModal />
          <TraceLog />
          <EvalPanel />
          <CostPanel />
          <PromptRegistryPanel />
          <RunHistoryPanel />
          <ProblemsPanel />
          <PanelRail />
          <MetricsBar />
        </CanvasErrorBoundary>
      </div>
    </ReactFlowProvider>
  )
}
