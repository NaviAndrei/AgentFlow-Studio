/**
 * Minimal `window` stand-in for store tests under the node environment.
 * Timers fire immediately so simulated node delays don't slow the suite;
 * the metrics interval is a no-op.
 */
const windowStub = {
  setTimeout: (cb: () => void): number => {
    cb()
    return 0
  },
  clearTimeout: (): void => undefined,
  setInterval: (): number => 0,
  clearInterval: (): void => undefined,
  requestAnimationFrame: (cb: (t: number) => void): number => {
    cb(0)
    return 0
  },
  cancelAnimationFrame: (): void => undefined,
  matchMedia: () => ({ matches: true }),
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
}

Object.assign(globalThis, { window: windowStub })
