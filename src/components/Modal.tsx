import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type MaxWidth = 'sm' | 'md' | 'lg' | '3xl'

const MAX_WIDTH: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  '3xl': 'max-w-3xl',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  icon?: LucideIcon
  children: ReactNode
  /** Extra controls rendered in the header, left of the close button. */
  headerActions?: ReactNode
  maxWidth?: MaxWidth
  /** Top-anchored (command-palette style) instead of vertically centered. */
  align?: 'center' | 'top'
  /** Replaces the default flex column body wrapper when the modal manages its own scroll. */
  className?: string
}

/**
 * Accessible modal shell: role="dialog" + aria-modal, focus moves in on open
 * and is restored to the trigger on close, Tab is trapped within the panel,
 * and Escape / backdrop click close it. Replaces the duplicated backdrop +
 * stopPropagation markup the individual modals used to carry.
 */
export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  headerActions,
  maxWidth = 'md',
  align = 'center',
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    // Focus the first focusable control, else the panel itself.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/60 p-6 ${
        align === 'top' ? 'items-start pt-[18vh]' : 'items-center'
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={
          className ??
          `w-full ${MAX_WIDTH[maxWidth]} rounded-xl border border-white/10 bg-surface p-5 shadow-2xl outline-none`
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id={titleId}
            className="flex items-center gap-2 text-sm font-bold text-gray-100"
          >
            {Icon && <Icon size={16} className="text-accent" />}
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-surface-2 hover:text-white"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Small confirm modal replacing window.confirm so dialogs share one language. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="sm">
      <p className="mb-5 text-xs leading-relaxed text-gray-400">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/30 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
