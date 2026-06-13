import type { AgentFlowNode } from '../types'

/**
 * Maps a free-text design-time model id to the LangChain setup the Python
 * exporter emits. One policy for the whole exporter: family is inferred
 * from the id's shape, legacy tier ids stay exportable via the alias map.
 */
export interface ModelSetup {
  /** Python constructor call, e.g. `ChatOllama(model="llama3", temperature=0.7)`. */
  pythonLine: (varName: string, temperature: number) => string
  /** Import line for the chat class. */
  importLine: string
  /** pip requirement that provides the import. */
  requirement: string
  /** Env var the generated main() should guard on, if any. */
  envVar?: string
}

/** Legacy capability-tier ids from early canvases, mapped to concrete ids. */
const MODEL_ALIASES: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
}

/** Suggestions for the Inspector's model datalist (export targets). */
export const MODEL_PRESETS: readonly string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-4o-mini',
  'gpt-4o',
  'groq/llama-3.3-70b-versatile',
  'openrouter/auto',
  'ollama/llama3',
  'ollama/mistral',
]

function pyQuote(value: string): string {
  return JSON.stringify(value)
}

/** Resolve a design-time model id to its exporter setup. */
export function resolveModelSetup(model: string): ModelSetup {
  const id = MODEL_ALIASES[model] ?? model

  if (id.startsWith('gemini')) {
    return {
      pythonLine: (v, t) =>
        `${v} = ChatGoogleGenerativeAI(model=${pyQuote(id)}, temperature=${t})`,
      importLine: 'from langchain_google_genai import ChatGoogleGenerativeAI',
      requirement: 'langchain-google-genai',
      envVar: 'GOOGLE_API_KEY',
    }
  }

  if (id.startsWith('ollama/')) {
    const name = id.slice('ollama/'.length)
    return {
      pythonLine: (v, t) =>
        `${v} = ChatOllama(model=${pyQuote(name)}, temperature=${t})`,
      importLine: 'from langchain_ollama import ChatOllama',
      requirement: 'langchain-ollama',
    }
  }

  if (id.startsWith('groq/')) {
    const name = id.slice('groq/'.length)
    return {
      pythonLine: (v, t) =>
        `${v} = ChatOpenAI(model=${pyQuote(name)}, temperature=${t}, base_url="https://api.groq.com/openai/v1", api_key=os.environ["GROQ_API_KEY"])`,
      importLine: 'from langchain_openai import ChatOpenAI',
      requirement: 'langchain-openai',
      envVar: 'GROQ_API_KEY',
    }
  }

  if (id.startsWith('openrouter/')) {
    const name = id.slice('openrouter/'.length)
    return {
      pythonLine: (v, t) =>
        `${v} = ChatOpenAI(model=${pyQuote(name)}, temperature=${t}, base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])`,
      importLine: 'from langchain_openai import ChatOpenAI',
      requirement: 'langchain-openai',
      envVar: 'OPENROUTER_API_KEY',
    }
  }

  // Default family: any other id is treated as an OpenAI-compatible model.
  return {
    pythonLine: (v, t) => `${v} = ChatOpenAI(model=${pyQuote(id)}, temperature=${t})`,
    importLine: 'from langchain_openai import ChatOpenAI',
    requirement: 'langchain-openai',
    envVar: 'OPENAI_API_KEY',
  }
}

/**
 * Model-source policy for nodes that emit LLM calls but have no model field
 * (router, guardrail llm-judge, structured output): the node's own override
 * wins, else the first LLM node on canvas, else null — the caller must emit
 * an honest TODO rather than silently picking a provider the user never
 * configured.
 */
export function inferExportModel(
  nodes: AgentFlowNode[],
  node: AgentFlowNode,
): string | null {
  const override = (node.data.modelOverride ?? '').trim()
  if (override !== '') return override
  const firstLLM = nodes.find((n) => n.type === 'llm' && (n.data.model ?? '') !== '')
  return firstLLM?.data.model ?? null
}
