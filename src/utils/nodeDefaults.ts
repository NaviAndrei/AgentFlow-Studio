import type { AgentFlowNodeData, AgentFlowNodeType } from '../types'

export function createDefaultNodeData(type: AgentFlowNodeType): AgentFlowNodeData {
  switch (type) {
    case 'start':
      return { label: 'Start', inputVariables: ['input'] }
    case 'llm':
      return {
        label: 'LLM',
        model: 'gemini-2.5-flash',
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.7,
      }
    case 'agent':
      return { label: 'Agent', tools: [], maxIterations: 10 }
    case 'tool':
      return {
        label: 'Tool',
        toolName: 'my_tool',
        description: 'Describe what this tool does.',
        inputSchema: 'query: str',
        outputSchema: 'result: str',
      }
    case 'memory':
      return { label: 'Memory', memoryType: 'short-term' }
    case 'output':
      return { label: 'Output' }
    case 'condition':
      return { label: 'Condition', branches: ['if: condition', 'else'] }
    case 'router':
      return {
        label: 'Router',
        routes: ['billing', 'tech', 'other'],
        routingPrompt: 'Classify the request into one of the routes.',
      }
    case 'guardrail':
      return {
        label: 'Guardrail',
        checkType: 'keyword',
        criteria: 'safe, approved',
      }
    case 'join':
      return { label: 'Join', mergeStrategy: 'concat' }
    case 'loop':
      return { label: 'Loop', loopCondition: 'iterations < 5' }
    case 'map':
      return {
        label: 'Map',
        inputExpression: 'items',
        maxParallel: 10,
      }
    case 'codeExecutor':
      return {
        label: 'Code Executor',
        language: 'python',
        timeout: 30,
        allowNetworkAccess: false,
      }
    case 'evaluator':
      return {
        label: 'Evaluator',
        scoringPrompt:
          'Score the previous response. Reply with one of the branch names.',
        scoreType: 'pass_fail',
        threshold: 7,
        evalBranches: ['pass', 'fail'],
      }
    case 'subgraph':
      return {
        label: 'Subgraph',
        subgraphRef: '',
        subgraphSummary: 'Describe what this inner graph does.',
        inputMapping: '{}',
        outputMapping: '{}',
      }
    case 'longTermStore':
      return {
        label: 'Long-Term Store',
        namespace: 'user_memories',
        storeOperation: 'read',
        searchQuery: '',
      }
    case 'memoryWriter':
      return {
        label: 'Memory Writer',
        memoryKind: 'episodic',
        extractionPrompt:
          'Extract important facts and preferences from the conversation.',
        writeNamespace: 'user_memories',
      }
    case 'planner':
      return {
        label: 'Planner',
        decompositionPrompt:
          'Break the goal into 3-5 independent subtasks. Output them as a list.',
        maxTasks: 5,
      }
    case 'subagent':
      return {
        label: 'Subagent',
        role: 'Researcher',
        taskInput: 'task',
        tools: [],
        maxIterations: 5,
      }
    case 'computerUse':
      return {
        label: 'Computer Use',
        task: 'Navigate to the URL and extract the table',
        model: 'claude-sonnet-4-5',
        maxSteps: 10,
        allowedTools: ['screenshot', 'click', 'type', 'scroll'],
      }
    case 'a2aAgent':
      return {
        label: 'A2A Agent',
        agentUrl: 'http://localhost:8000/a2a',
        agentName: 'Remote Agent',
        taskDescription: 'Delegate this task to the remote agent.',
        authToken: '',
        timeoutSeconds: 30,
      }
    case 'multimodalInput':
      return {
        label: 'Multimodal Input',
        inputType: 'image',
        inputVariable: 'file_input',
        textPrompt: 'Describe what you see',
        encoding: 'url',
      }
    case 'humanInLoop':
      return { label: 'Human Review', description: 'Pause for human approval.' }
    case 'supervisor':
      return { label: 'Supervisor', description: 'Routes tasks to worker agents.' }
    case 'swarmWorker':
      return { label: 'Swarm Worker', description: 'Peer agent with handoff support.' }
    case 'retriever':
      return {
        label: 'Retriever',
        knowledgeBase: 'docs',
        topK: 4,
        similarityThreshold: 0.75,
      }
    case 'mcpServer':
      return { label: 'MCP Server', serverUrl: 'http://localhost:3001/mcp', mcpTools: [] }
    case 'structuredOutput':
      return {
        label: 'Structured Output',
        pydanticModel: 'OutputModel',
        jsonSchema: '{\n  "type": "object",\n  "properties": {\n    "answer": { "type": "string" }\n  }\n}',
      }
    case 'note':
      return { label: 'Note', text: 'Add an annotation…' }
    case 'group':
      return { label: 'Group', collapsed: false }
  }
}
