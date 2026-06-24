import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',                          // ← change 1: swap node → jsdom
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],  // ← change 2: add .tsx glob
    setupFiles: ['./src/test-setup.ts'],           // ← change 3: setup file (next step)
    clearMocks: true,
    restoreMocks: true,
  },
})
