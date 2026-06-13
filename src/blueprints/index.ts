import type { Blueprint } from '../types'
import { parseBlueprint } from '../utils/blueprintSchema'
import adaptiveRag from './adaptive-rag.json'
import agenticRag from './agentic-rag.json'
import correctiveRag from './corrective-rag.json'
import deepResearchAgent from './deep-research-agent.json'
import evaluatorCritic from './evaluator-critic.json'
import hierarchicalTeams from './hierarchical-teams.json'
import humanInLoop from './human-in-loop.json'
import longTermMemoryChatbot from './long-term-memory-chatbot.json'
import mapReduceSummarization from './map-reduce-summarization.json'
import multiAgentDebate from './multi-agent-debate.json'
import parallelFanout from './parallel-fanout.json'
import pipelineSequential from './pipeline-sequential.json'
import planAndExecute from './plan-and-execute.json'
import ragPipeline from './rag-pipeline.json'
import reactAgent from './react-agent.json'
import reflectionAgent from './reflection-agent.json'
import reflexionAgent from './reflexion-agent.json'
import selfCorrectingCodegen from './self-correcting-codegen.json'
import selfRag from './self-rag.json'
import stormResearch from './storm-research.json'
import supervisorWorkers from './supervisor-workers.json'
import swarm from './swarm.json'

// Category tags for the original blueprints (their JSON files predate the
// category field and are kept unchanged).
const LEGACY_CATEGORIES: Record<string, string> = {
  'react-agent': 'Single Agent',
  'rag-pipeline': 'RAG',
  'supervisor-workers': 'Multi-Agent',
  swarm: 'Multi-Agent',
  'human-in-loop': 'Human-in-Loop',
}

// JSON imports widen literal fields (e.g. node type) to plain strings;
// parseBlueprint validates each file at runtime and recovers the typed
// shape. Invalid blueprints are skipped with a console warning.
const raw: unknown[] = [
  reactAgent,
  ragPipeline,
  supervisorWorkers,
  swarm,
  humanInLoop,
  evaluatorCritic,
  parallelFanout,
  reflectionAgent,
  pipelineSequential,
  correctiveRag,
  planAndExecute,
  adaptiveRag,
  agenticRag,
  multiAgentDebate,
  reflexionAgent,
  mapReduceSummarization,
  stormResearch,
  selfCorrectingCodegen,
  selfRag,
  hierarchicalTeams,
  longTermMemoryChatbot,
  deepResearchAgent,
]

export const BLUEPRINTS: Blueprint[] = raw
  .map((entry) => parseBlueprint(entry))
  .filter((bp): bp is Blueprint => bp !== null)
  .map((bp) => ({
    ...bp,
    category: bp.category ?? LEGACY_CATEGORIES[bp.id],
  }))
