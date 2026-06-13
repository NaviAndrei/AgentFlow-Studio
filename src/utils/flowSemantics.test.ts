import { describe, expect, it } from 'vitest'
import {
  evaluateConditionBranches,
  evaluateKeywordGuardrail,
  joinReadiness,
  mergeJoinInputs,
  pickRouteByKeyword,
} from './flowSemantics'

describe('evaluateConditionBranches', () => {
  it('takes the first branch whose text appears in the content', () => {
    expect(
      evaluateConditionBranches(['retry', 'approve'], 'please retry this', false),
    ).toEqual({ taken: 'retry', matched: true })
  })

  it('falls through to the else (last) branch when nothing matches', () => {
    expect(
      evaluateConditionBranches(['retry', 'approve'], 'all good here', false),
    ).toEqual({ taken: 'approve', matched: false })
  })

  it('never matches the last branch as a predicate (it is the else)', () => {
    // "approve" appears in content but it is the else branch, so a non-last
    // predicate must win or fall through — here nothing else matches.
    expect(
      evaluateConditionBranches(['retry', 'approve'], 'approve it', false),
    ).toEqual({ taken: 'approve', matched: false })
  })

  it('forces the else branch regardless of content when forceElse is set', () => {
    expect(
      evaluateConditionBranches(['retry', 'approve'], 'retry retry', true),
    ).toEqual({ taken: 'approve', matched: false })
  })

  it('is case-insensitive', () => {
    expect(
      evaluateConditionBranches(['Retry', 'Approve'], 'RETRY now', false).taken,
    ).toBe('Retry')
  })
})

describe('pickRouteByKeyword', () => {
  it('matches the first route whose name appears in the text', () => {
    expect(pickRouteByKeyword(['billing', 'tech'], 'my billing is broken')).toEqual({
      taken: 'billing',
      matchedOn: 'billing',
    })
  })

  it('is case-insensitive', () => {
    expect(pickRouteByKeyword(['Billing', 'Tech'], 'a TECH problem')).toEqual({
      taken: 'Tech',
      matchedOn: 'Tech',
    })
  })

  it('falls back to the first route when nothing matches', () => {
    expect(pickRouteByKeyword(['billing', 'tech'], 'hello there')).toEqual({
      taken: 'billing',
      matchedOn: null,
    })
  })

  it('ignores blank route entries', () => {
    expect(pickRouteByKeyword([' ', 'tech', ''], 'a tech issue').taken).toBe('tech')
  })

  it('returns a usable default when there are no routes', () => {
    expect(pickRouteByKeyword([], 'anything')).toEqual({
      taken: 'default',
      matchedOn: null,
    })
  })
})

describe('evaluateKeywordGuardrail', () => {
  it('passes when content contains a criterion keyword', () => {
    expect(evaluateKeywordGuardrail('refund, invoice', 'here is your invoice')).toEqual(
      { taken: 'pass', matched: 'invoice' },
    )
  })

  it('fails when no criterion keyword is present', () => {
    expect(evaluateKeywordGuardrail('refund, invoice', 'unrelated text')).toEqual({
      taken: 'fail',
      matched: null,
    })
  })

  it('splits criteria on commas and newlines', () => {
    expect(evaluateKeywordGuardrail('alpha\nbeta', 'contains beta').taken).toBe('pass')
  })

  it('passes vacuously when criteria are empty', () => {
    expect(evaluateKeywordGuardrail('   ', 'whatever')).toEqual({
      taken: 'pass',
      matched: null,
    })
  })
})

describe('joinReadiness', () => {
  it('is ready when all sources executed', () => {
    expect(joinReadiness(['a', 'b'], new Set(['a', 'b']), new Set())).toBe(true)
  })

  it('counts a skip-marked source as satisfied', () => {
    expect(joinReadiness(['a', 'b'], new Set(['a']), new Set(['b']))).toBe(true)
  })

  it('is not ready while a source is still pending', () => {
    expect(joinReadiness(['a', 'b'], new Set(['a']), new Set())).toBe(false)
  })

  it('is trivially ready with no sources', () => {
    expect(joinReadiness([], new Set(), new Set())).toBe(true)
  })
})

describe('mergeJoinInputs', () => {
  const inputs = [
    { source: 'a', output: { v: 1 } },
    { source: 'b', output: { v: 2 } },
  ]

  it('concat collects every branch output in order', () => {
    expect(mergeJoinInputs(inputs, 'concat')).toEqual({
      merged: [{ v: 1 }, { v: 2 }],
      strategy: 'concat',
      waited_for: 2,
    })
  })

  it('last keeps only the final branch output', () => {
    expect(mergeJoinInputs(inputs, 'last')).toEqual({
      merged: { v: 2 },
      strategy: 'last',
      waited_for: 2,
    })
  })
})
