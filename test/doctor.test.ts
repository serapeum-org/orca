import { describe, expect, it } from 'vitest'

import { collectDoctorReport } from '../src/commands/doctor.js'
import { FIXTURE_PROJECTS_DIR } from './helpers.js'

describe('collectDoctorReport', () => {
  it('summarises coverage over the fixture tree', async () => {
    const r = await collectDoctorReport({ projectsDir: FIXTURE_PROJECTS_DIR })

    expect(r.projectsScanned).toBe(1)
    expect(r.sessions).toBe(1)
    expect(r.subagents).toBe(1)
    // session (11 entries + 2 failures) + subagent (1 entry) are both scanned.
    expect(r.entriesParsed).toBe(12)
    expect(r.failed).toBe(2)
    expect(r.degraded).toBe(1)
    expect(r.bytesRead).toBeGreaterThan(0)
  })

  it('flags the unmodeled type as degraded and buckets failures', async () => {
    const r = await collectDoctorReport({ projectsDir: FIXTURE_PROJECTS_DIR })

    expect(r.degradedByType.find((d) => d.type === 'brand-new-2099')?.count).toBe(1)

    const unmodeled = r.typeCounts.find((t) => t.type === 'brand-new-2099')
    expect(unmodeled?.modeled).toBe(false)
    expect(r.typeCounts.find((t) => t.type === 'user')?.modeled).toBe(true)

    const buckets = r.failuresByBucket.map((f) => f.bucket)
    expect(buckets).toContain('assistant') // the schema failure, bucketed by its known type
    expect(buckets).toContain('invalid-json')
  })

  it('detects the Claude Code versions present', async () => {
    const r = await collectDoctorReport({ projectsDir: FIXTURE_PROJECTS_DIR })
    const versions = r.versions.map((v) => v.version)
    expect(versions).toContain('2.1.198')
    expect(versions).toContain('2.1.199')
  })
})
