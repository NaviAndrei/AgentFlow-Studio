import { useEffect, useRef, useState } from 'react'

interface StreamingTextProps {
  text: string
  /** chars: 20 chars/sec typewriter; lines: reveal line-by-line (JSON). */
  mode: 'chars' | 'lines'
}

const CHARS_PER_SEC = 20
const LINES_PER_SEC = 3

/**
 * Progressively reveals `text`. If the target text grows while revealing
 * (live LLM streaming), the reveal simply keeps catching up. The unit count
 * lives in a ref so a growing stream doesn't tear down and recreate the
 * interval on every chunk — it's created once per mount (keyed on mode).
 */
export function StreamingText({ text, mode }: StreamingTextProps) {
  const [count, setCount] = useState(0)
  const units = mode === 'chars' ? text.length : text.split('\n').length
  const unitsRef = useRef(units)
  unitsRef.current = units

  useEffect(() => {
    const interval = window.setInterval(
      () => {
        setCount((c) => (c < unitsRef.current ? c + 1 : c))
      },
      1000 / (mode === 'chars' ? CHARS_PER_SEC : LINES_PER_SEC),
    )
    return () => window.clearInterval(interval)
  }, [mode])

  const shown = Math.min(count, units)
  const visible =
    mode === 'chars'
      ? text.slice(0, shown)
      : text.split('\n').slice(0, shown).join('\n')
  const done = shown >= units

  return (
    <pre className="max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-accent/80">
      {visible}
      {!done && <span className="sim-caret">▍</span>}
    </pre>
  )
}
