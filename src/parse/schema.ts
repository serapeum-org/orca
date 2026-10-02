import { z } from 'zod'

/**
 * Zod schemas for Claude Code JSONL entries.
 *
 * The entry format is internal to Claude Code and changes between releases, so these schemas are
 * deliberately permissive: every known type uses `.passthrough()` to keep unmodeled fields, and
 * required fields are limited to those observed on 100% of that type's entries in real data. A
 * schema failure on a *known* type therefore signals a genuine format change worth reporting — the
 * canary — while a brand-new `type` degrades to {@link UnknownEntrySchema} instead of crashing.
 *
 * Field selection is grounded in an inspection of real transcripts, not invented.
 */

// --- message content -------------------------------------------------------

const textBlock = z.object({ type: z.literal('text'), text: z.string() }).passthrough()
const thinkingBlock = z.object({ type: z.literal('thinking'), thinking: z.string() }).passthrough()
const toolUseBlock = z
  .object({ type: z.literal('tool_use'), id: z.string(), name: z.string(), input: z.unknown() })
  .passthrough()
const toolResultBlock = z
  .object({
    type: z.literal('tool_result'),
    tool_use_id: z.string().optional(),
    content: z.unknown().optional(),
    is_error: z.boolean().optional(),
  })
  .passthrough()
const imageBlock = z.object({ type: z.literal('image') }).passthrough()
/** Fallback so an unrecognised content block never fails the whole line. */
const unknownBlock = z.object({ type: z.string() }).passthrough()

const contentBlock = z.union([textBlock, thinkingBlock, toolUseBlock, toolResultBlock, imageBlock, unknownBlock])

/** `message.content` is either a bare string or an array of blocks — both occur in real data. */
const messageContent = z.union([z.string(), z.array(contentBlock)])

const userMessage = z.object({ role: z.literal('user'), content: messageContent }).passthrough()
const assistantMessage = z
  .object({
    role: z.literal('assistant'),
    content: messageContent,
    model: z.string().optional(),
    id: z.string().optional(),
    // usage/stop_reason are large and polymorphic across versions — kept opaque on purpose.
    usage: z.unknown().optional(),
    stop_reason: z.unknown().optional(),
  })
  .passthrough()

