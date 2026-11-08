/**
 * Journal and state-lifecycle audit: retention window, count cap, expiry
 * de-duplication, multi-process safety and cleanup of removed models.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCatalogService } from '../src/host/service.js'

const DAY = 86_400_000
const BASE = Date.UTC(2026, 0, 1)

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orx-journal-'))
  return { dir, file: path.join(dir, 'state.json') }
}

function catalogOf(list) {
  return { data: list }
}

function rawModel(id, overrides = {}) {
  return {
    id,
    name: `Model ${id}`,
    created: 1_800_000_000,
    context_length: 100_000,
    architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
    pricing: { prompt: '0.000001', completion: '0.000004' },
    ...overrides,
  }
}

function serviceFor(file, { clock, catalog }) {
  return createCatalogService({ logger: { info() {}, warn() {} }, get: () => undefined }, { stateFile: file, intervalHours: 24, journalDays: 90 }, {
    fetchImpl: async (url) => {
      if (String(url).endsWith('/chat/completions')) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200 })
      }
      return new Response(JSON.stringify(catalog()), { status: 200 })
    },
    now: () => new Date(BASE + clock.t * DAY),
  })
}

function writeStateFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}

test('journal retention drops events older than the window and keeps fresh ones', async () => {
  const { dir, file } = tempFile()
  const clock = { t: 100 }
  const recentAt = new Date(BASE + (100 - 10) * DAY).toISOString()
  const oldAt = new Date(BASE + (100 - 400) * DAY).toISOString()
  writeStateFile(file, {
    schema_version: 1,
    journal_days: 90,
    samples: 1,
    synced_at: recentAt,
    next_sync_at: new Date(BASE + 200 * DAY).toISOString(),
    models: [],
    events: [
      { id: 'evt_recent', at: recentAt, type: 'model_added', severity: 'info', model_id: 'x', title: 'recent', detail: '', read: false },
      { id: 'evt_old', at: oldAt, type: 'model_added', severity: 'info', model_id: 'y', title: 'old', detail: '', read: false },
    ],
    syncs: [],
  })
  const service = serviceFor(file, { clock, catalog: () => catalogOf([rawModel('vendor/a')]) })

  await service.syncNow()

  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(data.events.some((event) => event.id === 'evt_old'), false, 'ancient event pruned')
  assert.equal(data.events.some((event) => event.id === 'evt_recent'), true, 'recent event kept')
  assert.equal(data.journal_days, 90)

  const status = await service.status()
  assert.equal(status.journal.retention_days, 90)
  assert.equal(status.journal.events, data.events.length)
  assert.ok(status.journal.oldest_at)

  fs.rmSync(dir, { recursive: true, force: true })
})

test('journal count stays capped at 500 entries', async () => {
  const { dir, file } = tempFile()
  const clock = { t: 10 }
  const at = new Date(BASE + 10 * DAY).toISOString()
  writeStateFile(file, {
    schema_version: 1,
    samples: 1,
    synced_at: at,
    next_sync_at: new Date(BASE + 20 * DAY).toISOString(),
    models: [],
    events: Array.from({ length: 650 }, (_, index) => ({
      id: `evt_${index}`, at, type: 'model_added', severity: 'info', model_id: `m${index}`, title: 't', detail: '', read: false,
    })),
    syncs: [],
  })
  const service = serviceFor(file, { clock, catalog: () => catalogOf([rawModel('vendor/a')]) })
  await service.syncNow()

  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.ok(data.events.length <= 500, `events ${data.events.length} must stay <= 500`)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('an expiring model is announced once even when its event falls out of the cap', async () => {
  const { dir, file } = tempFile()
  const clock = { t: 50 }
  const at = new Date(BASE + 50 * DAY).toISOString()
  const legacyAt = new Date(BASE + 40 * DAY).toISOString()
  const expiringEvent = {
    id: 'evt_expire', at: legacyAt, type: 'expiring', severity: 'warn', model_id: 'vendor/exp', title: 'expiring', detail: '', read: true,
  }
  writeStateFile(file, {
    schema_version: 1,
    samples: 2,
    synced_at: at,
    next_sync_at: new Date(BASE + 60 * DAY).toISOString(),
    models: [],
    // The expiring event is far beyond the 500 cap, so it will be evicted by this sync.
    events: [expiringEvent, ...Array.from({ length: 600 }, (_, index) => ({
      id: `evt_${index}`, at, type: 'model_added', severity: 'info', model_id: `m${index}`, title: 't', detail: '', read: true,
    }))],
    syncs: [],
  })
  const service = serviceFor(file, {
    clock,
    catalog: () => catalogOf([rawModel('vendor/exp', { expiration_date: '2026-03-01' })]),
  })
  await service.syncNow()

  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const expiring = data.events.filter((event) => event.type === 'expiring' && event.model_id === 'vendor/exp')
  assert.equal(expiring.length, 1, 'only the legacy event remains — no duplicate was emitted')
  assert.equal(expiring[0].at, legacyAt)
  assert.equal(data.models.find((model) => model.id === 'vendor/exp').expiry_event_at, legacyAt, 'the marker survived the event eviction')

  fs.rmSync(dir, { recursive: true, force: true })
})

test('two instances sharing one state file do not erase each other', async () => {
  const { dir, file } = tempFile()
  const clock = { t: 1 }
  let list = [rawModel('vendor/a')]
  const serviceA = serviceFor(file, { clock, catalog: () => catalogOf(list) })
  await serviceA.syncNow()

  clock.t = 2
  list = [rawModel('vendor/a'), rawModel('vendor/b')]
  const serviceB = serviceFor(file, { clock, catalog: () => catalogOf(list) })
  await serviceB.syncNow()
  const afterB = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(afterB.models.length, 2)

  // A reads fresh state and marks events read: B's models/events must survive.
  await serviceA.readEvents({ all: true })
  const afterA = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(afterA.models.length, 2, 'instance A must not write a stale snapshot')
  assert.equal(afterA.samples, 2)
  assert.equal(afterA.events.every((event) => event.read), true)

  fs.rmSync(dir, { recursive: true, force: true })
})

test('concurrent syncs serialize through the state lock', async () => {
  const { dir, file } = tempFile()
  const clock = { t: 5 }
  let calls = 0
  const service = createCatalogService({ logger: { info() {}, warn() {} }, get: () => undefined }, { stateFile: file, intervalHours: 24 }, {
    fetchImpl: async (url) => {
      if (String(url).endsWith('/chat/completions')) return new Response('{}', { status: 200 })
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 15))
      return new Response(JSON.stringify(catalogOf([rawModel('vendor/a')])), { status: 200 })
    },
    now: () => new Date(BASE + clock.t * DAY),
  })
  // Different service instances = different processes; the lock serializes them.
  const other = createCatalogService({ logger: { info() {}, warn() {} }, get: () => undefined }, { stateFile: file, intervalHours: 24 }, {
    fetchImpl: async () => new Response(JSON.stringify(catalogOf([rawModel('vendor/b')])), { status: 200 }),
    now: () => new Date(BASE + (clock.t + 1) * DAY),
  })

  await Promise.all([service.syncNow(), other.syncNow()])
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(data.samples, 2, 'both writers committed')
  assert.equal(data.models.length >= 1, true)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('removed models are pruned after the 90-day grace period', async () => {
  const { dir, file } = tempFile()
  const clock = { t: 200 }
  const old = new Date(BASE + 10 * DAY).toISOString()
  writeStateFile(file, {
    schema_version: 1,
    samples: 1,
    synced_at: old,
    next_sync_at: new Date(BASE + 300 * DAY).toISOString(),
    models: [{
      id: 'vendor/gone', name: 'Gone', status: 'removed', removed_at: old,
      price_history: [], prompt_usd_per_1m: 1, completion_usd_per_1m: 2,
    }],
    events: [],
    syncs: [],
  })
  const service = serviceFor(file, { clock, catalog: () => catalogOf([rawModel('vendor/a')]) })
  await service.syncNow()

  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(data.models.some((model) => model.id === 'vendor/gone'), false)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('legacy state directory is migrated once and then written to the new path', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'orx-home-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const legacy = path.join(home, 'openrouter-models', 'state.json')
  fs.mkdirSync(path.dirname(legacy), { recursive: true })
  const clock = { t: 3 }
  const at = new Date(BASE + 3 * DAY).toISOString()
  fs.writeFileSync(legacy, JSON.stringify({
    schema_version: 1,
    samples: 1,
    synced_at: at,
    next_sync_at: new Date(BASE + 10 * DAY).toISOString(),
    models: [],
    events: [],
    syncs: [],
  }))
  const service = createCatalogService({ logger: { info() {}, warn() {} }, get: () => undefined }, { intervalHours: 24 }, {
    fetchImpl: async () => new Response(JSON.stringify(catalogOf([rawModel('vendor/a')])), { status: 200 }),
    now: () => new Date(BASE + clock.t * DAY),
  })

  await service.syncNow()

  const fresh = path.join(home, 'openrouter-explorer-free', 'state.json')
  assert.equal(fs.existsSync(fresh), true, 'new path is written after migration')
  const data = JSON.parse(fs.readFileSync(fresh, 'utf8'))
  assert.equal(data.samples, 2, 'legacy history was carried over')
  process.env.DSH_HOME = previousHome
  if (previousHome === undefined) delete process.env.DSH_HOME
  fs.rmSync(home, { recursive: true, force: true })
})
