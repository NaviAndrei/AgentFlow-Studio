import {
  BookOpen,
  Bot,
  Crown,
  Database,
  Flag,
  GitBranch,
  Group,
  Play,
  Plug,
  Repeat,
  Sparkles,
  StickyNote,
  Table,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AgentFlowNodeType, NodeCategory } from '../types'

export interface NodeMeta {
  type: AgentFlowNodeType
  label: string
  category: NodeCategory
  color: string
  icon: LucideIcon
  description: string
}

export const NODE_META: Record<AgentFlowNodeType, NodeMeta> = {
  start: {
    type: 'start',
    label: 'Start',
    category: 'core',
    color: '#16a34a',
    icon: Play,
    description: 'Entry point with input variables',
  },
  llm: {
    type: 'llm',
    label: 'LLM',
    category: 'core',
    color: '#7c3aed',
    icon: Sparkles,
    description: 'Model call with system prompt',
  },
  agent: {
    type: 'agent',
    label: 'Agent',
    category: 'core',
    color: '#4f46e5',
    icon: Bot,
    description: 'LLM + tools reasoning loop',
  },
  tool: {
    type: 'tool',
    label: 'Tool',
    category: 'core',
    color: '#ea580c',
    icon: Wrench,
    description: 'Callable tool with schema',
  },
  memory: {
    type: 'memory',
    label: 'Memory',
    category: 'core',
    color: '#0891b2',
    icon: Database,
    description: 'Short-term, vector or checkpoint',
  },
  output: {
    type: 'output',
    label: 'Output',
    category: 'core',
    color: '#dc2626',
    icon: Flag,
    description: 'Final reply to the user',
  },
  condition: {
    type: 'condition',
    label: 'Condition',
    category: 'flow',
    color: '#ca8a04',
    icon: GitBranch,
    description: 'if / elif / else branching',
  },
  loop: {
    type: 'loop',
    label: 'Loop',
    category: 'flow',
    color: '#475569',
    icon: Repeat,
    description: 'Iterate until a condition holds',
  },
  humanInLoop: {
    type: 'humanInLoop',
    label: 'Human-in-Loop',
    category: 'flow',
    color: '#db2777',
    icon: UserCheck,
    description: 'Pause for human approval',
  },
  supervisor: {
    type: 'supervisor',
    label: 'Supervisor',
    category: 'multiagent',
    color: '#b45309',
    icon: Crown,
    description: 'Routes tasks to worker agents',
  },
  swarmWorker: {
    type: 'swarmWorker',
    label: 'Swarm Worker',
    category: 'multiagent',
    color: '#0d9488',
    icon: Users,
    description: 'Peer agent with handoffs',
  },
  retriever: {
    type: 'retriever',
    label: 'Retriever',
    category: 'core',
    color: '#4f46e5',
    icon: BookOpen,
    description: 'Vector store similarity search',
  },
  mcpServer: {
    type: 'mcpServer',
    label: 'MCP Server',
    category: 'core',
    color: '#475569',
    icon: Plug,
    description: 'External tools via MCP',
  },
  structuredOutput: {
    type: 'structuredOutput',
    label: 'Structured Output',
    category: 'core',
    color: '#7c3aed',
    icon: Table,
    description: 'Enforce a Pydantic schema',
  },
  note: {
    type: 'note',
    label: 'Sticky Note',
    category: 'annotation',
    color: '#57534e',
    icon: StickyNote,
    description: 'Free-text canvas annotation',
  },
  group: {
    type: 'group',
    label: 'Group',
    category: 'annotation',
    color: '#00c4cc',
    icon: Group,
    description: 'Collapsible frame around nodes',
  },
}

export const PALETTE: { title: string; types: AgentFlowNodeType[] }[] = [
  {
    title: 'Core',
    types: [
      'start',
      'llm',
      'agent',
      'tool',
      'retriever',
      'mcpServer',
      'structuredOutput',
      'memory',
      'output',
    ],
  },
  { title: 'Flow Control', types: ['condition', 'loop', 'humanInLoop'] },
  { title: 'Multi-Agent', types: ['supervisor', 'swarmWorker'] },
  { title: 'Annotation', types: ['note'] },
]
