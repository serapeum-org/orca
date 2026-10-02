import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { REPO_ROOT } from './helpers.js'
import { VERSION } from '../src/version.js'

const CLI = join(REPO_ROOT, 'dist', 'cli.js')

/**
 * CLI startup must stay under 100ms for a no-op command. We measure the real compiled binary
 * (`node dist/cli.js --version`, built by the global setup) and take the best of several runs: the
 * minimum reflects the true startup floor without scheduler/GC noise. If this regresses, something
 * heavy (zod, the parser, discovery) has crept into the static import graph of cli.ts.
 */
describe('cli startup', () => {
  it('has a built binary', () => {
    expect(existsSync(CLI)).toBe(true)
  })

  it('prints the version and starts in under 100ms (no-op)', () => {
    const runs = 7
    let min = Infinity
    let lastStdout = ''

    for (let i = 0; i < runs; i++) {
      const start = performance.now()
      lastStdout = execFileSync(process.execPath, [CLI, '--version'], { encoding: 'utf8' })
      const elapsed = performance.now() - start
      if (elapsed < min) min = elapsed
    }

    expect(lastStdout.trim()).toBe(VERSION)
    expect(min).toBeLessThan(100)
  })
})
