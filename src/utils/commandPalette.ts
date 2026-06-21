export interface PaletteCommand {
  id: string
  label: string
  keywords: string[]
  group: 'Canvas' | 'Simulation' | 'View' | 'Snapshots' | 'Export'
  shortcut?: string
  disabled?: boolean
  action: () => void
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
