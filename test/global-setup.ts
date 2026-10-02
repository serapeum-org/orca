import { build } from 'tsup'

/**
 * Build the dist/ bundle once before the suite so `startup.test.ts` can measure the real compiled
 * binary (`node dist/cli.js`) rather than a tsx/esbuild cold start.
 */
export async function setup(): Promise<void> {
  await build({
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    outDir: 'dist',
    splitting: true,
    clean: true,
    dts: false,
    sourcemap: false,
    silent: true,
  })
}
