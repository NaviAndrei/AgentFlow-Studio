import type { AgentFlowNodeType } from '../types'

/**
 * Pure, deterministic decision helpers shared by simulation and Live mode so
 * a node's configuration drives identical behavior in both. Routing nodes
 * resolve a `taken` value that the walker maps to an outgoing edge (by label,
 * else target id) via resolveCondition in the simulation store.
 */

/** Node types whose `taken` value selects a single outgoing edge. */
export const ROUTING_TYPES: AgentFlowNodeType[] = [
  'condition',
  'router',
  'guardrail',
  'evaluator',
]

export function isRoutingType(type: AgentFlowNodeType | undefined): boolean {
  return type !== undefined && ROUTING_TYPES.includes(type)
}

/** Trim, drop empties. */
function cleanList(values: readonly string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v !== '')
}

export interface RouteDecision {
  taken: string
  /** The route name that matched, or null when the fallback was used. */
  matchedOn: string | null
}

/**
 * Pick a route by keyword: the first route whose name appears (case-
 * insensitive) anywhere in the text. Falls back to the first route when
 * nothing matches, so a router always produces a usable edge.
 */
export function pickRouteByKeyword(
  routes: readonly string[],
  text: string,
): RouteDecision {
  const list = cleanList(routes)
  if (list.length === 0) return { taken: 'default', matchedOn: null }
  const haystack = text.toLowerCase()
  const hit = list.find((route) => haystack.includes(route.toLowerCase()))
  return hit !== undefined
    ? { taken: hit, matchedOn: hit }
    : { taken: list[0], matchedOn: null }
}

/**
 * A join is ready once every incoming source has either executed or been
 * skip-marked (an untaken branch must not block the join forever). With no
 * sources it is trivially ready.
 */
export function joinReadiness(
  sources: readonly string[],
  executed: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
): boolean {
  return sources.every((id) => executed.has(id) || skipped.has(id))
}

export interface ConditionDecision {
  /** The chosen branch name; equals the outgoing edge label it routes to. */
  taken: string
  /** False when no predicate matched and the else (last) branch was taken. */
  matched: boolean
}

/**
 * Evaluate a condition's branches as substring predicates over `content`: the
 * first branch (excluding the last) whose text appears in the content wins;
 * otherwise the last branch is the else. `forceElse` overrides everything and
 * takes the else branch — the walker sets it on a node's final allowed visit
 * so cycles always terminate. Branch names are the outgoing edge labels.
 */
export function evaluateConditionBranches(
  branches: readonly string[],
  content: string,
  forceElse: boolean,
): ConditionDecision {
  const list = cleanList(branches)
  if (list.length === 0) return { taken: 'default', matched: false }
  const elseBranch = list[list.length - 1]
  if (forceElse) return { taken: elseBranch, matched: false }
  const haystack = content.toLowerCase()
  for (let i = 0; i < list.length - 1; i++) {
    if (haystack.includes(list[i].toLowerCase())) {
      return { taken: list[i], matched: true }
    }
  }
  return { taken: elseBranch, matched: false }
}

export type JoinMergeStrategy = 'concat' | 'last'

export interface JoinSourceInput {
  source: string
  output: unknown
}

export interface JoinResult {
  merged: unknown
  strategy: JoinMergeStrategy
  waited_for: number
}

/**
 * Merge the outputs of a join's executed sources. `concat` collects them into
 * an array (the order the sources are given); `last` keeps only the final one.
 * Skip-marked sources are excluded by the caller (they have no output).
 */
export function mergeJoinInputs(
  inputs: readonly JoinSourceInput[],
  strategy: JoinMergeStrategy,
): JoinResult {
  if (strategy === 'last') {
    return {
      merged: inputs[inputs.length - 1]?.output ?? null,
      strategy,
      waited_for: inputs.length,
    }
  }
  return {
    merged: inputs.map((i) => i.output),
    strategy,
    waited_for: inputs.length,
  }
}

export interface GuardrailDecision {
  taken: 'pass' | 'fail'
  /** The criterion keyword that was found, or null. */
  matched: string | null
}

/**
 * Keyword guardrail: passes when the content contains at least one of the
 * comma/newline-separated criteria keywords, fails otherwise. Empty criteria
 * pass (nothing to enforce).
 */
export function evaluateKeywordGuardrail(
  criteria: string,
  content: string,
): GuardrailDecision {
  const terms = cleanList(criteria.split(/[\n,]/))
  if (terms.length === 0) return { taken: 'pass', matched: null }
  const haystack = content.toLowerCase()
  const hit = terms.find((term) => haystack.includes(term.toLowerCase()))
  return hit !== undefined
    ? { taken: 'pass', matched: hit }
    : { taken: 'fail', matched: null }
}
