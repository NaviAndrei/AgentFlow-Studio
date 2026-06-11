import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, Blueprint } from '../types'
import { useCanvasStore } from './canvasStore'

interface BlueprintState {
  galleryOpen: boolean
  exportOpen: boolean
  quickAddOpen: boolean
  shortcutsOpen: boolean
  setGalleryOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  closeAllModals: () => void
  loadBlueprint: (blueprint: Blueprint) => void
}

export const useBlueprintStore = create<BlueprintState>((set) => ({
  galleryOpen: false,
  exportOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,

  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
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
