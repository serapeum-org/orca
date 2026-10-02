import { createReadStream, statSync } from 'node:fs'

import { KnownEntrySchema, UnknownEntrySchema, KNOWN_TYPES, type Entry } from './schema.js'
import type { Forest, ParseFailure, ParseResult, ParsedEntry, RawLine, TreeNode } from './types.js'

const NEWLINE = 0x0a
const CARRIAGE_RETURN = 0x0d

/**
 * Stream a file line by line without ever holding the whole file in memory. Yields each line's raw
 * text, its 1-based line number, and the byte offset of its first byte within the file. Handles both
 * `\n` and `\r\n` endings and a trailing line without a newline.
 */
export async function* readLines(path: string): AsyncGenerator<RawLine> {
  const stream = createReadStream(path)
  let leftover: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  let lineStart = 0 // file byte offset of leftover[0]
  let lineNumber = 0

  for await (const chunk of stream) {
    const buf = chunk as Buffer<ArrayBufferLike>
    const data: Buffer<ArrayBufferLike> = leftover.length > 0 ? Buffer.concat([leftover, buf]) : buf
    let searchStart = 0
    let nl = data.indexOf(NEWLINE, searchStart)
    while (nl !== -1) {
      const lineBuf = data.subarray(searchStart, nl)
      const end = lineBuf.length > 0 && lineBuf[lineBuf.length - 1] === CARRIAGE_RETURN ? lineBuf.length - 1 : lineBuf.length
      lineNumber++
      yield { raw: lineBuf.subarray(0, end).toString('utf8'), byteOffset: lineStart + searchStart, lineNumber }
      searchStart = nl + 1
      nl = data.indexOf(NEWLINE, searchStart)
    }
    lineStart += searchStart
    leftover = data.subarray(searchStart)
  }

  if (leftover.length > 0) {
    const end = leftover[leftover.length - 1] === CARRIAGE_RETURN ? leftover.length - 1 : leftover.length
    lineNumber++
    yield { raw: leftover.subarray(0, end).toString('utf8'), byteOffset: lineStart, lineNumber }
  }
}

type LineOutcome = { ok: true; parsed: ParsedEntry } | { ok: false; failure: ParseFailure }

function formatZodMessage(issues: ReadonlyArray<{ path: Array<string | number>; message: string }>): string {
  return issues
    .slice(0, 5)
    .map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}

/**
 * Parse a single line. Never throws. Three outcomes:
 * - valid known entry,
 * - a new/unmodeled `type` that degrades to the catch-all (reported as `unknownType`),
 * - a failure (bad JSON, non-object, or a *known* type that violated its schema — the canary).
 */
export function parseLine(raw: string, lineNumber: number, byteOffset: number): LineOutcome {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (err) {
    return {
      ok: false,
      failure: { raw, lineNumber, byteOffset, reason: 'invalid-json', message: (err as Error).message },
    }
  }

  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    const got = Array.isArray(json) ? 'array' : json === null ? 'null' : typeof json
    return { ok: false, failure: { raw, lineNumber, byteOffset, reason: 'not-an-object', message: `expected object, got ${got}` } }
  }

  const typeVal = (json as Record<string, unknown>).type

  const known = KnownEntrySchema.safeParse(json)
  if (known.success) {
    return { ok: true, parsed: { entry: known.data, raw, byteOffset, lineNumber, unknownType: false } }
  }

  // A known type that failed validation is a real format change — report it, do not mask it.
  if (typeof typeVal === 'string' && KNOWN_TYPES.has(typeVal)) {
    return {
      ok: false,
      failure: { raw, lineNumber, byteOffset, reason: 'schema', type: typeVal, message: formatZodMessage(known.error.issues) },
    }
  }

  // An unrecognised type degrades to the catch-all so we keep the data and report it as unmodeled.
  const unknown = UnknownEntrySchema.safeParse(json)
  if (unknown.success) {
    return { ok: true, parsed: { entry: unknown.data, raw, byteOffset, lineNumber, unknownType: true } }
  }

  return {
    ok: false,
    failure: {
      raw,
      lineNumber,
      byteOffset,
      reason: 'schema',
      ...(typeof typeVal === 'string' ? { type: typeVal } : {}),
      message: formatZodMessage(unknown.error.issues),
    },
  }
}

/** Parse an entire transcript file, streaming. Blank lines are skipped (neither parsed nor failed). */
export async function parseFile(path: string): Promise<ParseResult> {
  const entries: ParsedEntry[] = []
  const failures: ParseFailure[] = []

  for await (const line of readLines(path)) {
    if (line.raw.trim().length === 0) continue
    const outcome = parseLine(line.raw, line.lineNumber, line.byteOffset)
    if (outcome.ok) entries.push(outcome.parsed)
    else failures.push(outcome.failure)
  }

  return { entries, failures, bytesRead: statSync(path).size }
}

function field(entry: Entry, key: string): unknown {
  return (entry as Record<string, unknown>)[key]
}

/**
 * Build the conversation forest from parsed entries. Only conversational entries carry `uuid`/`parentUuid`;
 * sidecar singletons have none and are collected in `nonTree`. The tree is preserved, not flattened.
 */
export function buildForest(entries: ParsedEntry[]): Forest {
  const byUuid = new Map<string, TreeNode>()
  const nonTree: ParsedEntry[] = []

  for (const parsed of entries) {
    const uuid = field(parsed.entry, 'uuid')
    if (typeof uuid !== 'string') {
      nonTree.push(parsed)
      continue
    }
    const parentRaw = field(parsed.entry, 'parentUuid')
    const parentUuid = typeof parentRaw === 'string' ? parentRaw : null
    byUuid.set(uuid, { entry: parsed, uuid, parentUuid, children: [] })
  }

  const roots: TreeNode[] = []
  for (const node of byUuid.values()) {
    const parent = node.parentUuid !== null ? byUuid.get(node.parentUuid) : undefined
    if (parent !== undefined) parent.children.push(node)
    else roots.push(node)
  }

  return { roots, byUuid, nonTree }
}
