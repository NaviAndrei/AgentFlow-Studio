import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import type { EdgeTypes, IsValidConnection } from '@xyflow/react'
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { ArrowLeftRight, ArrowRight, GitBranch, Trash2 } from 'lucide-react'
import { nodeTypes, getNodeMeta, NODE_META } from '../nodes'
import { useCanvasStore } from '../store/canvasStore'
import { useUIStore } from '../store/uiStore'
import type { AgentFlowEdge, AgentFlowNode, AgentFlowNodeType, EdgeKind } from '../types'
import { deserializeCanvas, readCanvasFile } from '../utils/canvasSerializer'
import { setRfInstance } from '../utils/rfInstance'
import { FlowEdge, ParticleDefs } from './FlowEdge'
import { SelectionToolbar } from './SelectionToolbar'

const edgeTypes: EdgeTypes = {
  agentflow: FlowEdge,
}

const DEFAULT_EDGE_OPTIONS = { type: 'agentflow' }
const PRO_OPTIONS = { hideAttribution: false }

const EDGE_KIND_OPTIONS: { kind: EdgeKind; label: string; icon: typeof ArrowRight }[] = [
  { kind: 'direct', label: 'Direct', icon: ArrowRight },
  { kind: 'conditional', label: 'Conditional', icon: GitBranch },
  { kind: 'bidirectional', label: 'Bidirectional', icon: ArrowLeftRight },
]

interface EdgeMenuState {
  edgeId: string
  x: number
  y: number
  currentKind: EdgeKind
}

export function Canvas() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)
  const onConnect = useCanvasStore((s) => s.onConnect)
  const addNode = useCanvasStore((s) => s.addNode)
  const setEdgeKind = useCanvasStore((s) => s.setEdgeKind)
  const removeEdge = useCanvasStore((s) => s.removeEdge)
  const minimapVisible = useUIStore((s) => s.minimapVisible)
  const pendingNodes = useCanvasStore((s) => s.pendingNodes)
  const pendingEdges = useCanvasStore((s) => s.pendingEdges)
  const commitPendingFlow = useCanvasStore((s) => s.commitPendingFlow)
  const clearPendingFlow = useCanvasStore((s) => s.clearPendingFlow)
  const { screenToFlowPosition } = useReactFlow()
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState | null>(null)

  // Ghost-preview pending nodes: dimmed + non-interactive until committed.
  const displayNodes = useMemo(
    () =>
      pendingNodes.length === 0
        ? nodes
        : [
            ...nodes,
            ...pendingNodes.map((n) => ({
              ...n,
              selectable: false,
              draggable: false,
              className: 'opacity-50 pointer-events-none',
            })),
          ],
    [nodes, pendingNodes],
  )
  const displayEdges = useMemo(
    () => (pendingEdges.length === 0 ? edges : [...edges, ...pendingEdges]),
    [edges, pendingEdges],
  )

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      // A .json file dropped onto the canvas imports a saved document.
      const file = event.dataTransfer.files?.[0]
      if (file && file.name.toLowerCase().endsWith('.json')) {
        void readCanvasFile(file)
          .then((doc) => {
            const { nodes, edges, viewport } = deserializeCanvas(doc)
            useCanvasStore.getState().loadGraph(nodes, edges, viewport)
          })
          .catch((error: unknown) => {
            window.alert(
              error instanceof Error
                ? error.message
                : 'Could not open the file',
            )
          })
        return
      }
      const type = event.dataTransfer.getData('application/agentflow')
      if (!type || !(type in NODE_META)) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addNode(type as AgentFlowNodeType, position)
    },
    [screenToFlowPosition, addNode],
  )

  // Reject self-loops and exact-duplicate edges; cycles stay allowed (loop
  // blueprints like ReAct depend on back-edges).
  const isValidConnection = useCallback<IsValidConnection<AgentFlowEdge>>(
    (connection) => {
      if (!connection.source || !connection.target) return false
      if (connection.source === connection.target) return false
      return !useCanvasStore
        .getState()
        .edges.some(
          (e) =>
            e.source === connection.source &&
            e.target === connection.target &&
            (e.sourceHandle ?? null) === (connection.sourceHandle ?? null),
        )
    },
    [],
  )

  const onPaneClick = useCallback(() => setEdgeMenu(null), [])

  const onEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: AgentFlowEdge) => {
      event.preventDefault()
      setEdgeMenu({
        edgeId: edge.id,
        x: event.clientX,
        y: event.clientY,
        currentKind: edge.data?.edgeType ?? 'direct',
      })
    },
    [],
  )

  return (
    <>
      <ParticleDefs />
      <ReactFlow<AgentFlowNode>
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        isValidConnection={isValidConnection}
        onPaneClick={onPaneClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        colorMode="dark"
        fitView
        deleteKeyCode={null}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        proOptions={PRO_OPTIONS}
      >
        <SelectionToolbar />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.08)"
        />
        <Controls position="bottom-left" />
        {minimapVisible && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(node) => getNodeMeta(node.type)?.color ?? '#3a4150'}
            bgColor="#0d0e10"
            maskColor="rgba(13,14,16,0.6)"
            className="!border !border-white/10"
          />
        )}
      </ReactFlow>
      {edgeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setEdgeMenu(null)}>
          <div
            className="absolute w-44 rounded-lg border border-white/10 bg-surface p-1 shadow-2xl"
            style={{ left: edgeMenu.x, top: edgeMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {EDGE_KIND_OPTIONS.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                onClick={() => {
                  setEdgeKind(edgeMenu.edgeId, kind)
                  setEdgeMenu(null)
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-2 ${
                  edgeMenu.currentKind === kind ? 'text-accent' : 'text-gray-300'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={() => {
                removeEdge(edgeMenu.edgeId)
                setEdgeMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-surface-2"
            >
              <Trash2 size={12} />
              Delete edge
            </button>
          </div>
        </div>
      )}
      {pendingNodes.length > 0 && (
        <div className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-xs text-gray-200 shadow-2xl">
          <span>🪄 {pendingNodes.length} nodes ready to add</span>
          <button
            onClick={commitPendingFlow}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Add to canvas
          </button>
          <button
            onClick={clearPendingFlow}
            className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
          >
            Discard
          </button>
        </div>
      )}
    </>
  )
}
