/**
 * Kahn's algorithm with cycle tolerance: when the queue empties before all
 * nodes are visited (a cycle, e.g. a condition looping back), the remaining
 * node with the lowest in-degree is processed next so every node still
 * appears exactly once in the result.
 */
export function topologicalSort(
  ids: string[],
  edges: { source: string; target: string }[],
): string[] {
  const idSet = new Set(ids)
  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]))
  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]))

  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const order: string[] = []
  const visited = new Set<string>()
  const queue = ids.filter((id) => inDegree.get(id) === 0)

  while (visited.size < ids.length) {
    if (queue.length === 0) {
      const remaining = ids
        .filter((id) => !visited.has(id))
        .sort((a, b) => (inDegree.get(a) ?? 0) - (inDegree.get(b) ?? 0))
      queue.push(remaining[0])
    }
    const id = queue.shift()
    if (id === undefined || visited.has(id)) continue
    visited.add(id)
    order.push(id)
    for (const next of adjacency.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1)
      if (!visited.has(next) && (inDegree.get(next) ?? 0) <= 0) {
        queue.push(next)
      }
    }
  }

  return order
}
