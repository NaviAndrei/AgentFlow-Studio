import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, Blueprint } from '../types'
import { useCanvasStore } from './canvasStore'

/** Inspector resize bounds (px). */
export const INSPECTOR_MIN_WIDTH = 240
export const INSPECTOR_MAX_WIDTH = 480

interface BlueprintState {
  galleryOpen: boolean
  exportOpen: boolean
  quickAddOpen: boolean
  shortcutsOpen: boolean
  /** Left palette / right inspector panel visibility (collapsible on small screens). */
  sidebarOpen: boolean
  inspectorOpen: boolean
  inspectorWidth: number
  setGalleryOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  toggleSidebar: () => void
  toggleInspector: () => void
  setInspectorWidth: (width: number) => void
  closeAllModals: () => void
  loadBlueprint: (blueprint: Blueprint) => void
}

/** Panels start collapsed on narrow viewports (tablet/landscape). */
const widePanelDefault =
  typeof window === 'undefined' || window.innerWidth >= 1024

export const useBlueprintStore = create<BlueprintState>((set, get) => ({
  galleryOpen: false,
  exportOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,
  sidebarOpen: widePanelDefault,
  inspectorOpen: widePanelDefault,
  inspectorWidth: 300,

  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  toggleInspector: () => set({ inspectorOpen: !get().inspectorOpen }),
  setInspectorWidth: (width) =>
    set({
      inspectorWidth: Math.min(
        INSPECTOR_MAX_WIDTH,
        Math.max(INSPECTOR_MIN_WIDTH, width),
      ),
    }),
  closeAllModals: () =>
    set({
      galleryOpen: false,
      exportOpen: false,
      quickAddOpen: false,
      shortcutsOpen: false,
    }),

  loadBlueprint: (blueprint) => {
    const nodes: AgentFlowNode[] = blueprint.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }))
    const edges: Edge[] = blueprint.edges.map((e) => ({
      ...e,
      type: 'agentflow',
      animated: true,
    }))
    useCanvasStore.getState().loadGraph(nodes, edges)
    set({ galleryOpen: false })
  },
}))
