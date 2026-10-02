import { describe, expect, it } from 'vitest'

import { discoverTranscripts } from '../src/discover.js'
import { FIXTURE_PROJECTS_DIR } from './helpers.js'

describe('discoverTranscripts', () => {
  const found = discoverTranscripts({ projectsDir: FIXTURE_PROJECTS_DIR })

  it('finds the top-level session transcript', () => {
    const sessions = found.filter((t) => t.kind === 'session')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.sessionId).toBe('11111111-1111-1111-1111-111111111111')
    expect(sessions[0]?.project).toBe('-fake-project')
    expect(sessions[0]?.sizeBytes).toBeGreaterThan(0)
  })

  it('surfaces subagent transcripts separately, tied to their owning session', () => {
    const subagents = found.filter((t) => t.kind === 'subagent')
    expect(subagents).toHaveLength(1)
    expect(subagents[0]?.sessionId).toBe('11111111-1111-1111-1111-111111111111')
    expect(subagents[0]?.subagentId).toBe('sub-abc')
  })

  it('excludes orphaned and superseded set-aside transcripts', () => {
    const names = found.map((t) => t.path)
    expect(names.some((p) => p.includes('.orphaned-'))).toBe(false)
    expect(names.some((p) => p.includes('.superseded-'))).toBe(false)
  })

  it('returns an empty list for a non-existent projects dir instead of throwing', () => {
    expect(discoverTranscripts({ projectsDir: '/no/such/dir/anywhere' })).toEqual([])
  })

  it('filters by project substring', () => {
    expect(discoverTranscripts({ projectsDir: FIXTURE_PROJECTS_DIR, project: 'nomatch' })).toEqual([])
    expect(discoverTranscripts({ projectsDir: FIXTURE_PROJECTS_DIR, project: 'fake' }).length).toBeGreaterThan(0)
  })
})
