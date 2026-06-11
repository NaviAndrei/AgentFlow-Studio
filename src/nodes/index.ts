import type { NodeTypes } from '@xyflow/react'
import { AgentNode } from './AgentNode'
import { ConditionNode } from './ConditionNode'
import { GroupNode } from './GroupNode'
import { HumanInLoopNode } from './HumanInLoopNode'
import { LLMNode } from './LLMNode'
import { LoopNode } from './LoopNode'
import { MCPServerNode } from './MCPServerNode'
import { MemoryNode } from './MemoryNode'
import { NoteNode } from './NoteNode'
import { OutputNode } from './OutputNode'
import { RetrieverNode } from './RetrieverNode'
import { StartNode } from './StartNode'
import { StructuredOutputNode } from './StructuredOutputNode'
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
  loop: LoopNode,
  humanInLoop: HumanInLoopNode,
  supervisor: SupervisorNode,
  swarmWorker: SwarmWorkerNode,
  retriever: RetrieverNode,
  mcpServer: MCPServerNode,
  structuredOutput: StructuredOutputNode,
  note: NoteNode,
  group: GroupNode,
}

export { NODE_META, PALETTE } from './registry'
export type { NodeMeta } from './registry'
