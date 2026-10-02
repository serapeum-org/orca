import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Builds the dist/ bundle once before the suite so the startup-time test can
    // measure the real compiled binary.
    globalSetup: ['test/global-setup.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
