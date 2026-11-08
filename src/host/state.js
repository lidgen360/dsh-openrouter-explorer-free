/** Persistence for the local catalog snapshot: one JSON document, atomic writes. */
import fs from 'node:fs/promises'
import path from 'node:path'

/** Fresh, empty catalog state. */
export function emptyState(overrides = {}) {
  return {
    schema_version: 1,
    source: null,
    synced_at: null,
    next_sync_at: null,
    attempted_at: null,
    interval_hours: 24,
    discount_threshold_pct: 30,
    samples: 0,
    baseline_at: null,
    last_error: null,
    last_error_at: null,
    failures: 0,
    syncs: [],
    models: [],
    events: [],
    ...overrides,
  }
}

/** Read the state file; `null` when it does not exist or is malformed. */
export async function readState(file) {
  try {
    const text = await fs.readFile(file, 'utf8')
    const data = JSON.parse(text)
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

/** Write atomically through a same-directory temporary file. */
export async function writeState(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await fs.writeFile(tmp, JSON.stringify(data), { mode: 0o600 })
    await fs.rename(tmp, file)
  } catch (error) {
    try {
      await fs.unlink(tmp)
    } catch {
      /* the temporary file may already be gone */
    }
    throw error
  }
}

/**
 * Serialize one read-modify-write cycle across processes: several DSH profiles
 * can share one DSH_HOME (Web GUI + headless CLI), so an in-memory snapshot is
 * never authoritative. The lock is a directory next to the state file; stale
 * locks (crashed process) are reaped after `staleMs`.
 *
 * @template T
 * @param {string} file state file path
 * @param {() => Promise<T>} operation work performed while holding the lock
 * @param {{ timeoutMs?: number, staleMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function withStateLock(file, operation, { timeoutMs = 5_000, staleMs = 30_000 } = {}) {
  const lock = `${file}.lock`
  const startedAt = Date.now()
  for (;;) {
    try {
      await fs.mkdir(lock, { recursive: false })
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      try {
        const stat = await fs.stat(lock)
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fs.rm(lock, { recursive: true, force: true })
          continue
        }
      } catch {
        /* the owner released it between mkdir and stat */
      }
      if (Date.now() - startedAt > timeoutMs) throw new Error('состояние каталога занято другим процессом — повторите позже')
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
  }
  try {
    return await operation()
  } finally {
    await fs.rm(lock, { recursive: true, force: true }).catch(() => {})
  }
}
