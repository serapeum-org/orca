#!/usr/bin/env node
import { Command } from 'commander'

import { VERSION } from './version.js'

// Keep this module's static imports minimal: only commander + the version string. Every subcommand
// lazy-loads its implementation (and heavy deps like zod) inside its action, so a no-op invocation
// such as `ccx --version` stays well under the startup budget.
const program = new Command()

program.name('ccx').description('Archive and search your Claude Code conversations.').version(VERSION)

program
  .command('doctor')
  .description('Report transcript schema coverage — the canary for a Claude Code format change.')
  .option('--json', 'output machine-readable JSON')
  .option('--project <substr>', 'only scan project dirs whose name contains <substr>')
  .option('--projects-dir <path>', 'override the Claude Code projects directory (advanced)')
  .option('--limit <n>', 'scan at most N transcript files', (v) => Number.parseInt(v, 10))
  .action(async (opts: { json?: boolean; project?: string; projectsDir?: string; limit?: number }) => {
    const { runDoctor } = await import('./commands/doctor.js')
    await runDoctor(opts)
  })

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
