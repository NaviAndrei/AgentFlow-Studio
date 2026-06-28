import { create } from 'zustand'
import type {
  AgentFlowEdge,
  AgentFlowNode,
  Blueprint,
  PermissionAction,
  WorkspaceRole,
} from '../types'
import { ROLE_PERMISSIONS } from '../types'
import { useCanvasStore } from './canvasStore'
import { useEvalStore } from './evalStore'
import { usePromptStore } from './promptStore'
import { useRunHistoryStore } from './runHistoryStore'

/** Inspector resize bounds (px). */
export const INSPECTOR_MIN_WIDTH = 240
export const INSPECTOR_MAX_WIDTH = 480

interface UIState {
  galleryOpen: boolean
  exportOpen: boolean
  quickAddOpen: boolean
  shortcutsOpen: boolean
  snapshotOpen: boolean
  commandPaletteOpen: boolean
  /** Left palette / right inspector panel visibility (collapsible on small screens). */
  sidebarOpen: boolean
  inspectorOpen: boolean
  inspectorWidth: number
  costPanelOpen: boolean
  problemsPanelOpen: boolean
  mcpPanelOpen: boolean
  /** Vertical drag offset (px) for the PanelRail, relative to its centered default. */
  railOffsetPx: number
  /** Blueprint landing overlay dismissed for the current empty-canvas session (Esc / Start blank). */
  landingDismissed: boolean
  /** Canvas minimap visibility toggle (Zustand-only — not persisted to storage). */
  minimapVisible: boolean
  /** Global CSS marching-dashes effect on edges, independent of simulation. */
  animatedEdgesEnabled: boolean
  /** F14 — Natural-language flow builder modal visibility. */
  nlBuilderOpen: boolean
  /** F16 — current demo-mode workspace role + flag. */
  currentRole: WorkspaceRole
  isDemoMode: boolean
  setRole: (role: WorkspaceRole) => void
  checkPermission: (action: PermissionAction) => boolean
  setNlBuilderOpen: (open: boolean) => void
  setGalleryOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setSnapshotOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setCostPanelOpen: (open: boolean) => void
  setProblemsPanelOpen: (open: boolean) => void
  toggleMcpPanel(): void
  setLandingDismissed: (dismissed: boolean) => void
  toggleMinimap: () => void
  toggleAnimatedEdges: () => void
  setRailOffsetPx: (offset: number) => void
  toggleSidebar: () => void
  toggleInspector: () => void
  setInspectorWidth: (width: number) => void
  closeAllModals: () => void
  loadBlueprint: (blueprint: Blueprint) => void
}

/** Panels start collapsed on narrow viewports (tablet/landscape). */
const widePanelDefault =
  typeof window === 'undefined' || window.innerWidth >= 1024

const ROLE_STORAGE_KEY = 'workspace-role'
const VALID_ROLES: WorkspaceRole[] = ['viewer', 'editor', 'deployer', 'admin']

/** Hydrate the persisted role (demo-mode RBAC); defaults to 'admin'. */
function loadRole(): WorkspaceRole {
  if (typeof window === 'undefined') return 'admin'
  try {
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY)
    if (stored && (VALID_ROLES as string[]).includes(stored))
      return stored as WorkspaceRole
  } catch {
    // localStorage unavailable (private mode) — fall through to default.
  }
  return 'admin'
}

export const useUIStore = create<UIState>((set, get) => ({
  galleryOpen: false,
  exportOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,
  snapshotOpen: false,
  commandPaletteOpen: false,
  sidebarOpen: widePanelDefault,
  inspectorOpen: widePanelDefault,
  inspectorWidth: 300,
  costPanelOpen: false,
  problemsPanelOpen: false,
  mcpPanelOpen: false,
  railOffsetPx: 0,
  landingDismissed: false,
  minimapVisible: true,
  animatedEdgesEnabled: false,
  nlBuilderOpen: false,
  currentRole: loadRole(),
  isDemoMode: true,

  setRole: (currentRole) => {
    set({ currentRole })
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, currentRole)
    } catch {
      // Ignore persistence failures (private mode / disabled storage).
    }
  },
  checkPermission: (action) => {
    const { currentRole, isDemoMode } = get()
    return (
      ROLE_PERMISSIONS[currentRole].includes(action) ||
      (action === 'switchRole' && isDemoMode)
    )
  },
  setNlBuilderOpen: (nlBuilderOpen) => set({ nlBuilderOpen }),

  setRailOffsetPx: (railOffsetPx) => set({ railOffsetPx }),
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSnapshotOpen: (snapshotOpen) => set({ snapshotOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setCostPanelOpen: (costPanelOpen) => set({ costPanelOpen }),
  setProblemsPanelOpen: (problemsPanelOpen) => set({ problemsPanelOpen }),
  toggleMcpPanel: () => set((s) => ({ mcpPanelOpen: !s.mcpPanelOpen })),
  setLandingDismissed: (landingDismissed) => set({ landingDismissed }),
  toggleMinimap: () => set({ minimapVisible: !get().minimapVisible }),
  toggleAnimatedEdges: () => set({ animatedEdgesEnabled: !get().animatedEdgesEnabled }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  toggleInspector: () => set({ inspectorOpen: !get().inspectorOpen }),
  setInspectorWidth: (width) =>
    set({
      inspectorWidth: Math.min(
        INSPECTOR_MAX_WIDTH,
        Math.max(INSPECTOR_MIN_WIDTH, width),
      ),
    }),
  closeAllModals: () => {
    set({
      galleryOpen: false,
      exportOpen: false,
      quickAddOpen: false,
      shortcutsOpen: false,
      snapshotOpen: false,
      commandPaletteOpen: false,
      costPanelOpen: false,
      problemsPanelOpen: false,
    })
    useEvalStore.getState().setEvalOpen(false)
    usePromptStore.getState().setRegistryOpen(false)
    useRunHistoryStore.getState().setPanelOpen(false)
  },

  loadBlueprint: (blueprint) => {
    const nodes: AgentFlowNode[] = blueprint.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }))
    const edges: AgentFlowEdge[] = blueprint.edges.map((e) => ({
      ...e,
      type: 'agentflow',
      animated: true,
    }))
    useCanvasStore.getState().loadGraph(nodes, edges)
    set({ galleryOpen: false })
  },
}))
