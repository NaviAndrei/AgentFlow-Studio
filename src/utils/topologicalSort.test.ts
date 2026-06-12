import { describe, expect, it } from 'vitest'
import { topologicalSort } from './topologicalSort'

describe('topologicalSort', () => {
  it('orders a basic DAG so every edge points forward', () => {
    const ids = ['c', 'a', 'b', 'd']
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'b', target: 'd' },
    ]
    const order = topologicalSort(ids, edges)
    expect(order).toHaveLength(4)
    for (const { source, target } of edges) {
      expect(order.indexOf(source)).toBeLessThan(order.indexOf(target))
    }
  })

  it('includes every node exactly once when the graph has a cycle', () => {
    const ids = ['a', 'b', 'c', 'd']
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'b' }, // cycle b → c → b
      { source: 'c', target: 'd' },
    ]
    const order = topologicalSort(ids, edges)
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(order[0]).toBe('a')
  })

  it('handles a pure cycle with no zero-in-degree entry point', () => {
    const ids = ['a', 'b']
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ]
    const order = topologicalSort(ids, edges)
    expect([...order].sort()).toEqual(['a', 'b'])
  })

  it('keeps disconnected nodes in the result', () => {
    const ids = ['a', 'b', 'island']
    const edges = [{ source: 'a', target: 'b' }]
    const order = topologicalSort(ids, edges)
    expect([...order].sort()).toEqual(['a', 'b', 'island'])
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
  })

  it('ignores edges referencing unknown ids', () => {
    const order = topologicalSort(['a'], [{ source: 'a', target: 'ghost' }])
    expect(order).toEqual(['a'])
  })
})
