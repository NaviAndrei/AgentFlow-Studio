import { useEffect, useState } from 'react'
import { UserCheck } from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { Modal } from './Modal'

/**
 * Modal gate shown when the run halts at a `humanInLoop` node. Replaces
 * window.prompt(): the typed value is injected into nodeOutputs[nodeId] via
 * submitHumanInput() so downstream nodes can read it, then the run resumes.
 * Cancel rejects the gate (marks it errored, skips downstream, ends the run).
 */
export function HumanInLoopModal() {
  const pendingApproval = useSimulationStore((s) => s.pendingApproval)
  const submitHumanInput = useSimulationStore((s) => s.submitHumanInput)
  const reject = useSimulationStore((s) => s.reject)
  const node = useCanvasStore((s) =>
    pendingApproval ? s.nodes.find((n) => n.id === pendingApproval.nodeId) : undefined,
  )
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue('')
  }, [pendingApproval?.nodeId])

  if (!pendingApproval) return null

  const handleSubmit = () => {
    submitHumanInput(value)
  }

  return (
    <Modal
      open
      onClose={reject}
      title={node?.data.label ?? 'Human approval required'}
      icon={UserCheck}
      maxWidth="md"
    >
      <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
        {node?.data.description ?? 'The run is paused for your input.'}
      </p>
      <textarea
        autoFocus
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Type your response…"
        className="w-full resize-none rounded-lg border border-white/10 bg-surface-2 p-2.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-accent/50 focus:outline-none"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={reject}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-red-500/50 hover:text-red-300"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/20"
        >
          Submit
        </button>
      </div>
      <p className="mt-2 text-[10px] text-gray-600">Enter to submit · Esc to cancel</p>
    </Modal>
  )
}
