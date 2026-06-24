import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LLMSettingsModal } from './LLMSettingsModal'
import { useLLMConfigStore } from '../store/llmConfigStore'

beforeEach(() => {
  // Shallow-merge keeps the seeded `settings` record intact.
  useLLMConfigStore.setState({ settingsOpen: false, activeProvider: 'ollama' })
})

describe('LLMSettingsModal', () => {
  it('renders nothing when settingsOpen is false', () => {
    const { container } = render(<LLMSettingsModal />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the dialog when settingsOpen is true', () => {
    useLLMConfigStore.setState({ settingsOpen: true })
    render(<LLMSettingsModal />)
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(screen.getByText('LLM Connection')).not.toBeNull()
  })

  it('writes the API key to the store as it is edited', () => {
    useLLMConfigStore.setState({ settingsOpen: true, activeProvider: 'openai' })
    const { container } = render(<LLMSettingsModal />)
    const apiKeyInput = container.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )
    expect(apiKeyInput).not.toBeNull()
    fireEvent.change(apiKeyInput as HTMLInputElement, {
      target: { value: 'sk-test-123' },
    })
    expect(useLLMConfigStore.getState().settings.openai.apiKey).toBe('sk-test-123')
  })

  it('shows the Base URL field inline for the custom provider only', () => {
    // Cloud provider (openai): Base URL is tucked under Advanced, not inline.
    useLLMConfigStore.setState({ settingsOpen: true, activeProvider: 'openai' })
    const cloud = render(<LLMSettingsModal />)
    expect(cloud.queryByText('Base URL')).toBeNull()
    cloud.unmount()

    // Custom provider: Base URL is shown inline.
    useLLMConfigStore.setState({ activeProvider: 'custom' })
    render(<LLMSettingsModal />)
    expect(screen.getByText('Base URL')).not.toBeNull()
  })

  it('closes via the close button', () => {
    useLLMConfigStore.setState({ settingsOpen: true })
    render(<LLMSettingsModal />)
    fireEvent.click(screen.getByLabelText('Close dialog'))
    expect(useLLMConfigStore.getState().settingsOpen).toBe(false)
  })
})
