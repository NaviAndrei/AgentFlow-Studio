import { describe, expect, it, vi } from 'vitest'
import { callTool, listTools, validateMcpUrl } from './mcpClient'

describe('validateMcpUrl', () => {
  it('allows a public https URL', () => {
    expect(validateMcpUrl('https://mcp.example.com/rpc')).toBeNull()
  })

  it('allows localhost over http in dev/test builds', () => {
    expect(validateMcpUrl('http://localhost:8000')).toBeNull()
  })

  it('blocks a public http:// URL', () => {
    expect(validateMcpUrl('http://mcp.example.com/rpc')).toMatch(/must use https/)
  })

  it('rejects an unparseable URL', () => {
    expect(validateMcpUrl('not a url')).toMatch(/Invalid MCP server URL/)
  })
})

describe('mcpClient — scheme enforcement', () => {
  it('listTools rejects a non-https, non-local server URL without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(listTools('http://mcp.example.com/rpc')).rejects.toThrow(/must use https/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('callTool rejects a non-https, non-local server URL without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(callTool('http://mcp.example.com/rpc', undefined, 'echo', {})).rejects.toThrow(
      /must use https/,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
