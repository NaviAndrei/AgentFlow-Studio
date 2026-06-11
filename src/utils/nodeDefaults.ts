import type { AgentFlowNodeData, AgentFlowNodeType } from '../types'

export function createDefaultNodeData(type: AgentFlowNodeType): AgentFlowNodeData {
  switch (type) {
    case 'start':
      return { label: 'Start', inputVariables: ['input'] }
    case 'llm':
      return {
        label: 'LLM',
        model: 'gemini-flash',
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
    case 'loop':
      return { label: 'Loop', loopCondition: 'iterations < 5' }
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
