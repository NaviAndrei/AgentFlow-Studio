import type { AgentFlowNode, AgentFlowNodeType } from '../types'

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Simulated processing time per node type (also paces the run loop). */
export function nodeStepDurationMs(type: AgentFlowNodeType | undefined): number {
  switch (type) {
    case 'llm':
    case 'agent':
      return 2500
    case 'condition':
      return 1000
    case 'tool':
    case 'retriever':
    case 'mcpServer':
      return 1500
    case 'start':
    case 'output':
      return 800
    default:
      return 1800
  }
}

/** Particle travel time (seconds) for edges, keyed by the TARGET node type. */
export function edgeDurationSec(targetType: AgentFlowNodeType | undefined): number {
  switch (targetType) {
    case 'llm':
    case 'agent':
      return 2.5
    case 'condition':
      return 1.0
    case 'tool':
    case 'retriever':
    case 'mcpServer':
      return 1.5
    default:
      return 1.8
  }
}

/** Text shown streaming inside the node card while it is "processing". */
export function fakeStreamTextFor(node: AgentFlowNode): string {
  switch (node.type) {
    case 'llm':
      return truncate(node.data.systemPrompt ?? 'Generating response…', 110)
    case 'agent':
      return 'Thinking: decompose task → pick tool → observe result → synthesize answer…'
    case 'tool':
      return JSON.stringify(
        {
          tool: node.data.toolName ?? 'my_tool',
          args: { query: 'simulated input' },
          status: 'ok',
        },
        null,
        2,
      )
    case 'memory':
      return JSON.stringify(
        { type: node.data.memoryType ?? 'short-term', hits: 3 },
        null,
        2,
      )
    case 'supervisor':
      return 'Routing: scoring workers against the task…'
    case 'swarmWorker':
      return 'Working… may hand off to a peer.'
    case 'retriever':
      return JSON.stringify(
        {
          kb: node.data.knowledgeBase ?? 'docs',
          top_k: node.data.topK ?? 4,
          hits: 3,
        },
        null,
        2,
      )
    case 'mcpServer':
      return JSON.stringify(
        {
          server: node.data.serverUrl ?? '',
          tools: (node.data.mcpTools ?? []).filter(Boolean).length,
        },
        null,
        2,
      )
    case 'structuredOutput':
      return JSON.stringify(
        { model: node.data.pydanticModel ?? 'OutputModel', valid: true },
        null,
        2,
      )
    default:
      return ''
  }
}

/** Fake-but-realistic node result shapes for the State Inspector. */
export function fakeOutputFor(node: AgentFlowNode, userInput: string): unknown {
  const label = node.data.label
  switch (node.type) {
    case 'start':
      return {
        inputs: Object.fromEntries(
          (node.data.inputVariables ?? ['input'])
            .filter(Boolean)
            .map((v) => [v, userInput || 'Hello!']),
        ),
      }
    case 'llm':
      return {
        role: 'assistant',
        content: `(simulated) ${label} reply to: "${truncate(userInput || 'Hello!', 60)}"`,
        model: node.data.model ?? 'gemini-flash',
        temperature: node.data.temperature ?? 0.7,
      }
    case 'tool':
      return {
        name: node.data.toolName ?? 'my_tool',
        args: { query: '(simulated) query' },
        result: '(simulated) 3 results found',
      }
    case 'agent':
      return {
        intermediate_steps: [
          'plan: break the task into steps',
          `call: ${(node.data.tools ?? ['tool']).filter(Boolean)[0] ?? 'tool'}("…")`,
          'observe: result received',
        ],
        final_answer: `(simulated) ${label} answer to: "${truncate(userInput || 'Hello!', 60)}"`,
      }
    case 'memory':
      return {
        short_term: ['last user message', 'last assistant reply'],
        long_term_hits: 3,
      }
    case 'condition': {
      const branches = (node.data.branches ?? []).filter(Boolean)
      return { evaluated: branches, taken: branches[0] ?? 'default' }
    }
    case 'loop':
      return { iteration: 1, until: node.data.loopCondition ?? '', done: false }
    case 'humanInLoop':
      return { paused: true, approved: '(simulated) auto-approved' }
    case 'supervisor':
      return { routed_to: '(simulated) best worker', strategy: 'score-based' }
    case 'swarmWorker':
      return { handoff: null, result: `(simulated) work by ${label}` }
    case 'output':
      return { final_reply: '(simulated) final reply to the user' }
    case 'retriever':
      return {
        kb: node.data.knowledgeBase ?? 'docs',
        top_k: node.data.topK ?? 4,
        threshold: node.data.similarityThreshold ?? 0.75,
        chunks: ['(simulated) chunk about the topic…', '(simulated) related passage…'],
      }
    case 'mcpServer':
      return {
        server: node.data.serverUrl ?? '',
        tools: (node.data.mcpTools ?? []).filter(Boolean),
        called: '(simulated) none',
      }
    case 'structuredOutput':
      return {
        model: node.data.pydanticModel ?? 'OutputModel',
        parsed: { answer: '(simulated) schema-compliant answer' },
        valid: true,
      }
    default:
      return { note: 'no simulated output for this node type' }
  }
}

/** Rough token cost charged to the metrics bar per simulated node. */
export function fakeTokensFor(node: AgentFlowNode): number {
  switch (node.type) {
    case 'llm':
      return 140
    case 'agent':
      return 220
    case 'supervisor':
    case 'swarmWorker':
      return 90
    case 'tool':
    case 'condition':
    case 'retriever':
    case 'mcpServer':
      return 30
    case 'structuredOutput':
      return 60
    default:
      return 10
  }
}