// --- shared envelope for conversational entries ----------------------------
// Present on 100% of assistant/user/attachment/system entries. Only the identity + tree fields are
// required; the rest are optional so cosmetic envelope drift between versions does not fire the canary.
const envelope = {
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  sessionId: z.string(),
  timestamp: z.string(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  version: z.string().optional(),
  userType: z.string().optional(),
  entrypoint: z.string().optional(),
  isSidechain: z.boolean().optional(),
  // Some versions also stamp a snake_case session id alongside `sessionId`.
  session_id: z.string().optional(),
} as const

// --- conversational entries (form the tree) --------------------------------

const assistantEntry = z
  .object({ type: z.literal('assistant'), message: assistantMessage, requestId: z.string().optional(), ...envelope })
  .passthrough()

const userEntry = z
  .object({ type: z.literal('user'), message: userMessage, toolUseResult: z.unknown().optional(), ...envelope })
  .passthrough()

const attachmentEntry = z
  .object({ type: z.literal('attachment'), attachment: z.object({ type: z.string() }).passthrough(), ...envelope })
  .passthrough()

const systemEntry = z.object({ type: z.literal('system'), subtype: z.string(), ...envelope }).passthrough()

// --- sidecar / metadata singletons (keyed by sessionId, not part of the tree) ---

const lastPromptEntry = z
  .object({ type: z.literal('last-prompt'), sessionId: z.string(), leafUuid: z.string(), lastPrompt: z.string().optional() })
  .passthrough()
const customTitleEntry = z
  .object({ type: z.literal('custom-title'), sessionId: z.string(), customTitle: z.string() })
  .passthrough()
const aiTitleEntry = z.object({ type: z.literal('ai-title'), sessionId: z.string(), aiTitle: z.string() }).passthrough()
const modeEntry = z.object({ type: z.literal('mode'), sessionId: z.string(), mode: z.string() }).passthrough()
const agentNameEntry = z
  .object({ type: z.literal('agent-name'), sessionId: z.string(), agentName: z.string() })
  .passthrough()
const permissionModeEntry = z
  .object({ type: z.literal('permission-mode'), sessionId: z.string(), permissionMode: z.string() })
  .passthrough()
const prLinkEntry = z
  .object({
    type: z.literal('pr-link'),
    sessionId: z.string(),
    prNumber: z.number(),
    prUrl: z.string(),
    prRepository: z.string(),
    timestamp: z.string().optional(),
  })
  .passthrough()
const atisLatchEntry = z.object({ type: z.literal('atis-latch'), sessionId: z.string(), atis: z.unknown() }).passthrough()
const fileHistorySnapshotEntry = z
  .object({
    type: z.literal('file-history-snapshot'),
    messageId: z.string(),
    snapshot: z.unknown(),
    isSnapshotUpdate: z.boolean(),
  })
  .passthrough()
const fileHistoryDeltaEntry = z
  .object({
    type: z.literal('file-history-delta'),
    messageId: z.string(),
    snapshotMessageId: z.string(),
    trackingPath: z.string(),
    backup: z.unknown(),
    timestamp: z.string().optional(),
  })
  .passthrough()
const queueOperationEntry = z
  .object({
    type: z.literal('queue-operation'),
    sessionId: z.string(),
    operation: z.string(),
    timestamp: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough()
const relocatedEntry = z
  .object({ type: z.literal('relocated'), sessionId: z.string(), relocatedCwd: z.string() })
  .passthrough()
const worktreeStateEntry = z
  .object({ type: z.literal('worktree-state'), sessionId: z.string(), worktreeSession: z.unknown() })
  .passthrough()
const bridgeSessionEntry = z
  .object({
    type: z.literal('bridge-session'),
    sessionId: z.string(),
    bridgeSessionId: z.string(),
    lastSequenceNum: z.number(),
    ownerAccountUuid: z.string(),
    ownerOrganizationUuid: z.string(),
  })
  .passthrough()
const costStateEntry = z
  .object({
    type: z.literal('cost-state'),
    sessionId: z.string(),
    totalCostUSD: z.number().optional(),
    modelUsage: z.unknown().optional(),
  })
  .passthrough()
const continuedInEntry = z
  .object({
    type: z.literal('continued-in'),
    sessionId: z.string(),
    continuedInSessionId: z.string(),
    timestamp: z.string().optional(),
  })
  .passthrough()
// Header of a forked subagent transcript: references the parent session it forked context from.
// Observed only in `subagents/` transcripts; keyed by parentSessionId, with no uuid of its own.
const forkContextRefEntry = z
  .object({
    type: z.literal('fork-context-ref'),
    agentId: z.string(),
    parentSessionId: z.string(),
    parentLastUuid: z.string(),
    contextLength: z.number(),
  })
  .passthrough()
const frameLinkEntry = z
  .object({ type: z.literal('frame-link'), sessionId: z.string(), frameUrl: z.string(), timestamp: z.string().optional() })
  .passthrough()
const endedByModelEntry = z
  .object({ type: z.literal('ended-by-model'), sessionId: z.string(), timestamp: z.string().optional() })
  .passthrough()

/** Discriminated union over every `type` seen in real data. */
export const KnownEntrySchema = z.discriminatedUnion('type', [
  assistantEntry,
  userEntry,
  attachmentEntry,
  systemEntry,
  lastPromptEntry,
  customTitleEntry,
  aiTitleEntry,
  modeEntry,
  agentNameEntry,
  permissionModeEntry,
  prLinkEntry,
  atisLatchEntry,
  fileHistorySnapshotEntry,
  fileHistoryDeltaEntry,
  queueOperationEntry,
  relocatedEntry,
  worktreeStateEntry,
  bridgeSessionEntry,
  costStateEntry,
  continuedInEntry,
  forkContextRefEntry,
  frameLinkEntry,
  endedByModelEntry,
])

/** Catch-all for an entry whose `type` we have not modelled yet — degrade, don't crash. */
export const UnknownEntrySchema = z.object({ type: z.string() }).passthrough()

export type KnownEntry = z.infer<typeof KnownEntrySchema>
export type UnknownEntry = z.infer<typeof UnknownEntrySchema>
export type Entry = KnownEntry | UnknownEntry

/** The set of `type` values we model. Used to tell a real schema failure from a new-but-valid type. */
export const KNOWN_TYPES: ReadonlySet<string> = new Set<string>([
  'assistant',
  'user',
  'attachment',
  'system',
  'last-prompt',
  'custom-title',
  'ai-title',
  'mode',
  'agent-name',
  'permission-mode',
  'pr-link',
  'atis-latch',
  'file-history-snapshot',
  'file-history-delta',
  'queue-operation',
  'relocated',
  'worktree-state',
  'bridge-session',
  'cost-state',
  'continued-in',
  'fork-context-ref',
  'frame-link',
  'ended-by-model',
])
