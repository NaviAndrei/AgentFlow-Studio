import type { EvalDataset, EvalRow } from '../types'

export function scoreExactMatch(expected: string, actual: string): number {
  return expected.trim().toLowerCase() === actual.trim().toLowerCase() ? 1 : 0
}

/** Parses a CSV with `input` and `expected_output` (or `expectedOutput`) columns into a dataset. */
export function parseCSVToDataset(csv: string, name: string): EvalDataset {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 1) throw new Error('CSV must have "input" and "expected_output" columns')

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const inputIdx = headers.indexOf('input')
  const expectedIdx = headers.findIndex((h) => h === 'expected_output' || h === 'expectedoutput')
  if (inputIdx === -1 || expectedIdx === -1) {
    throw new Error('CSV must have "input" and "expected_output" columns')
  }

  const rows: EvalRow[] = lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    return {
      id: crypto.randomUUID(),
      input: cols[inputIdx] ?? '',
      expectedOutput: cols[expectedIdx] ?? '',
      scoreMethod: 'pending',
    }
  })

  return { id: crypto.randomUUID(), name, rows, createdAt: Date.now() }
}
