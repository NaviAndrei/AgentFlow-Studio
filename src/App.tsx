import { ReactFlowProvider } from '@xyflow/react'
import { BlueprintGallery } from './components/BlueprintGallery'
import { Canvas } from './components/Canvas'
import { CostPanel } from './components/CostPanel'
import { EvalPanel } from './components/EvalPanel'
import { ExportModal } from './components/ExportModal'
import { Inspector } from './components/Inspector'
import { LLMSettingsModal } from './components/LLMSettingsModal'
import { Navbar } from './components/Navbar'
import { QuickAddPopup } from './components/QuickAddPopup'
import { MetricsBar } from './components/MetricsBar'
import { ShortcutsModal } from './components/ShortcutsModal'
import { Sidebar } from './components/Sidebar'
import { TraceLog } from './components/TraceLog'
import { useKeyboardShortcuts } from './components/useKeyboardShortcuts'
import { ValidationBar } from './components/ValidationBar'
import { WelcomeOverlay } from './components/WelcomeOverlay'

export default function App() {
  useKeyboardShortcuts()
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-canvas font-mono text-gray-200">
        <Navbar />
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
        <MetricsBar />
      </div>
    </ReactFlowProvider>
  )
}
