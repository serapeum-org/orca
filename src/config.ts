import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Resolve the Claude Code config directory.
 *
 * Claude Code honours `CLAUDE_CONFIG_DIR` to relocate its entire state tree, so we must never
 * hardcode `~/.claude`. When the variable is unset (or empty) we fall back to the default.
 */
export function getConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CLAUDE_CONFIG_DIR
  return override !== undefined && override.length > 0 ? override : join(homedir(), '.claude')
}

/** The `projects/` tree that holds one directory per working directory, each with session transcripts. */
export function getProjectsDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(getConfigDir(env), 'projects')
}

/** `history.jsonl` — every prompt ever typed, with timestamp + project path. */
export function getHistoryPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(getConfigDir(env), 'history.jsonl')
}

/**
 * Our own archive store, kept separate from Claude Code's tree (it may be relocated, and it is not ours).
 * Overridable via `CCX_HOME`. Transcripts can contain secrets, so the store is created `0700` and files
 * written into it later must be `0600`.
 */
export function getStoreDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CCX_HOME
  return override !== undefined && override.length > 0 ? override : join(homedir(), '.ccx')
}

/** Restrictive modes for the store. Exported so writers (later milestones) stay consistent. */
export const STORE_DIR_MODE = 0o700
export const STORE_FILE_MODE = 0o600

/** Create the store directory with restrictive permissions. Idempotent. */
export function ensureStoreDir(env: NodeJS.ProcessEnv = process.env): string {
  const dir = getStoreDir(env)
  mkdirSync(dir, { recursive: true, mode: STORE_DIR_MODE })
  return dir
}
