import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface HintIconProps {
  text: string
}

/**
 * Small "i" icon that shows a short explanation on hover or keyboard focus.
 * The tooltip is rendered in a portal so it isn't clipped by the scrollable
 * Sidebar / Inspector panels, and flips above/below based on viewport space.
 */
export function HintIcon({ text }: HintIconProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(
    null,
  )
  const ref = useRef<HTMLButtonElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const placement = rect.top > 80 ? 'top' : 'bottom'
    const left = Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120)
    const top = placement === 'top' ? rect.top - 6 : rect.bottom + 6
    setPos({ top, left, placement })
  }, [open])

  return (
    <>
      <button
        ref={ref}
        type="button"
        tabIndex={0}
        aria-label="More info"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="shrink-0 text-gray-500 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
      >
        <Info size={11} />
      </button>
      {open &&
        pos &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            className="pointer-events-none fixed z-50 max-w-[220px] break-words rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-[10px] normal-case leading-relaxed tracking-normal text-gray-300 shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              transform: `translate(-50%, ${pos.placement === 'top' ? '-100%' : '0'})`,
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  )
}
