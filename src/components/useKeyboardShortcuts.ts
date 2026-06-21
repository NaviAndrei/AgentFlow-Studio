import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { useToastStore } from '../store/toastStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K is the universal command-palette shortcut — it must fire even
      // while focus sits in a text input elsewhere on the page.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        useUIStore.getState().setCommandPaletteOpen(true)
        return
      }
      if (isEditableTarget(event.target)) return
      const canvas = useCanvasStore.getState()
      const ui = useUIStore.getState()

      if (event.key === 'Escape') {
        if (
          ui.galleryOpen ||
          ui.exportOpen ||
          ui.quickAddOpen ||
          ui.shortcutsOpen
        ) {
          ui.closeAllModals()
        } else {
          canvas.deselectAll()
        }
        return
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase()
        if (key === 'z') {
          event.preventDefault()
          if (useSimulationStore.getState().isRunning) return
          const label = event.shiftKey ? canvas.redo() : canvas.undo()
          if (label) {
            useToastStore
              .getState()
              .pushToast(`${event.shiftKey ? 'Redone' : 'Undone'}: ${label}`)
          }
        } else if (key === 'y') {
          event.preventDefault()
          if (useSimulationStore.getState().isRunning) return
          const label = canvas.redo()
          if (label) useToastStore.getState().pushToast(`Redone: ${label}`)
        } else if (key === 'd') {
          event.preventDefault()
          canvas.duplicateSelected()
        } else if (key === 'a') {
          event.preventDefault()
          canvas.selectAll()
        } else if (key === 'e') {
          event.preventDefault()
          const hasErrors = canvas.validationIssues.some(
            (i) => i.level === 'error',
          )
          const live = useSimulationStore.getState().liveMode
          if (!hasErrors && !live) ui.setExportOpen(true)
        } else if (key === 'r') {
          // Prevent the browser page-reload shortcut regardless of state.
          event.preventDefault()
          const sim = useSimulationStore.getState()
          if (sim.isActive) {
            sim.stop()
          } else if (canvas.nodes.length > 0) {
            sim.start()
          }
        } else if (key === 'l') {
          event.preventDefault()
          if (useSimulationStore.getState().isRunning) return
          canvas.applyAutoLayout('TB')
        } else if (key === 's' && event.shiftKey) {
          event.preventDefault()
          ui.setSnapshotOpen(true)
        }
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        canvas.deleteSelected()
      } else if (event.key === '/') {
        event.preventDefault()
        ui.setQuickAddOpen(true)
      } else if (event.key === '?') {
        event.preventDefault()
        ui.setShortcutsOpen(true)
      } else if (event.key.toLowerCase() === 'g') {
        event.preventDefault()
        ui.setGalleryOpen(!ui.galleryOpen)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
