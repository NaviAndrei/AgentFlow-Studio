import type { AgentFlowEdge, AgentFlowNode, ValidationIssue } from '../types'

/** Node types that participate in execution flow (notes are annotations). */
const NON_FLOW_TYPES = ['note', 'group']

/** Flow-node ids reachable by walking edges forward from any seed (inclusive). */
function reachableFrom(
  seeds: string[],
  edges: AgentFlowEdge[],
  flowIds: Set<string>,
): Set<string> {
  const seen = new Set<string>(seeds.filter((id) => flowIds.has(id)))
  const stack = [...seen]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined) break
    for (const e of edges) {
      if (e.source === id && flowIds.has(e.target) && !seen.has(e.target)) {
        seen.add(e.target)
        stack.push(e.target)
      }
    }
  }
  return seen
}

export function validateGraph(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
): ValidationIssue[] {
  if (nodes.length === 0) return []

  const issues: ValidationIssue[] = []
  const flowNodes = nodes.filter(
    (n) => n.type !== undefined && !NON_FLOW_TYPES.includes(n.type),
  )
  const hasOutgoing = (id: string) => edges.some((e) => e.source === id)
  const hasIncoming = (id: string) => edges.some((e) => e.target === id)

  // A Multimodal Input can act as the entry point in a vision pipeline, so it
  // satisfies the "needs an entry" requirement in place of a Start node.
  const hasEntry = flowNodes.some(
    (n) => n.type === 'start' || n.type === 'multimodalInput',
  )
  if (!hasEntry) {
    issues.push({ level: 'error', message: 'Canvas has no Start node' })
  }

  for (const node of flowNodes) {
    if (node.type === 'llm' && !node.data.model) {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: 'LLM node has no model selected',
      })
    }
    if (node.type === 'tool' && (node.data.toolName ?? '').trim() === '') {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: 'Tool node has no name',
      })
    }
    if (node.type === 'start' && !hasOutgoing(node.id)) {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: 'Start node has no outgoing edge',
      })
    } else if (
      node.type !== 'output' &&
      node.type !== 'start' &&
      !hasOutgoing(node.id)
    ) {
      issues.push({
        nodeId: node.id,
        level: 'warning',
        message: 'Node has no outgoing edge',
      })
    }

    // Condition branch names are the outgoing edge labels; warn on any that
    // has no matching edge (it can never be routed to).
    if (node.type === 'condition') {
      const labels = new Set(
        edges
          .filter((e) => e.source === node.id)
          .map((e) => (typeof e.label === 'string' ? e.label : '')),
      )
      for (const branch of (node.data.branches ?? []).filter(Boolean)) {
        if (!labels.has(branch)) {
          issues.push({
            nodeId: node.id,
            level: 'warning',
            message: `Branch "${branch}" has no matching outgoing edge`,
          })
        }
      }
    }

    // Routers need at least two routes and a wired edge per route label.
    if (node.type === 'router') {
      const outs = edges.filter((e) => e.source === node.id)
      if (outs.length < 2) {
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: 'Router needs at least two routes',
        })
      }
      const labels = new Set(
        outs.map((e) => (typeof e.label === 'string' ? e.label : '')),
      )
      for (const route of (node.data.routes ?? []).filter(Boolean)) {
        if (!labels.has(route)) {
          issues.push({
            nodeId: node.id,
            level: 'error',
            message: `Route "${route}" has no outgoing edge`,
          })
        }
      }
    }

    // Evaluators route on configured branches like Router — every branch must
    // have a matching outgoing edge label.
    if (node.type === 'evaluator') {
      const branches = (node.data.evalBranches ?? []).filter(Boolean)
      const outs = edges.filter((e) => e.source === node.id)
      if (branches.length < 2) {
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: 'Evaluator needs at least two branches',
        })
      }
      const labels = new Set(
        outs.map((e) => (typeof e.label === 'string' ? e.label : '')),
      )
      for (const branch of branches) {
        if (!labels.has(branch)) {
          issues.push({
            nodeId: node.id,
            level: 'error',
            message: `Branch "${branch}" has no outgoing edge`,
          })
        }
      }
      if ((node.data.scoringPrompt ?? '').trim() === '') {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Evaluator has no scoring prompt — it will always pass',
        })
      }
    }

    // Guardrails route on pass/fail; both edges must exist.
    if (node.type === 'guardrail') {
      const labels = new Set(
        edges
          .filter((e) => e.source === node.id)
          .map((e) => (typeof e.label === 'string' ? e.label : '')),
      )
      for (const branch of ['pass', 'fail']) {
        if (!labels.has(branch)) {
          issues.push({
            nodeId: node.id,
            level: 'error',
            message: `Guardrail is missing its "${branch}" edge`,
          })
        }
      }
    }

    // Planner emits a todos list — best paired with a downstream Map/executor.
    if (node.type === 'planner') {
      if ((node.data.decompositionPrompt ?? '').trim() === '') {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Planner has no decomposition prompt',
        })
      }
      const outs = edges.filter((e) => e.source === node.id)
      const dispatches = outs.some((e) => {
        const t = nodes.find((n) => n.id === e.target)?.type
        return t === 'map' || t === 'subagent' || t === 'agent'
      })
      if (outs.length > 0 && !dispatches) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message:
            'Planner output is usually fanned out via a Map or handed to a Subagent',
        })
      }
    }

    // Subagent is typically delegated to (incoming edge required to be useful).
    if (node.type === 'subagent') {
      if (!hasIncoming(node.id)) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Subagent has no incoming delegation edge',
        })
      }
    }

    // Long-Term Store needs a namespace.
    if (node.type === 'longTermStore') {
      if ((node.data.namespace ?? '').trim() === '') {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Long-Term Store has no namespace set',
        })
      }
    }

    // Memory Writer needs a Long-Term Store on the canvas to write into.
    if (node.type === 'memoryWriter') {
      const hasStore = nodes.some((n) => n.type === 'longTermStore')
      if (!hasStore) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message:
            'Memory Writer has no Long-Term Store on the canvas to write into',
        })
      }
    }

    // Multimodal Input should feed an LLM that can actually process it.
    if (node.type === 'multimodalInput') {
      const feedsLlm = edges.some((e) => {
        if (e.source !== node.id) return false
        const t = nodes.find((n) => n.id === e.target)?.type
        return t === 'llm' || t === 'agent'
      })
      if (hasOutgoing(node.id) && !feedsLlm) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message:
            'Multimodal Input is not connected to an LLM/Agent that can process it',
        })
      }
    }

    // A2A Remote Agent needs a real endpoint URL.
    if (node.type === 'a2aAgent') {
      const url = (node.data.agentUrl ?? '').trim()
      if (url === '') {
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: 'A2A Agent has no endpoint URL',
        })
      } else if (/localhost|127\.0\.0\.1/.test(url)) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'A2A Agent points at localhost — likely dev only',
        })
      }
    }

    // Computer-Use needs an outgoing edge (its result must flow somewhere) and
    // a computer-use-capable model.
    if (node.type === 'computerUse') {
      if (!hasOutgoing(node.id)) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Computer-Use result has no outgoing edge',
        })
      }
      const model = node.data.model ?? ''
      if (model !== 'claude-sonnet-4-5' && model !== 'claude-opus-4') {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Computer-Use requires a computer-use-capable model (Claude 3.5+)',
        })
      }
    }

    // Subgraph references an inner canvas — flag if no reference is set.
    if (node.type === 'subgraph') {
      if ((node.data.subgraphRef ?? '').trim() === '') {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Subgraph has no inner-graph reference set',
        })
      }
    }

    // Code Executor pairs with an upstream LLM (provides code) and a downstream
    // routing node (drives the fix loop).
    if (node.type === 'codeExecutor') {
      const incoming = edges.filter((e) => e.target === node.id)
      const hasLlmUpstream = incoming.some(
        (e) => nodes.find((n) => n.id === e.source)?.type === 'llm',
      )
      if (!hasLlmUpstream) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Code Executor has no upstream LLM to generate code',
        })
      }
      const outgoing = edges.filter((e) => e.source === node.id)
      const routesDownstream = outgoing.some((e) => {
        const t = nodes.find((n) => n.id === e.target)?.type
        return t === 'condition' || t === 'router' || t === 'guardrail'
      })
      if (outgoing.length > 0 && !routesDownstream) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message:
            'Code Executor without a downstream routing node will not self-correct on failure',
        })
      }
    }

    // Map (Send) needs an outgoing edge to dispatch to, and a Join downstream
    // typically collects the per-item results.
    if (node.type === 'map') {
      const outs = edges.filter((e) => e.source === node.id)
      if (outs.length === 0) {
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: 'Map node has no outgoing edge to fan out to',
        })
      }
      if ((node.data.inputExpression ?? '').trim() === '') {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Map has no list source configured',
        })
      }
      const joinIds = new Set(
        nodes.filter((n) => n.type === 'join').map((n) => n.id),
      )
      const reach = reachableFrom(
        [node.id],
        edges,
        new Set(flowNodes.map((n) => n.id)),
      )
      reach.delete(node.id)
      const reachesJoin = [...reach].some((id) => joinIds.has(id))
      if (!reachesJoin && outs.length > 0) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Map fan-out has no downstream Join to collect results',
        })
      }
    }

    // A join with a single incoming edge merges nothing.
    if (node.type === 'join') {
      const incoming = edges.filter((e) => e.target === node.id).length
      if (incoming < 2) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Join has fewer than two incoming branches',
        })
      }
    }

    // Supervisors that route to nobody do nothing.
    if (node.type === 'supervisor' && !hasOutgoing(node.id)) {
      issues.push({
        nodeId: node.id,
        level: 'warning',
        message: 'Supervisor has no worker edges',
      })
    }

    // A vector-store Memory only makes sense feeding a Retriever.
    if (node.type === 'memory' && node.data.memoryType === 'vector-store') {
      const feedsRetriever = edges.some(
        (e) =>
          e.source === node.id &&
          nodes.find((n) => n.id === e.target)?.type === 'retriever',
      )
      if (!feedsRetriever) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Vector-store memory is not connected to a Retriever',
        })
      }
    }
  }

  // A graph that produces no Output never surfaces a final reply.
  if (flowNodes.length > 0 && !flowNodes.some((n) => n.type === 'output')) {
    issues.push({
      level: 'warning',
      message: 'Canvas has no Output node',
    })
  }

  // Flow nodes unreachable from any entry node never execute. Multimodal Input
  // counts as an entry alongside Start. Only meaningful once an entry exists and
  // is wired; skip the all-disconnected early state.
  const starts = flowNodes
    .filter((n) => n.type === 'start' || n.type === 'multimodalInput')
    .map((n) => n.id)
  if (starts.length > 0) {
    const flowIds = new Set(flowNodes.map((n) => n.id))
    const reachable = reachableFrom(starts, edges, flowIds)
    for (const node of flowNodes) {
      if (node.type === 'start') continue
      // A node wired into the graph but unreachable from Start is the real
      // smell; a fully disconnected node is already flagged by other rules.
      if (!reachable.has(node.id) && (hasIncoming(node.id) || hasOutgoing(node.id))) {
        issues.push({
          nodeId: node.id,
          level: 'warning',
          message: 'Node is not reachable from a Start node',
        })
      }
    }
  }

  return issues
}
