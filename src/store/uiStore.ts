import { create } from 'zustand'
import type { AgentFlowEdge, AgentFlowNode, Blueprint } from '../types'
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
  /** Left palette / right inspector panel visibility (collapsible on small screens). */
  sidebarOpen: boolean
  inspectorOpen: boolean
  inspectorWidth: number
  costPanelOpen: boolean
  problemsPanelOpen: boolean
  /** Vertical drag offset (px) for the PanelRail, relative to its centered default. */
  railOffsetPx: number
  setGalleryOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setCostPanelOpen: (open: boolean) => void
  setProblemsPanelOpen: (open: boolean) => void
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

export const useUIStore = create<UIState>((set, get) => ({
  galleryOpen: false,
  exportOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,
  sidebarOpen: widePanelDefault,
  inspectorOpen: widePanelDefault,
  inspectorWidth: 300,
  costPanelOpen: false,
  problemsPanelOpen: false,
  railOffsetPx: 0,

  setRailOffsetPx: (railOffsetPx) => set({ railOffsetPx }),
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setCostPanelOpen: (costPanelOpen) => set({ costPanelOpen }),
  setProblemsPanelOpen: (problemsPanelOpen) => set({ problemsPanelOpen }),
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
