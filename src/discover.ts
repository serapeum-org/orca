import { readdirSync, statSync, type Dirent } from 'node:fs'
import { basename, join } from 'node:path'

import { getProjectsDir } from './config.js'
import type { TranscriptFile } from './parse/types.js'

/**
 * Set-aside transcripts that must be excluded from indexing: `<session>.orphaned-*` and
 * `*.jsonl.superseded-*`. These never end in `.jsonl`, but we also match the marker explicitly.
 */
const EXCLUDE = /\.orphaned-|\.superseded-/

export interface DiscoverOptions {
  /** Override the projects directory. Used by tests to avoid touching the real `~/.claude`. */
  projectsDir?: string
  /** Only include projects whose encoded directory name contains this substring. */
  project?: string
}

function isSessionTranscript(name: string): boolean {
  return name.endsWith('.jsonl') && !EXCLUDE.test(name)
}

/** Read a directory's entries, returning [] if it does not exist or cannot be read. */
function listDir(path: string): Dirent[] {
  try {
    return readdirSync(path, { withFileTypes: true })
  } catch {
    return []
  }
}

function toTranscript(path: string, kind: TranscriptFile['kind'], project: string, sessionId: string, subagentId?: string): TranscriptFile {
  const stat = statSync(path)
  return {
    path,
    kind,
    project,
    sessionId,
    ...(subagentId !== undefined ? { subagentId } : {}),
    sizeBytes: stat.size,
    mtimeMs: stat.mtimeMs,
  }
}

/**
 * Walk the projects tree and return every transcript file. Top-level `<project>/<session>.jsonl` files
 * are `session` transcripts; files under `<project>/<session>/subagents/*.jsonl` are `subagent` transcripts.
 * Orphaned/superseded set-asides are excluded.
 */
export function discoverTranscripts(options: DiscoverOptions = {}): TranscriptFile[] {
  const projectsDir = options.projectsDir ?? getProjectsDir()
  const out: TranscriptFile[] = []

  for (const projectDir of listDir(projectsDir)) {
    if (!projectDir.isDirectory()) continue
    const project = projectDir.name
    if (options.project !== undefined && !project.includes(options.project)) continue
    const projectPath = join(projectsDir, project)

    for (const entry of listDir(projectPath)) {
      if (entry.isFile() && isSessionTranscript(entry.name)) {
        const path = join(projectPath, entry.name)
        out.push(toTranscript(path, 'session', project, basename(entry.name, '.jsonl')))
      } else if (entry.isDirectory()) {
        // A session's companion directory: look for subagent transcripts inside it.
        const subagentsDir = join(projectPath, entry.name, 'subagents')
        for (const sub of listDir(subagentsDir)) {
          if (sub.isFile() && isSessionTranscript(sub.name)) {
            const path = join(subagentsDir, sub.name)
            out.push(toTranscript(path, 'subagent', project, entry.name, basename(sub.name, '.jsonl')))
          }
        }
      }
    }
  }

  return out
}
