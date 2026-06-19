import { useToastStore } from '../store/toastStore'

/** Fixed top-right notification stack — fork/undo/redo feedback. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-3 top-14 z-[60] flex w-72 flex-col gap-1.5">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`animate-toast-in rounded-md border bg-surface px-3 py-2 text-left text-[11px] text-gray-200 shadow-lg transition-opacity ${
            t.tone === 'warning' ? 'border-l-2 border-l-amber-500 border-white/10' : 'border-white/10'
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
