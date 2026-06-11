import type { Blueprint } from '../types'
import { parseBlueprint } from '../utils/blueprintSchema'
import evaluatorCritic from './evaluator-critic.json'
import humanInLoop from './human-in-loop.json'
import parallelFanout from './parallel-fanout.json'
import pipelineSequential from './pipeline-sequential.json'
import ragMemory from './rag-memory.json'
import ragPipeline from './rag-pipeline.json'
import reactAgent from './react-agent.json'
import reflectionAgent from './reflection-agent.json'
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
  ragMemory,
  pipelineSequential,
]

export const BLUEPRINTS: Blueprint[] = raw
  .map((entry) => parseBlueprint(entry))
  .filter((bp): bp is Blueprint => bp !== null)
  .map((bp) => ({
    ...bp,
    category: bp.category ?? LEGACY_CATEGORIES[bp.id],
  }))
