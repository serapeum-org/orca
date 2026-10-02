import { defineConfig } from 'tsup'

// The CLI entrypoint is the only bundle. `commander` and `zod` are left external
// (resolved from node_modules at runtime) so the startup bundle stays tiny.
// `splitting` keeps the lazy-loaded command modules in separate chunks, so a
// no-op invocation (`ccx --version`) never pulls in zod or the parser.
export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  splitting: true,
  clean: true,
  dts: false,
  sourcemap: true,
  minify: false,
})
