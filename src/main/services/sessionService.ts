import { join, dirname, basename } from 'node:path'
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { SessionData } from '@shared/types'

const SESSION_DIR = '.subtitlestudio'

/** Resolve the per-file session path: <dir>/.subtitlestudio/<file>.session.json */
function sessionPath(originalPath: string): string {
  return join(dirname(originalPath), SESSION_DIR, `${basename(originalPath)}.session.json`)
}

/** Atomically persist a translation session next to the source file. */
export async function saveSession(originalPath: string, data: SessionData): Promise<void> {
  const target = sessionPath(originalPath)
  await mkdir(dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, target)
}

/** Load a previously saved session, or null if none / unreadable. */
export async function loadSession(originalPath: string): Promise<SessionData | null> {
  const target = sessionPath(originalPath)
  if (!existsSync(target)) return null
  try {
    return JSON.parse(await readFile(target, 'utf8')) as SessionData
  } catch {
    return null
  }
}

/** Remove a session file (e.g. on "start over"). */
export async function clearSession(originalPath: string): Promise<void> {
  await rm(sessionPath(originalPath), { force: true })
}
