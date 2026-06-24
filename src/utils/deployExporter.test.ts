// @vitest-environment node
//
// fflate's internal `instanceof Uint8Array` checks break under the default
// jsdom environment here: Vite loads this externalized dependency in a
// different realm than the jsdom-patched globals, so zipSync/unzipSync
// misclassify their own Uint8Array values as plain objects (each byte comes
// back as its own nested "directory" entry). This file has no DOM
// dependency, so running it under plain node sidesteps the realm mismatch
// entirely.
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { AgentFlowNode } from '../types'
import { generateDeployZip } from './deployExporter'

function node(
  id: string,
  type: AgentFlowNode['type'],
  data: Partial<AgentFlowNode['data']> & { label: string },
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as AgentFlowNode
}

async function unzipEntries(blob: Blob): Promise<Record<string, string>> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const entries = unzipSync(buf)
  return Object.fromEntries(
    Object.entries(entries).map(([name, bytes]) => [name, strFromU8(bytes)]),
  )
}

describe('generateDeployZip', () => {
  it('bundles main.py, requirements, server scaffolding, env example, and blueprint.json', async () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Agent', model: 'gpt-4o-mini' }),
      node('o', 'output', { label: 'Reply' }),
    ]
    const edges = [
      { id: 's->a', source: 's', target: 'a' },
      { id: 'a->o', source: 'a', target: 'o' },
    ]
    const blob = generateDeployZip(nodes, edges, false)
    const entries = await unzipEntries(blob)

    expect(Object.keys(entries).sort()).toEqual(
      [
        '.env.example',
        'Dockerfile',
        'README.md',
        'blueprint.json',
        'docker-compose.yml',
        'main.py',
        'requirements.txt',
        'server.py',
      ].sort(),
    )
    expect(entries['.env.example']).toContain('OPENAI_API_KEY=')
    expect(JSON.parse(entries['blueprint.json'])).toEqual({ nodes, edges })
    expect(entries['main.py']).toContain('builder.compile()')
    // server.py must import a name main.py actually defines.
    expect(entries['server.py']).toContain('from main import graph')
  })

  it('emits a placeholder .env.example when no model needs an API key', async () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Agent', model: 'ollama/llama3' }),
      node('o', 'output', { label: 'Reply' }),
    ]
    const edges = [
      { id: 's->a', source: 's', target: 'a' },
      { id: 'a->o', source: 'a', target: 'o' },
    ]
    const blob = generateDeployZip(nodes, edges, false)
    const entries = await unzipEntries(blob)
    expect(entries['.env.example']).toContain('No API keys required')
  })
})
