import { getNodeMeta } from '../nodes'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'

/**
 * Minimal recursive JSON renderer with hand-rolled syntax colors:
 * keys cyan (accent), strings amber, numbers violet, booleans pink, null gray.
 */
function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-500">null</span>
  }
  if (typeof value === 'string') {
    return <span className="text-amber-300/90">"{value}"</span>
  }
  if (typeof value === 'number') {
    return <span className="text-violet-300">{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-pink-400">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-500">[]</span>
    return (
      <span>
        <span className="text-gray-500">[</span>
        <div className="border-l border-white/5 pl-3">
          {value.map((item, i) => (
            <div key={i}>
              <JsonValue value={item} />
              {i < value.length - 1 && <span className="text-gray-600">,</span>}
            </div>
          ))}
        </div>
        <span className="text-gray-500">]</span>
      </span>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>
    return (
      <span>
        <span className="text-gray-500">{'{'}</span>
        <div className="border-l border-white/5 pl-3">
          {entries.map(([key, v], i) => (
            <div key={key}>
              <span className="text-accent">{key}</span>
              <span className="text-gray-600">: </span>
              <JsonValue value={v} />
              {i < entries.length - 1 && <span className="text-gray-600">,</span>}
            </div>
          ))}
        </div>
        <span className="text-gray-500">{'}'}</span>
      </span>
    )
  }
  return <span className="text-gray-400">{String(value)}</span>
}

export function StateInspector() {
  const executionQueue = useSimulationStore((s) => s.executionQueue)
  const currentNodeIndex = useSimulationStore((s) => s.currentNodeIndex)
  const nodeOutputs = useSimulationStore((s) => s.nodeOutputs)
  const nodeEngines = useSimulationStore((s) => s.nodeEngines)
  const messages = useSimulationStore((s) => s.messages)
  const nodes = useCanvasStore((s) => s.nodes)

  // Dedupe: loop iterations put a node in the executed slice twice; the
  // section shows its latest output once.
  const executed = [...new Set(executionQueue.slice(0, currentNodeIndex))]
    .map((id) => ({ id, node: nodes.find((n) => n.id === id) }))
    .filter((e) => e.node !== undefined && nodeOutputs[e.id] !== undefined)

  return (
    <div className="space-y-3 text-[11px] leading-relaxed">
      {messages.length > 0 && (
        <div>
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            messages
          </h3>
          <div className="rounded-md border border-white/10 bg-canvas p-2">
            <JsonValue value={messages} />
          </div>
        </div>
      )}
      {executed.length === 0 && messages.length === 0 && (
        <p className="text-xs text-gray-500">
          No state yet — the graph state appears here as nodes execute.
        </p>
      )}
      {executed.map(({ id, node }) => {
        if (!node) return null
        const meta = getNodeMeta(node.type)
        return (
          <div key={id}>
            <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {meta && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
              )}
              {node.data.label}
              {nodeEngines[id] && (
                <span
                  className={`rounded px-1 py-px text-[9px] normal-case tracking-normal ${
                    nodeEngines[id] === 'live'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {nodeEngines[id] === 'live' ? '⚡ live' : 'simulated'}
                </span>
              )}
            </h3>
            <div className="rounded-md border border-white/10 bg-canvas p-2">
              <JsonValue value={nodeOutputs[id]} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
