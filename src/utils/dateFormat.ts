// Relative time formatting with absolute time tooltip support

/** Returns true only when a note string exists and contains non-whitespace content. */
export function hasVisibleNote(note: string | undefined): note is string {
  return typeof note === 'string' && note.trim().length > 0
}

export function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function getAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}
