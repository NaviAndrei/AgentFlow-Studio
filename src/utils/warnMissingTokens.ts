import { useCanvasStore } from '../store/canvasStore'
import { useToastStore } from '../store/toastStore'
import type { AgentFlowNode } from '../types'

export function warnMissingTokens(nodes?: AgentFlowNode[]): void {
  const all = nodes ?? useCanvasStore.getState().nodes
  const affected = all.filter(
    (n) =>
      (n.type === 'tool' || n.type === 'retriever') &&
      (n.data.endpointUrl ?? '').trim() !== '' &&
      !n.data.authToken,
  )
  if (affected.length === 0) return
  const labels = affected.map((n) => n.data.label ?? n.id).join(', ')
  useToastStore
    .getState()
    .pushToast(
      `Auth token cleared on reload for: ${labels}. Re-enter tokens in the Inspector before running.`,
      'warning',
    )
}
