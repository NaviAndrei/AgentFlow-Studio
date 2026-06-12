import { describe, expect, it, vi } from 'vitest'
import {
  CANVAS_SCHEMA_VERSION,
  parseBlueprint,
  parseCanvasDocument,
} from './blueprintSchema'

const validNode = (id: string) => ({
  id,
  type: 'llm',
  position: { x: 10, y: 20 },
  data: { label: `Node ${id}` },
})

const validDoc = () => ({
  schemaVersion: 1,
  nodes: [validNode('a'), validNode('b')],
  edges: [{ id: 'e1', source: 'a', target: 'b' }],
})

// The validators warn on rejection; keep test output clean.
vi.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('parseCanvasDocument', () => {
  it('accepts a valid document and preserves the graph', () => {
    const doc = parseCanvasDocument(validDoc())
    expect(doc).not.toBeNull()
    expect(doc?.nodes).toHaveLength(2)
    expect(doc?.edges).toHaveLength(1)
    expect(doc?.nodes[0].position).toEqual({ x: 10, y: 20 })
  })

  it('treats a missing schemaVersion as v1 (migration no-op)', () => {
    const raw = validDoc() as Record<string, unknown>
    delete raw.schemaVersion
    const doc = parseCanvasDocument(raw)
    expect(doc).not.toBeNull()
    expect(doc?.schemaVersion).toBe(CANVAS_SCHEMA_VERSION)
  })

  it('re-stamps the current schema version on output', () => {
    const doc = parseCanvasDocument(validDoc())
    expect(doc?.schemaVersion).toBe(CANVAS_SCHEMA_VERSION)
  })

  it('rejects documents from a future schema version', () => {
    expect(
      parseCanvasDocument({ ...validDoc(), schemaVersion: CANVAS_SCHEMA_VERSION + 1 }),
    ).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(parseCanvasDocument('nope')).toBeNull()
    expect(parseCanvasDocument(null)).toBeNull()
    expect(parseCanvasDocument(42)).toBeNull()
  })

  it('rejects a node with an unknown type', () => {
    const raw = validDoc()
    raw.nodes[0].type = 'teleporter'
    expect(parseCanvasDocument(raw)).toBeNull()
  })

  it('rejects a node missing a label', () => {
    const raw = validDoc() as { nodes: Array<Record<string, unknown>> }
    raw.nodes[0].data = {}
    expect(parseCanvasDocument(raw)).toBeNull()
  })

  it('rejects non-finite positions', () => {
    const raw = validDoc()
    raw.nodes[0].position = { x: Number.NaN, y: 0 }
    expect(parseCanvasDocument(raw)).toBeNull()
  })

  it('rejects edges referencing missing nodes', () => {
    const raw = validDoc()
    raw.edges.push({ id: 'e2', source: 'a', target: 'ghost' })
    expect(parseCanvasDocument(raw)).toBeNull()
  })

  it('rejects children referencing a missing parent frame', () => {
    const raw = validDoc() as { nodes: Array<Record<string, unknown>> }
    raw.nodes[0].parentId = 'no-such-group'
    expect(parseCanvasDocument(raw)).toBeNull()
  })
})

describe('parseBlueprint', () => {
  const validBlueprint = () => ({
    id: 'bp-1',
    schemaVersion: 1,
    name: 'Test',
    description: 'A test blueprint',
    nodes: [validNode('a')],
    edges: [],
  })

  it('accepts a valid blueprint', () => {
    const bp = parseBlueprint(validBlueprint())
    expect(bp).not.toBeNull()
    expect(bp?.id).toBe('bp-1')
    expect(bp?.nodes).toHaveLength(1)
  })

  it('rejects a blueprint missing id/name/description', () => {
    const raw = validBlueprint() as Record<string, unknown>
    delete raw.description
    expect(parseBlueprint(raw)).toBeNull()
  })

  it('defaults a missing schemaVersion to 1', () => {
    const raw = validBlueprint() as Record<string, unknown>
    delete raw.schemaVersion
    expect(parseBlueprint(raw)?.schemaVersion).toBe(1)
  })
})
