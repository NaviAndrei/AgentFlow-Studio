import { wordDiff } from '../utils/wordDiff'

interface SuggestionDiffPreviewProps {
  current: string
  suggested: string
  onAccept: () => void
  onReject: () => void
}

/**
 * Inline (no modal) word-level diff between the current and suggested system
 * prompt, with Accept / Reject actions. Inserts are green, deletes are red +
 * strikethrough, equal text is plain.
 */
export function SuggestionDiffPreview({
  current,
  suggested,
  onAccept,
  onReject,
}: SuggestionDiffPreviewProps) {
  const segments = wordDiff(current, suggested)
  return (
    <div className="mt-2 rounded border border-white/10 p-2 text-sm">
      <div className="whitespace-pre-wrap font-mono text-xs">
        {segments.map((seg, i) => {
          if (seg.type === 'insert')
            return (
              <span key={i} className="bg-green-100 dark:bg-green-900">
                {seg.text}
              </span>
            )
          if (seg.type === 'delete')
            return (
              <span
                key={i}
                className="bg-red-100 line-through dark:bg-red-900"
              >
                {seg.text}
              </span>
            )
          return <span key={i}>{seg.text}</span>
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onAccept}
          className="rounded-md border border-accent bg-accent/15 px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/25"
        >
          ✓ Accept
        </button>
        <button
          onClick={onReject}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  )
}
