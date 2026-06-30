export interface SandboxResult {
  stdout: string
  stderr: string
  returnValue: unknown
  timedOut: boolean
  error?: string
}

/**
 * V1 security model: iframe sandbox="allow-scripts" (no allow-same-origin).
 * Prevents: localStorage, cookie, IndexedDB access, DOM manipulation of parent.
 * Does NOT prevent: CPU consumption (mitigated by 5s kill), memory consumption.
 * V2: Replace with E2B Firecracker microVM for kernel-level isolation.
 */
export async function runJavaScriptInSandbox(
  code: string,
  input: unknown,
  timeoutMs = 5000,
): Promise<SandboxResult> {
  const srcdoc = `<!DOCTYPE html><html><body><script>
  const __input__ = ${JSON.stringify(input ?? null)};
  const __stdout__ = [];
  const __stderr__ = [];
  const console = {
    log: (...args) => __stdout__.push(args.map(String).join(' ')),
    error: (...args) => __stderr__.push(args.map(String).join(' ')),
    warn: (...args) => __stderr__.push('[warn] ' + args.map(String).join(' ')),
  };
  let __returnValue__ = undefined;
  try {
    __returnValue__ = (function() { ${code} })();
  } catch(e) {
    __stderr__.push(e.message);
  }
  parent.postMessage({
    type: 'sandbox-result',
    stdout: __stdout__.join('\\n'),
    stderr: __stderr__.join('\\n'),
    returnValue: JSON.stringify(__returnValue__),
  }, '*');
<\/script></body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts') // NO allow-same-origin
  iframe.style.display = 'none'
  document.body.appendChild(iframe)

  return new Promise<SandboxResult>((resolve) => {
    // eslint-disable-next-line prefer-const -- assigned below before first use, kept `let` for clarity of cleanup ordering
    let timer: ReturnType<typeof setTimeout>
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener('message', handler)
      iframe.remove()
    }

    const handler = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type !== 'sandbox-result') return
      cleanup()
      const data = event.data as {
        stdout: string
        stderr: string
        returnValue: string
      }
      let returnValue: unknown
      try {
        returnValue = JSON.parse(data.returnValue)
      } catch {
        returnValue = undefined
      }
      resolve({ stdout: data.stdout, stderr: data.stderr, returnValue, timedOut: false })
    }

    // Register the listener before srcdoc so a fast iframe can't post its
    // result before we're listening; arm the timeout last so a synchronous
    // reply (browsers never do this, but test stubs can) still wins the race.
    window.addEventListener('message', handler)
    iframe.srcdoc = srcdoc
    timer = setTimeout(() => {
      cleanup()
      resolve({
        stdout: '',
        stderr: 'Execution timed out',
        returnValue: undefined,
        timedOut: true,
      })
    }, timeoutMs)
  })
}

// Pyodide is lazy-loaded from the CDN on first Python execution — never bundled.
// URL kept in a variable so the bundler/tsc treat it as a fully dynamic import
// (a static string literal would fail module resolution at compile time).
const PYODIDE_VERSION = 'v0.27.4'
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`
let pyodideInstance: unknown = null

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Pyodide load timed out')), ms),
  )
}

export async function runPythonInSandbox(
  code: string,
  input: unknown,
  timeoutMs = 10000,
): Promise<SandboxResult> {
  if (!pyodideInstance) {
    try {
      const mod = (await Promise.race([
        import(/* @vite-ignore */ PYODIDE_SCRIPT_URL),
        timeoutReject(timeoutMs),
      ])) as {
        loadPyodide: (opts: { indexURL: string }) => Promise<unknown>
      }
      pyodideInstance = await mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL })
    } catch {
      return {
        stdout: '',
        stderr: 'Pyodide load failed or timed out',
        returnValue: undefined,
        timedOut: false,
        error: 'PYODIDE_LOAD_FAILED',
      }
    }
  }

  const py = pyodideInstance as {
    setStdout: (opts: { batched: (s: string) => void }) => void
    setStderr: (opts: { batched: (s: string) => void }) => void
    globals: { set: (name: string, value: unknown) => void }
    runPythonAsync: (code: string) => Promise<unknown>
  }

  let stdout = ''
  py.setStdout({ batched: (s: string) => (stdout += s + '\n') })
  let stderr = ''
  py.setStderr({ batched: (s: string) => (stderr += s + '\n') })
  py.globals.set('node_input', JSON.stringify(input ?? null))

  try {
    const result = await py.runPythonAsync(code)
    return { stdout, stderr, returnValue: result, timedOut: false }
  } catch (e) {
    return {
      stdout,
      stderr: stderr + '\n' + String(e),
      returnValue: undefined,
      timedOut: false,
      error: String(e),
    }
  }
}
