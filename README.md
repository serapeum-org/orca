# ccx

`@serapeum-org/ccx` — archive and search your Claude Code conversations.

Claude Code stores every session as JSONL under `~/.claude/projects/<project>/<session>.jsonl` (relocatable via
`CLAUDE_CONFIG_DIR`) and, by default, deletes transcripts after 30 days. `ccx` is an **archive** first and an index
second: it discovers those transcripts, parses them defensively, and will (in later milestones) copy them into a
local store so they survive the cleanup window.

## Status

Early scaffold. Implemented so far:

- **Transcript discovery** (`src/discover.ts`) — walks the projects tree, excluding set-aside
  `*.orphaned-*` / `*.jsonl.superseded-*` transcripts, and surfaces subagent transcripts separately.
- **Defensive parser** (`src/parse/`) — streams each file line by line, `safeParse`s every line against a
  `zod` discriminated union, keeps the raw JSON + byte offset of every entry, and never throws on an unknown
  shape: it degrades and reports.
- **`ccx doctor`** — a schema-coverage report (entries parsed, degraded, and failed; breakdowns by type; detected
  Claude Code versions). This is the canary for a Claude Code format change.

No TUI, no search command, and no store writes yet.

## Develop

```sh
corepack pnpm install
corepack pnpm doctor        # run ccx doctor against your real ~/.claude (read-only)
corepack pnpm test          # runs against committed fixtures only
corepack pnpm build         # bundle the ccx binary into dist/
```

Requires Node 22+.
