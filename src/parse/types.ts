import type { Entry } from './schema.js'

/** A transcript file found on disk by {@link discoverTranscripts}. */
export type TranscriptKind = 'session' | 'subagent'

export interface TranscriptFile {
  /** Absolute path to the `.jsonl` file. */
  path: string
  kind: TranscriptKind
  /** The encoded project directory name (cwd with non-alphanumerics replaced by `-`). Decoding is lossy. */
  project: string
  /** The session id — for a subagent, the id of the owning session. */
  sessionId: string
  /** For a subagent transcript, the transcript file's basename (without extension). */
  subagentId?: string
  sizeBytes: number
  mtimeMs: number
}

/** One raw line produced by the streaming reader. */
export interface RawLine {
  raw: string
  /** Byte offset of the first byte of this line within the file. */
  byteOffset: number
  /** 1-based line number. */
  lineNumber: number
}

/** A successfully parsed entry, retaining its raw text and byte offset so we can seek back to it later. */
export interface ParsedEntry {
  entry: Entry
  raw: string
  byteOffset: number
  lineNumber: number
  /** True when the entry's `type` is not one we model (parsed via the catch-all; degraded, not failed). */
  unknownType: boolean
}

export type ParseFailureReason = 'invalid-json' | 'not-an-object' | 'schema'

/** A line that could not be parsed. Retained in full so a format change can be diagnosed. */
export interface ParseFailure {
  raw: string
  byteOffset: number
  lineNumber: number
  reason: ParseFailureReason
  /** The entry `type` if it could be extracted, else undefined. */
  type?: string
  message: string
}

export interface ParseResult {
  entries: ParsedEntry[]
  failures: ParseFailure[]
  /** Total bytes of the file. */
  bytesRead: number
}

/** A node in the conversation tree. Sessions branch (`/branch`, `--fork-session`), so this is a forest. */
export interface TreeNode {
  entry: ParsedEntry
  uuid: string
  parentUuid: string | null
  children: TreeNode[]
}

export interface Forest {
  /** Entries whose parent is null or absent from this file. */
  roots: TreeNode[]
  byUuid: Map<string, TreeNode>
  /** Entries with no `uuid` (sidecar/metadata singletons) — attached to the session, not the tree. */
  nonTree: ParsedEntry[]
}
