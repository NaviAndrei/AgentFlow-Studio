import '@testing-library/react/pure'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Store/walker tests drive the simulation engine's real `window.setTimeout` /
 * `window.requestAnimationFrame` backoffs and stream-flush scheduling
 * end-to-end. Under jsdom these are real, wall-clock timers (unlike the old
 * node-environment `src/test/setup.ts` stub, which fired them synchronously)
 * — too slow for `vi.waitFor`'s default timeout across the dynamic walker's
 * multi-step runs. Restore the same synchronous-fire behavior here so engine
 * tests stay fast regardless of which environment loads this file. Guarded
 * since some files opt out of jsdom via a `// @vitest-environment node`
 * docblock (no `window` global at all in that case).
 */
if (typeof window !== 'undefined') {
  window.setTimeout = ((cb: () => void): number => {
    cb()
    return 0
  }) as typeof window.setTimeout
  window.clearTimeout = (() => undefined) as typeof window.clearTimeout
  window.setInterval = (() => 0) as typeof window.setInterval
  window.clearInterval = (() => undefined) as typeof window.clearInterval
  window.requestAnimationFrame = ((cb: (t: number) => void): number => {
    cb(0)
    return 0
  }) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame
  window.matchMedia = ((query: string) =>
    ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia
}

afterEach(() => {
  cleanup()
})