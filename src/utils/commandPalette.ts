export interface PaletteCommand {
  id: string
  label: string
  keywords: string[]
  group: 'Canvas' | 'Simulation' | 'View' | 'Snapshots' | 'Export' | 'Nodes'
  shortcut?: string
  disabled?: boolean
  action: () => void
}

/** Parses a `nodes: <query>` palette search; returns null when the query isn't a node search. */
export function parseNodeSearchQuery(query: string): string | null {
  return query.startsWith('nodes:') ? query.slice('nodes:'.length).trim() : null
}

/** Filters nodes by label or type substring for the `nodes:` palette search. */
export function filterNodesBySearch<T extends { type?: string; data: { label?: string } }>(
  nodes: T[],
  search: string,
): T[] {
  const q = search.toLowerCase()
  return nodes.filter(
    (n) =>
      q === '' ||
      (n.data.label ?? '').toLowerCase().includes(q) ||
      (n.type ?? '').toLowerCase().includes(q),
  )
}

/** Score returns 0 (no match) or positive integer (higher = better). */
export function scoreCommand(cmd: PaletteCommand, query: string): number {
  const q = query.trim().toLowerCase()
  if (q === '') return 1
  const haystacks = [cmd.label, ...cmd.keywords].map((s) => s.toLowerCase())
  if (haystacks.some((h) => h.startsWith(q))) return 3
  if (haystacks.some((h) => h.includes(q))) return 2
  return 0
}
