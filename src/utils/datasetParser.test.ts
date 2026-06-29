import { describe, expect, it } from 'vitest'
import {
  parseJsonDataset,
  parseCsvDataset,
  parseDatasetFile,
} from './datasetParser'

describe('parseJsonDataset', () => {
  it('parses valid JSON datasets with default keys', () => {
    const json = JSON.stringify([
      { input: 'What is 2+2?', expectedOutput: '4', description: 'Simple addition' },
      { input: 'What is Capital of France?', expectedOutput: 'Paris' },
    ])
    const result = parseJsonDataset(json)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      input: 'What is 2+2?',
      expectedOutput: '4',
      description: 'Simple addition',
    })
    expect(result[1]).toEqual({
      input: 'What is Capital of France?',
      expectedOutput: 'Paris',
      description: undefined,
    })
  })

  it('supports alternative keys (question/expected_output/expected/output)', () => {
    const json = JSON.stringify([
      { question: 'Who wrote Hamlet?', expected_output: 'Shakespeare' },
      { input: 'Hello', expected: 'World' },
      { input: 'Ping', output: 'Pong' },
    ])
    const result = parseJsonDataset(json)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ input: 'Who wrote Hamlet?', expectedOutput: 'Shakespeare', description: undefined })
    expect(result[1]).toEqual({ input: 'Hello', expectedOutput: 'World', description: undefined })
    expect(result[2]).toEqual({ input: 'Ping', expectedOutput: 'Pong', description: undefined })
  })

  it('filters out cases with empty input or empty expectedOutput', () => {
    const json = JSON.stringify([
      { input: '   ', expectedOutput: '4' },
      { input: 'Hello', expectedOutput: '' },
      { input: 'Valid', expectedOutput: 'Valid' },
    ])
    const result = parseJsonDataset(json)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ input: 'Valid', expectedOutput: 'Valid', description: undefined })
  })

  it('throws an error if input JSON is not an array', () => {
    expect(() => parseJsonDataset('{"a": 1}')).toThrow('JSON dataset must be an array')
  })
})

describe('parseCsvDataset', () => {
  it('parses valid CSV dataset', () => {
    const csv = 'input,expectedOutput,description\nWhat is 2+2?,4,Simple math\nWhat is 3+3?,6,'
    const result = parseCsvDataset(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      input: 'What is 2+2?',
      expectedOutput: '4',
      description: 'Simple math',
    })
    expect(result[1]).toEqual({
      input: 'What is 3+3?',
      expectedOutput: '6',
      description: undefined,
    })
  })

  it('supports expected_output / expected / output header columns', () => {
    const csv1 = 'input,expected_output\nhello,world'
    const csv2 = 'input,expected\nhello,world'
    const csv3 = 'input,output\nhello,world'
    expect(parseCsvDataset(csv1)[0]).toEqual({ input: 'hello', expectedOutput: 'world', description: undefined })
    expect(parseCsvDataset(csv2)[0]).toEqual({ input: 'hello', expectedOutput: 'world', description: undefined })
    expect(parseCsvDataset(csv3)[0]).toEqual({ input: 'hello', expectedOutput: 'world', description: undefined })
  })

  it('handles fields that contain commas wrapped in double quotes', () => {
    const csv = 'input,expectedOutput\n"hello, world","hi, there"\n"escaped ""quotes""","yes"'
    const result = parseCsvDataset(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ input: 'hello, world', expectedOutput: 'hi, there', description: undefined })
    expect(result[1]).toEqual({ input: 'escaped "quotes"', expectedOutput: 'yes', description: undefined })
  })

  it('throws an error if CSV is empty or lacks data rows', () => {
    expect(() => parseCsvDataset('input,expectedOutput')).toThrow(
      'CSV must have a header row and at least one data row',
    )
  })

  it('throws an error if CSV is missing required input column', () => {
    expect(() => parseCsvDataset('expectedOutput,description\n4,Simple math')).toThrow(
      'CSV missing required column: input',
    )
  })

  it('throws an error if CSV is missing required expectedOutput column', () => {
    expect(() => parseCsvDataset('input,description\nhello,Simple math')).toThrow(
      'CSV missing required column: expectedOutput (or expected_output)',
    )
  })
})

describe('parseDatasetFile', () => {
  it('delegates to parseJsonDataset for .json files', () => {
    const json = JSON.stringify([{ input: 'hello', expectedOutput: 'world' }])
    const result = parseDatasetFile(json, 'test.json')
    expect(result).toHaveLength(1)
    expect(result[0].input).toBe('hello')
  })

  it('delegates to parseCsvDataset for .csv files', () => {
    const csv = 'input,expectedOutput\nhello,world'
    const result = parseDatasetFile(csv, 'test.csv')
    expect(result).toHaveLength(1)
    expect(result[0].input).toBe('hello')
  })

  it('throws an error for unsupported file types', () => {
    expect(() => parseDatasetFile('hello', 'test.txt')).toThrow(
      'Unsupported file type: test.txt. Use .json or .csv',
    )
  })
})
