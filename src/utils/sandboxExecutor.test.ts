import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runJavaScriptInSandbox } from './sandboxExecutor'

/**
 * JSDOM has no real iframe runtime, so we mock document.createElement('iframe')
 * to evaluate the embedded user code and post a 'sandbox-result' message back —
 * mirroring what a real sandboxed iframe would do.
 */

let neverFire = false
const realCreate = document.createElement.bind(document)

beforeEach(() => {
  neverFire = false
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'iframe') return realCreate(tag)
    const fake = realCreate('div') as unknown as HTMLIFrameElement
    Object.defineProperty(fake, 'srcdoc', {
      configurable: true,
      set(html: string) {
        if (neverFire) return
        // Extract input + user body from the generated srcdoc and run it.
        const inputMatch = html.match(/const __input__ = (.*?);\n/s)
        const input = inputMatch ? JSON.parse(inputMatch[1]) : null
        const bodyMatch = html.match(/\(function\(\) \{ ([\s\S]*?) \}\)\(\)/)
        const body = bodyMatch ? bodyMatch[1] : ''
        const stdout: string[] = []
        const stderr: string[] = []
        const console = {
          log: (...a: unknown[]) => stdout.push(a.map(String).join(' ')),
          error: (...a: unknown[]) => stderr.push(a.map(String).join(' ')),
          warn: (...a: unknown[]) => stderr.push('[warn] ' + a.map(String).join(' ')),
        }
        let returnValue: unknown
        try {
          returnValue = new Function('console', '__input__', body)(console, input)
        } catch (e) {
          stderr.push((e as Error).message)
        }
        // Dispatch synchronously, mirroring a fast iframe reply. The setter
        // runs during `iframe.srcdoc = …`, before the timeout is armed.
        const event = new MessageEvent('message')
        Object.defineProperty(event, 'data', {
          value: {
            type: 'sandbox-result',
            stdout: stdout.join('\n'),
            stderr: stderr.join('\n'),
            returnValue: JSON.stringify(returnValue),
          },
        })
        window.dispatchEvent(event)
      },
    })
    return fake
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runJavaScriptInSandbox', () => {
  it('returns the function return value', async () => {
    const result = await runJavaScriptInSandbox('return 2 + 2', null)
    expect(result.returnValue).toBe(4)
    expect(result.timedOut).toBe(false)
  })

  it('captures console.log to stdout', async () => {
    const result = await runJavaScriptInSandbox("console.log('hello')", null)
    expect(result.stdout).toBe('hello')
  })

  it('reports a syntax/runtime error in stderr without throwing', async () => {
    const result = await runJavaScriptInSandbox('return nope(', null)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  it('times out when no result message is posted', async () => {
    neverFire = true
    const result = await runJavaScriptInSandbox('return 1', null, 50)
    expect(result.timedOut).toBe(true)
  })
})
