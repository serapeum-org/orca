import { describe, expect, it } from 'vitest'

import { KnownEntrySchema, KNOWN_TYPES } from '../src/parse/schema.js'

describe('KnownEntrySchema', () => {
  const cases: Array<[string, unknown]> = [
    ['user (string content)', { type: 'user', uuid: 'u', parentUuid: null, sessionId: 's', timestamp: 't', message: { role: 'user', content: 'hi' } }],
    ['user (block content)', { type: 'user', uuid: 'u', parentUuid: null, sessionId: 's', timestamp: 't', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x' }] } }],
    ['assistant', { type: 'assistant', uuid: 'u', parentUuid: 'p', sessionId: 's', timestamp: 't', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } }],
    ['attachment', { type: 'attachment', uuid: 'u', parentUuid: 'p', sessionId: 's', timestamp: 't', attachment: { type: 'x' } }],
    ['system', { type: 'system', uuid: 'u', parentUuid: 'p', sessionId: 's', timestamp: 't', subtype: 'turn_duration' }],
    ['pr-link', { type: 'pr-link', sessionId: 's', prNumber: 1, prUrl: 'u', prRepository: 'r' }],
    ['last-prompt', { type: 'last-prompt', sessionId: 's', leafUuid: 'l' }],
    ['custom-title', { type: 'custom-title', sessionId: 's', customTitle: 't' }],
    ['continued-in', { type: 'continued-in', sessionId: 's', continuedInSessionId: 's2' }],
    ['fork-context-ref', { type: 'fork-context-ref', agentId: 'a', parentSessionId: 's', parentLastUuid: 'u', contextLength: 10 }],
    ['file-history-snapshot', { type: 'file-history-snapshot', messageId: 'm', snapshot: {}, isSnapshotUpdate: false }],
  ]

  for (const [name, value] of cases) {
    it(`accepts ${name}`, () => {
      expect(KnownEntrySchema.safeParse(value).success).toBe(true)
    })
  }

  it('keeps unmodeled fields via passthrough', () => {
    const parsed = KnownEntrySchema.safeParse({
      type: 'custom-title',
      sessionId: 's',
      customTitle: 't',
      brandNewField: 123,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect((parsed.data as Record<string, unknown>).brandNewField).toBe(123)
  })

  it('rejects a known type missing a required field', () => {
    // assistant without `message`
    expect(KnownEntrySchema.safeParse({ type: 'assistant', uuid: 'u', parentUuid: null, sessionId: 's', timestamp: 't' }).success).toBe(false)
  })

  it('models exactly the 23 observed types', () => {
    expect(KNOWN_TYPES.size).toBe(23)
  })
})
