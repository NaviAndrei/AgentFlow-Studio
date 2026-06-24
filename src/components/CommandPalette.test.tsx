import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from './CommandPalette'

const clearCanvas = vi.fn()

vi.mock('../store/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      nodes: [{ id: 'n1' }],
      history: [],
      future: [],
      validationIssues: [],
      clearCanvas,
      selectAll: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
    }),
}))

vi.mock('../store/uiStore', () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      commandPaletteOpen: true,
      closeAllModals: vi.fn(),
      setSnapshotOpen: vi.fn(),
      galleryOpen: false,
      setGalleryOpen: vi.fn(),
      setShortcutsOpen: vi.fn(),
      setExportOpen: vi.fn(),
      toggleMinimap: vi.fn(),
      toggleSidebar: vi.fn(),
    }),
}))

vi.mock('../store/simulationStore', () => ({
  useSimulationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isActive: false,
      liveMode: false,
      start: vi.fn(),
      stop: vi.fn(),
    }),
}))

async function openClearCanvasConfirm() {
  const user = userEvent.setup()
  render(<CommandPalette />)
  await user.type(screen.getByPlaceholderText('Type a command…'), 'Clear Canvas')
  await user.click(screen.getByRole('button', { name: 'Clear Canvas' }))
  screen.getByText(/This action cannot be undone/)
  return user
}

describe('CommandPalette — Clear Canvas confirm dialog', () => {
  it('does not call clearCanvas when the dialog is cancelled', async () => {
    const user = await openClearCanvasConfirm()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(clearCanvas).not.toHaveBeenCalled()
  })

  it('calls clearCanvas exactly once when the dialog is confirmed', async () => {
    const user = await openClearCanvasConfirm()

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(clearCanvas).toHaveBeenCalledTimes(1)
  })
})
