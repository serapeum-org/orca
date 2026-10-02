import { describe, expect, it } from 'vitest'

import { buildForest, parseFile, parseLine, readLines } from '../src/parse/parse.js'
import { MAIN_TRANSCRIPT } from './helpers.js'

describe('readLines', () => {
  it('yields byte offsets that point at the start of each line', async () => {
    const lines: Array<{ raw: string; byteOffset: number; lineNumber: number }> = []
    for await (const line of readLines(MAIN_TRANSCRIPT)) lines.push(line)

    expect(lines.length).toBeGreaterThan(0)
    // offsets strictly increase
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]!.byteOffset).toBeGreaterThan(lines[i - 1]!.byteOffset)
    }
    // first line starts at 0 and line numbers are 1-based and contiguous
    expect(lines[0]!.byteOffset).toBe(0)
    expect(lines[0]!.lineNumber).toBe(1)
  })
})

describe('parseFile (defensive parsing)', () => {
  it('parses every valid line, degrades unknown types, and reports failures without throwing', async () => {
    const result = await parseFile(MAIN_TRANSCRIPT)

    // 11 valid entries (incl. 1 unknown-type that degrades), 2 failures (bad JSON + schema violation).
    expect(result.entries).toHaveLength(11)
    expect(result.failures).toHaveLength(2)
    expect(result.bytesRead).toBeGreaterThan(0)

    const degraded = result.entries.filter((e) => e.unknownType)
    expect(degraded).toHaveLength(1)
    expect((degraded[0]!.entry as Record<string, unknown>).type).toBe('brand-new-2099')
  })

  it('classifies the two failures: invalid JSON and a known type that violated its schema', async () => {
    const { failures } = await parseFile(MAIN_TRANSCRIPT)
    const reasons = failures.map((f) => f.reason).sort()
    expect(reasons).toEqual(['invalid-json', 'schema'])

    const schemaFailure = failures.find((f) => f.reason === 'schema')
    expect(schemaFailure?.type).toBe('assistant') // known type, missing required `message`
  })

  it('retains the raw JSON and byte offset of every parsed entry', async () => {
    const { entries } = await parseFile(MAIN_TRANSCRIPT)
    for (const e of entries) {
      expect(typeof e.raw).toBe('string')
      expect(e.raw.length).toBeGreaterThan(0)
      expect(e.byteOffset).toBeGreaterThanOrEqual(0)
      expect(() => JSON.parse(e.raw)).not.toThrow()
    }
  })

  it('accepts both string and block-array message content', async () => {
    const { entries } = await parseFile(MAIN_TRANSCRIPT)
    const users = entries.filter((e) => (e.entry as Record<string, unknown>).type === 'user')
    const contents = users.map((e) => (e.entry as { message: { content: unknown } }).message.content)
    expect(contents.some((c) => typeof c === 'string')).toBe(true)
    expect(contents.some((c) => Array.isArray(c))).toBe(true)
  })
})

describe('parseLine', () => {
  it('reports non-JSON as invalid-json', () => {
    const r = parseLine('{not json', 1, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.failure.reason).toBe('invalid-json')
  })

  it('reports a non-object JSON value as not-an-object', () => {
    const r = parseLine('[1,2,3]', 1, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.failure.reason).toBe('not-an-object')
  })

  it('degrades (does not fail) on an unmodeled type', () => {
    const r = parseLine('{"type":"totally-new","x":1}', 1, 0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.parsed.unknownType).toBe(true)
  })
})

describe('buildForest', () => {
  it('builds the conversation tree and keeps sidecar entries out of it', async () => {
    const { entries } = await parseFile(MAIN_TRANSCRIPT)
    const forest = buildForest(entries)

    // 5 entries carry uuid (user, assistant, user, attachment, system).
    expect(forest.byUuid.size).toBe(5)
    // one root (the first user turn with parentUuid null).
    expect(forest.roots).toHaveLength(1)
    expect(forest.roots[0]!.uuid).toBe('aaaaaaa1-0000-0000-0000-000000000001')
    // its child is the assistant turn.
    expect(forest.roots[0]!.children.map((c) => c.uuid)).toContain('aaaaaaa1-0000-0000-0000-000000000002')
    // sidecar singletons (last-prompt, pr-link, custom-title, file-history-snapshot, continued-in,
    // and the degraded unknown type) have no uuid and are not in the tree.
    expect(forest.nonTree).toHaveLength(6)
  })
})
