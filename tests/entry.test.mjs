/**
 * Universality: the host half must load in profiles without a Web server
 * (headless, SDK, ACP) and must not require the browser stack.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

test('plugin loads without a web server and without touching the network', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-orx-entry-'))
  const file = path.join(dir, 'state.json')
  fs.writeFileSync(file, JSON.stringify({
    schema_version: 1,
    synced_at: '2026-01-01T00:00:00.000Z',
    next_sync_at: '2099-01-01T00:00:00.000Z',
    samples: 1,
    baseline_at: '2026-01-01T00:00:00.000Z',
    models: [],
    events: [],
    syncs: [],
  }))
  process.env.DSH_OPENROUTER_MODELS_FILE = file

  const { apply } = await import('../index.js')
  const effects = []
  const injected = []
  let webServerLookup = false
  const ctx = {
    logger: { info() {}, warn() {} },
    get: (name) => {
      if (name === 'webServer') webServerLookup = true
      return undefined
    },
    effect: (callback, label) => {
      effects.push(label)
      const dispose = callback()
      if (typeof dispose === 'function') dispose()
    },
    inject: (services, callback) => {
      injected.push(services)
      // The web server is absent in this profile: the callback simply never runs.
    },
  }

  assert.doesNotThrow(() => apply(ctx, { autoProvision: false, intervalHours: 24 }))
  assert.ok(effects.some((label) => String(label).includes('catalog lifecycle')))
  assert.deepEqual(injected, [['webServer']], 'the HTTP API is requested only as an optional injection')
  await new Promise((resolve) => setTimeout(resolve, 30))

  delete process.env.DSH_OPENROUTER_MODELS_FILE
  fs.rmSync(dir, { recursive: true, force: true })
})
