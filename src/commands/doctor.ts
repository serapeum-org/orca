import { discoverTranscripts } from '../discover.js'
import { parseFile } from '../parse/parse.js'
import { KNOWN_TYPES, type Entry } from '../parse/schema.js'

export interface DoctorOptions {
  json?: boolean
  projectsDir?: string
  project?: string
  limit?: number
}

export interface DoctorReport {
  projectsScanned: number
  sessions: number
  subagents: number
  filesScanned: number
  bytesRead: number
  totalLines: number
  entriesParsed: number
  degraded: number
  failed: number
  /** Percentage of non-blank lines that failed to parse. */
  failurePct: number
  /** Count of parsed entries per `type`, with whether we model it. */
  typeCounts: Array<{ type: string; count: number; modeled: boolean }>
  /** Count of degraded (unmodeled-type) entries per `type`. */
  degradedByType: Array<{ type: string; count: number }>
  /** Count of failures per bucket (`type` for schema failures, else the reason). */
  failuresByBucket: Array<{ bucket: string; count: number }>
  /** Detected Claude Code versions, descending by count. */
  versions: Array<{ version: string; count: number }>
}

function field(entry: Entry, key: string): unknown {
  return (entry as Record<string, unknown>)[key]
}

function sortedEntries(map: Map<string, number>): Array<[string, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

/** Scan transcripts and aggregate a schema-coverage report. Memory stays bounded: one file at a time. */
export async function collectDoctorReport(options: DoctorOptions = {}): Promise<DoctorReport> {
  const discovered = discoverTranscripts({
    ...(options.projectsDir !== undefined ? { projectsDir: options.projectsDir } : {}),
    ...(options.project !== undefined ? { project: options.project } : {}),
  })

  const sessions = discovered.filter((t) => t.kind === 'session')
  const subagents = discovered.filter((t) => t.kind === 'subagent')
  const files = options.limit !== undefined ? discovered.slice(0, options.limit) : discovered

  const typeCounts = new Map<string, number>()
  const degradedByType = new Map<string, number>()
  const failuresByBucket = new Map<string, number>()
  const versions = new Map<string, number>()
  const projects = new Set<string>()

  let bytesRead = 0
  let entriesParsed = 0
  let degraded = 0
  let failed = 0

  for (const file of files) {
    projects.add(file.project)
    const result = await parseFile(file.path)
    bytesRead += result.bytesRead

    for (const parsed of result.entries) {
      entriesParsed++
      const typeVal = field(parsed.entry, 'type')
      const type = typeof typeVal === 'string' ? typeVal : '<no-type>'
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
      if (parsed.unknownType) {
        degraded++
        degradedByType.set(type, (degradedByType.get(type) ?? 0) + 1)
      }
      const versionVal = field(parsed.entry, 'version')
      if (typeof versionVal === 'string') versions.set(versionVal, (versions.get(versionVal) ?? 0) + 1)
    }

    for (const failure of result.failures) {
      failed++
      const bucket = failure.type ?? failure.reason
      failuresByBucket.set(bucket, (failuresByBucket.get(bucket) ?? 0) + 1)
    }
  }

  const totalLines = entriesParsed + failed

  return {
    projectsScanned: projects.size,
    sessions: sessions.length,
    subagents: subagents.length,
    filesScanned: files.length,
    bytesRead,
    totalLines,
    entriesParsed,
    degraded,
    failed,
    failurePct: totalLines > 0 ? (failed / totalLines) * 100 : 0,
    typeCounts: sortedEntries(typeCounts).map(([type, count]) => ({ type, count, modeled: KNOWN_TYPES.has(type) })),
    degradedByType: sortedEntries(degradedByType).map(([type, count]) => ({ type, count })),
    failuresByBucket: sortedEntries(failuresByBucket).map(([bucket, count]) => ({ bucket, count })),
    versions: sortedEntries(versions).map(([version, count]) => ({ version, count })),
  }
}

// --- human-readable rendering ----------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

function renderHuman(r: DoctorReport): string {
  const lines: string[] = []
  const h = (s: string): string => `\n\x1b[1m${s}\x1b[0m`

  lines.push(h('ccx doctor — transcript schema coverage'))
  lines.push(`  projects scanned   ${fmt(r.projectsScanned)}`)
  lines.push(`  sessions           ${fmt(r.sessions)}   (+ ${fmt(r.subagents)} subagent transcripts)`)
  lines.push(`  files parsed       ${fmt(r.filesScanned)}   (${bytes(r.bytesRead)})`)
  lines.push(`  lines parsed       ${fmt(r.totalLines)}`)
  lines.push(`    ok               ${fmt(r.entriesParsed - r.degraded)}`)
  lines.push(`    degraded         ${fmt(r.degraded)}   (valid JSON, unmodeled type)`)
  const pct = r.failurePct
  const pctStr = pct === 0 ? '0%' : pct < 0.01 ? '<0.01%' : `${pct.toFixed(2)}%`
  const flag = pct > 0 ? ' \x1b[33m⚠\x1b[0m' : ''
  lines.push(`    failed           ${fmt(r.failed)}   (${pctStr} of lines)${flag}`)

  lines.push(h('entry types'))
  for (const { type, count, modeled } of r.typeCounts) {
    const mark = modeled ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠ unmodeled\x1b[0m'
    lines.push(`  ${mark} ${type.padEnd(22)} ${fmt(count).padStart(10)}`)
  }

  if (r.degradedByType.length > 0) {
    lines.push(h('⚠ unmodeled types (new since this build of ccx — update the schema)'))
    for (const { type, count } of r.degradedByType) lines.push(`  ${type.padEnd(24)} ${fmt(count).padStart(10)}`)
  }

  if (r.failuresByBucket.length > 0) {
    lines.push(h('failures by bucket'))
    for (const { bucket, count } of r.failuresByBucket) lines.push(`  ${bucket.padEnd(24)} ${fmt(count).padStart(10)}`)
  } else {
    lines.push(h('failures'))
    lines.push('  none')
  }

  lines.push(h(`Claude Code versions detected (${r.versions.length})`))
  for (const { version, count } of r.versions.slice(0, 12)) lines.push(`  ${version.padEnd(16)} ${fmt(count).padStart(10)}`)
  if (r.versions.length > 12) lines.push(`  … and ${r.versions.length - 12} more`)

  return lines.join('\n') + '\n'
}

export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const report = await collectDoctorReport(options)
  if (options.json === true) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stdout.write(renderHuman(report))
  }
}
