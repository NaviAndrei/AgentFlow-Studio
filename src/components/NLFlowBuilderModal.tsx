import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Modal } from './Modal'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { NODE_META } from '../nodes'
import { descriptionToFlow } from '../utils/nlToFlow'
import type { AgentFlowNodeType } from '../types'

const REGISTERED_NODE_TYPES = Object.keys(NODE_META) as AgentFlowNodeType[]

const btnPrimary =
  'rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
const btnGhost =
  'rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
const inputCls =
  'w-full rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-xs text-gray-200 focus:border-accent focus:outline-none'

export function NLFlowBuilderModal() {
  const open = useUIStore((s) => s.nlBuilderOpen)
  const setOpen = useUIStore((s) => s.setNlBuilderOpen)
  const setPendingFlow = useCanvasStore((s) => s.setPendingFlow)

  const [description, setDescription] = useState('')
  const [refinement, setRefinement] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [hasGenerated, setHasGenerated] = useState(false)
  const [history, setHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([])

  const close = () => {
    setOpen(false)
    setError(null)
    setWarnings([])
  }

  const generate = async (text: string, isRefine: boolean) => {
    if (!text.trim()) return
    setGenerating(true)
    setError(null)
    const result = await descriptionToFlow(
      REGISTERED_NODE_TYPES,
      text,
      isRefine ? history : undefined,
    )
    setGenerating(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setPendingFlow(result.nodes, result.edges)
    setHasGenerated(true)
    setHistory((h) => [
      ...h,
      { role: 'user', content: text },
      { role: 'assistant', content: `Generated ${result.nodes.length} nodes` },
    ])
    if (result.warnings.length > 0) {
      setWarnings(result.warnings)
      return
    }
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Build from description"
      icon={Wand2}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3">
        <textarea
          className={`${inputCls} h-28 resize-none`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your flow in plain English. Example: 'Research agent that searches the web, summarizes results, stores key facts'"
        />
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-950/50 px-2.5 py-1.5 text-xs text-red-300">
            {error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-300">
            ⚠ {warnings.length} unknown node type(s) were replaced with 'unknown' —
            you can fix them in the Inspector
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={() => void generate(description, false)}
            disabled={generating || !description.trim()}
            className={btnPrimary}
          >
            {generating ? 'Generating…' : 'Generate ✨'}
          </button>
        </div>

        {hasGenerated && (
          <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              Refine
            </span>
            <textarea
              className={`${inputCls} h-16 resize-none`}
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder="e.g. 'add a guardrail before the output'"
            />
            <div className="flex justify-end">
              <button
                onClick={() => void generate(refinement, true)}
                disabled={generating || !refinement.trim()}
                className={btnGhost}
              >
                {generating ? 'Refining…' : 'Refine ✨'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
