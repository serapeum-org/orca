import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** The committed fixture projects tree. Tests must point here, never at the real `~/.claude`. */
export const FIXTURE_PROJECTS_DIR = join(here, 'fixtures', 'projects')

/** The main session transcript fixture. */
export const MAIN_TRANSCRIPT = join(
  FIXTURE_PROJECTS_DIR,
  '-fake-project',
  '11111111-1111-1111-1111-111111111111.jsonl',
)

export const REPO_ROOT = join(here, '..')
