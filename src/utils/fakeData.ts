import type { AgentFlowNode, AgentFlowNodeType } from '../types'

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function estimateTokens(text: string): number {
  return Math.ceil((text ?? '').length / 4)
}

/** Simulated processing time per node type (also paces the run loop). */
export function nodeStepDurationMs(type: AgentFlowNodeType | undefined): number {
  switch (type) {
    case 'llm':
    case 'agent':
      return 2500
    case 'condition':
    case 'router':
    case 'guardrail':
    case 'evaluator':
      return 1000
    case 'join':
      return 600
    case 'map':
      return 700
    case 'codeExecutor':
      return 1400
    case 'subgraph':
      return 2200
    case 'longTermStore':
    case 'memoryWriter':
      return 900
    case 'planner':
      return 2000
    case 'subagent':
      return 2400
    case 'computerUse':
      return 2600
    case 'a2aAgent':
      return 1800
    case 'multimodalInput':
      return 800
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
    case 'router':
      return `Classifying into: ${(node.data.routes ?? []).filter(Boolean).join(', ')}…`
    case 'guardrail':
      return `Checking (${node.data.checkType ?? 'keyword'})…`
    case 'join':
      return `Waiting for branches → merge (${node.data.mergeStrategy ?? 'concat'})…`
    case 'map':
      return `Fanning out over ${node.data.inputExpression ?? 'items'} (Send)…`
    case 'codeExecutor':
      return `$ ${node.data.language ?? 'python'} snippet…`
    case 'evaluator':
      return `Judging (${node.data.scoreType ?? 'pass_fail'})…`
    case 'subgraph':
      return `Subgraph "${(node.data.subgraphRef ?? 'inner').trim() || 'inner'}" running…`
    case 'longTermStore':
      return `Store ${node.data.storeOperation ?? 'read'} on ${node.data.namespace ?? 'user_memories'}…`
    case 'memoryWriter':
      return `Extracting ${node.data.memoryKind ?? 'episodic'} memories…`
    case 'planner':
      return 'Decomposing goal into todos…'
    case 'subagent':
      return `Subagent (${node.data.role ?? 'worker'}) working on assigned task…`
    case 'computerUse':
      return 'screenshot → act → screenshot…'
    case 'a2aAgent':
      return `Calling ${node.data.agentName ?? 'remote agent'} via A2A…`
    case 'multimodalInput':
      return `Encoding ${node.data.inputType ?? 'image'} input…`
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
        model: node.data.model ?? '—',
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
    case 'router': {
      const routes = (node.data.routes ?? []).filter(Boolean)
      return { routes, taken: routes[0] ?? 'default' }
    }
    case 'guardrail':
      return { checkType: node.data.checkType ?? 'keyword', taken: 'pass' }
    case 'join':
      return { strategy: node.data.mergeStrategy ?? 'concat', merged: [] }
    case 'map': {
      const items = ['item_1', 'item_2', 'item_3']
      return {
        over: node.data.inputExpression ?? 'items',
        item_var: 'item',
        items,
        fanned_out: items.length,
        max_parallel: node.data.maxParallel ?? 10,
      }
    }
    case 'codeExecutor':
      // First-visit fake: a failed run. simulationStore overrides this on the
      // node's second visit with a passing run to demonstrate a fix loop.
      return {
        language: node.data.language ?? 'python',
        stdout: '',
        stderr:
          "Traceback (most recent call last):\n  File \"<stdin>\", line 1, in <module>\nNameError: name 'total' is not defined",
        exit_code: 1,
        execution_time_ms: 187,
      }
    case 'subgraph':
      return {
        subgraph: (node.data.subgraphRef ?? '').trim() || 'inner',
        summary: node.data.subgraphSummary ?? '',
        ran: true,
        result: '(simulated) compressed subgraph result',
      }
    case 'longTermStore': {
      const op = node.data.storeOperation ?? 'read'
      const namespace = node.data.namespace ?? 'user_memories'
      if (op === 'write') {
        return {
          op,
          namespace,
          wrote: 1,
          key: '(simulated) memory_id',
        }
      }
      return {
        op,
        namespace,
        memories: [
          'User prefers concise answers',
          'User is building an agent IDE',
          'User asked about LangGraph Send last week',
        ],
        hits: 3,
      }
    }
    case 'memoryWriter':
      return {
        kind: node.data.memoryKind ?? 'episodic',
        namespace: node.data.writeNamespace ?? 'user_memories',
        extracted: 2,
        items: [
          '(simulated) The user is debugging a fan-out pattern.',
          '(simulated) Preferred response style: terse + cite sources.',
        ],
      }
    case 'planner': {
      const max = node.data.maxTasks ?? 5
      const all = [
        'Research subtopic A',
        'Research subtopic B',
        'Research subtopic C',
        'Cross-reference findings',
        'Draft synthesis',
      ]
      const todos = all.slice(0, Math.min(max, 3))
      return {
        goal: truncate(userInput || 'Hello!', 80),
        todos,
        count: todos.length,
      }
    }
    case 'subagent':
      return {
        role: node.data.role ?? 'Researcher',
        task: '(simulated) assigned task',
        iterations: 2,
        tools_used: (node.data.tools ?? []).filter(Boolean).slice(0, 2),
        result: `(simulated) compressed result from ${node.data.role ?? 'subagent'}`,
      }
    case 'computerUse':
      return {
        result: 'Task completed: navigated to target and extracted data',
        model: node.data.model ?? 'claude-sonnet-4-6',
        steps_taken: 4,
        actions: [
          'screenshot',
          'click(245,312)',
          "type('search query')",
          'screenshot',
        ],
        success: true,
      }
    case 'a2aAgent':
      return {
        response: `(simulated) ${node.data.agentName ?? 'Remote Agent'} completed task`,
        agent_url: node.data.agentUrl ?? '',
        status: 'completed',
        round_trips: 1,
      }
    case 'multimodalInput':
      return {
        content_type: node.data.inputType ?? 'image',
        description: `(simulated) ${node.data.inputType ?? 'image'} input has been provided`,
        text_prompt: node.data.textPrompt ?? 'Describe what you see',
        encoding: node.data.encoding ?? 'url',
        ready_for_llm: true,
      }
    case 'evaluator': {
      const branches = (node.data.evalBranches ?? ['pass', 'fail']).filter(
        Boolean,
      )
      // First branch wins by default; the walker's resolveCondition picks the
      // edge whose label matches `taken`. simulationStore.conditionOutput
      // (reused for evaluator below) does substring matching against latest
      // content so configured criteria drive the path.
      return {
        score_type: node.data.scoreType ?? 'pass_fail',
        score: 0.82,
        threshold: node.data.threshold ?? 7,
        evaluated: branches,
        taken: branches[0] ?? 'pass',
      }
    }
    case 'loop':
      return { iteration: 1, until: node.data.loopCondition ?? '', done: false }
    case 'humanInLoop':
      // Approval is applied by the user via approve()/reject(); the node's own
      // output just records that it paused.
      return { paused: true }
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
    case 'join':
    case 'map':
      return 0
    case 'tool':
    case 'condition':
    case 'router':
    case 'guardrail':
    case 'retriever':
    case 'mcpServer':
      return 30
    case 'codeExecutor':
      return 25
    case 'subgraph':
      return 80
    case 'longTermStore':
      return 15
    case 'memoryWriter':
      return 80
    case 'planner':
      return 130
    case 'subagent':
      return 200
    case 'computerUse':
      return 180
    case 'a2aAgent':
      return 90
    case 'multimodalInput':
      return 10
    case 'evaluator':
      return 60
    case 'structuredOutput':
      return 60
    default:
      return 10
  }
}
