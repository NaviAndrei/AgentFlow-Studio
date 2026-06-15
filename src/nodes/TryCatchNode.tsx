import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'
import { useSimulationStore } from '../store/simulationStore'

export function TryCatchNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const status = useSimulationStore((s) =>
    s.isActive ? s.tryCatchStatus[id] : undefined,
  )
  const catchErrors = data.tryCatch?.catchErrors ?? ['any']

  return (
    <NodeShell
      id={id}
      meta={NODE_META.tryCatch}
      data={data}
      selected={selected}
      hasOutput={false}
      bottomHandles={[
        { id: 'onSuccess', side: 'left', color: '#22c55e', title: 'onSuccess' },
        { id: 'onError', side: 'right', color: '#ef4444', title: 'onError' },
      ]}
    >
      <Field k="catches" v={catchErrors.join(', ')} />
      {status && (
        <div className="mt-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
          {status === 'watching' && <span className="text-gray-400">Watching…</span>}
          {status === 'success' && <span className="text-green-400">✓ Success</span>}
          {status === 'error' && <span className="text-red-400">✗ Caught</span>}
        </div>
      )}
    </NodeShell>
  )
}
