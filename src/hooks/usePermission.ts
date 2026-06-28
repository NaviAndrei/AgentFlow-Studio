import { useUIStore } from '../store/uiStore'
import type { PermissionAction } from '../types'

/**
 * Selector hook for demo-mode RBAC. Re-renders the caller when the active role
 * changes. No internal state, no side effects.
 */
export function usePermission(action: PermissionAction): boolean {
  return useUIStore((state) => state.checkPermission(action))
}
