import { TriangleAlert } from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'

export function ValidationBar() {
  const issues = useCanvasStore((s) => s.validationIssues)
  if (issues.length === 0) return null

  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.length - errors
  const parts: string[] = []
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`)
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`)

  return (
    <div
      className={`absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md border px-3 py-1.5 text-xs shadow-lg ${
        errors > 0
          ? 'border-red-500/40 bg-red-950/80 text-red-300'
          : 'border-yellow-500/40 bg-yellow-950/80 text-yellow-300'
      }`}
    >
      <TriangleAlert size={13} />
      <span>
        {parts.join(' · ')}
        {errors > 0 && ' — fix before export'}
      </span>
    </div>
  )
}
