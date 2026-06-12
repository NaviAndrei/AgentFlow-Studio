import { useMemo, useState } from 'react'
import { Check, Code2, Copy } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { exportPython, exportRequirements } from '../utils/codeExporter'
import { exportMermaid } from '../utils/mermaidExporter'
import { Modal } from './Modal'

type ExportTab = 'main.py' | 'requirements.txt' | 'diagram.mmd'

export function ExportModal() {
  const exportOpen = useUIStore((s) => s.exportOpen)
  const setExportOpen = useUIStore((s) => s.setExportOpen)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<ExportTab>('main.py')
  const [asyncMode, setAsyncMode] = useState(false)

  const code = useMemo(
    () => (exportOpen ? exportPython(nodes, edges, { asyncMode }) : ''),
    [exportOpen, nodes, edges, asyncMode],
  )
  const requirements = useMemo(
    () => (exportOpen ? exportRequirements(nodes) : ''),
    [exportOpen, nodes],
  )
  const mermaid = useMemo(
    () => (exportOpen ? exportMermaid(nodes, edges) : ''),
    [exportOpen, nodes, edges],
  )

  if (!exportOpen) return null

  const shownContent =
    tab === 'main.py' ? code : tab === 'requirements.txt' ? requirements : mermaid

  const handleCopy = () => {
    void navigator.clipboard.writeText(shownContent).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Modal
      open={exportOpen}
      onClose={() => setExportOpen(false)}
      title="Export LangGraph Python"
      icon={Code2}
      maxWidth="3xl"
      className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-surface p-5 shadow-2xl outline-none"
      headerActions={
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      }
    >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1">
            {(['main.py', 'requirements.txt', 'diagram.mmd'] as ExportTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                  tab === t
                    ? 'bg-accent/15 text-accent'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-white/10 p-0.5">
            {([false, true] as const).map((mode) => (
              <button
                key={String(mode)}
                onClick={() => setAsyncMode(mode)}
                className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  asyncMode === mode
                    ? 'bg-accent/15 text-accent'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {mode ? 'Async' : 'Sync'}
              </button>
            ))}
          </div>
        </div>
        <pre className="flex-1 overflow-auto rounded-lg border border-white/10 bg-canvas p-4 text-[11px] leading-relaxed text-gray-300">
          <code>{shownContent}</code>
        </pre>
    </Modal>
  )
}
