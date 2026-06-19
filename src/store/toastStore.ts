// Lightweight ephemeral notification queue — the app's only feedback
// mechanism before this was window.alert(). Kept as its own domain store
// per the debuggerStore precedent (small, ephemeral UI state).
import { create } from 'zustand'

export interface ToastMessage {
  id: string
  text: string
  tone: 'info' | 'warning'
}

interface ToastState {
  toasts: ToastMessage[]
  pushToast: (text: string, tone?: ToastMessage['tone']) => void
  dismissToast: (id: string) => void
}

const AUTO_DISMISS_MS = 3000

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  pushToast: (text, tone = 'info') => {
    const id = crypto.randomUUID().slice(0, 8)
    set({ toasts: [...get().toasts, { id, text, tone }] })
    window.setTimeout(() => get().dismissToast(id), AUTO_DISMISS_MS)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
