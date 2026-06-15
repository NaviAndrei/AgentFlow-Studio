import type { EvalTestCase } from '../types'

type RawCase = Pick<EvalTestCase, 'input' | 'expectedOutput'> & { description?: string }

/**
 * Parse a JSON file containing an array of test case objects.
 * Accepts both { input, expectedOutput } and { input, expected_output } key shapes.
 * Returns only rows that have non-empty input AND expectedOutput.
 */
export function parseJsonDataset(text: string): RawCase[] {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw)) throw new Error('JSON dataset must be an array')
  return (raw as Record<string, unknown>[])
    .map((r) => ({
      input: String(r.input ?? r.question ?? ''),
      expectedOutput: String(
        r.expectedOutput ?? r.expected_output ?? r.expected ?? r.output ?? '',
      ),
      description: r.description ? String(r.description) : undefined,
    }))
    .filter((r) => r.input.trim() && r.expectedOutput.trim())
}

/**
 * Parse a CSV file.
 * Required columns: input, expectedOutput (or expected_output).
 * Optional column: description.
 * First row must be the header row.
 * Handles quoted fields containing commas.
 */
export function parseCsvDataset(text: string): RawCase[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase())
  const inputIdx = headers.indexOf('input')
  const expectedIdx = headers.findIndex(
    (h) => h === 'expectedoutput' || h === 'expected_output' || h === 'expected' || h === 'output',
  )
  const descIdx = headers.indexOf('description')

  if (inputIdx === -1) throw new Error('CSV missing required column: input')
  if (expectedIdx === -1)
    throw new Error('CSV missing required column: expectedOutput (or expected_output)')

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseRow(line)
      return {
        input: (cols[inputIdx] ?? '').trim(),
        expectedOutput: (cols[expectedIdx] ?? '').trim(),
        description: descIdx >= 0 ? (cols[descIdx] ?? '').trim() || undefined : undefined,
      }
    })
    .filter((r) => r.input && r.expectedOutput)
}

export function parseDatasetFile(text: string, filename: string): RawCase[] {
  if (filename.endsWith('.json')) return parseJsonDataset(text)
  if (filename.endsWith('.csv')) return parseCsvDataset(text)
  throw new Error(`Unsupported file type: ${filename}. Use .json or .csv`)
}
