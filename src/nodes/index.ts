import type { NodeTypes } from '@xyflow/react'
import { AgentNode } from './AgentNode'
import { CodeExecutorNode } from './CodeExecutorNode'
import { ConditionNode } from './ConditionNode'
import { EvaluatorNode } from './EvaluatorNode'
import { GroupNode } from './GroupNode'
import { GuardrailNode } from './GuardrailNode'
import { HumanInLoopNode } from './HumanInLoopNode'
import { JoinNode } from './JoinNode'
import { LLMNode } from './LLMNode'
import { LongTermStoreNode } from './LongTermStoreNode'
import { LoopNode } from './LoopNode'
import { MapNode } from './MapNode'
import { RouterNode } from './RouterNode'
import { MCPServerNode } from './MCPServerNode'
import { MemoryNode } from './MemoryNode'
import { MemoryWriterNode } from './MemoryWriterNode'
import { NoteNode } from './NoteNode'
import { OutputNode } from './OutputNode'
import { PlannerNode } from './PlannerNode'
import { RetrieverNode } from './RetrieverNode'
import { StartNode } from './StartNode'
import { StructuredOutputNode } from './StructuredOutputNode'
import { SubagentNode } from './SubagentNode'
import { SubgraphNode } from './SubgraphNode'
import { SupervisorNode } from './SupervisorNode'
import { SwarmWorkerNode } from './SwarmWorkerNode'
import { ToolNode } from './ToolNode'

export const nodeTypes: NodeTypes = {
  start: StartNode,
  llm: LLMNode,
  agent: AgentNode,
  tool: ToolNode,
  memory: MemoryNode,
  output: OutputNode,
  condition: ConditionNode,
  router: RouterNode,
  guardrail: GuardrailNode,
  join: JoinNode,
  loop: LoopNode,
  map: MapNode,
  evaluator: EvaluatorNode,
  humanInLoop: HumanInLoopNode,
  supervisor: SupervisorNode,
  swarmWorker: SwarmWorkerNode,
  retriever: RetrieverNode,
  mcpServer: MCPServerNode,
  structuredOutput: StructuredOutputNode,
  codeExecutor: CodeExecutorNode,
  subgraph: SubgraphNode,
  longTermStore: LongTermStoreNode,
  memoryWriter: MemoryWriterNode,
  planner: PlannerNode,
  subagent: SubagentNode,
  note: NoteNode,
  group: GroupNode,
}

export { NODE_META, PALETTE, getNodeMeta } from './registry'
export type { NodeMeta } from './registry'
