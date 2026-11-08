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
