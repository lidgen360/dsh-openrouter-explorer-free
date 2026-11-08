/**
 * Service-level tests: the 24h sync lifecycle, failure accounting and the
 * "ride for free" auto-route. Everything network- or framework-shaped is
 * injected, so the suite runs offline and never touches a real profile.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCatalogService } from '../src/host/service.js'

const NOW = () => new Date('2026-11-08T10:00:00.000Z')

function tempStateFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-openrouter-'))
  return path.join(dir, 'state.json')
}

function catalogPayload() {
  return {
    data: [
      {
        id: 'vendor/free-small',
        name: 'Vendor: Free Small',
        created: 1_800_000_000,
        context_length: 8_192,
        architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'vendor/free-large',
        name: 'Vendor: Free Large',
        created: 1_800_000_000,
        context_length: 1_000_000,
        architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'vendor/paid',
        name: 'Vendor: Paid',
        created: 1_800_000_000,
        context_length: 2_000_000,
        architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0.000002', completion: '0.000008' },
      },
    ],
  }
}

/** Fake fetch: catalog listing plus a chat ping whose answer depends on the model. */
function fakeFetch({ pingFails = new Set() } = {}) {
  const calls = []
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' })
    if (String(url).endsWith('/chat/completions')) {
      const body = JSON.parse(init.body || '{}')
      if (pingFails.has(body.model)) {
        return new Response(JSON.stringify({ error: 'nope' }), { status: 500 })
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(catalogPayload()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { impl, calls }
}

function fakeContext() {
  const selections = []
  const agent = { model: { select: (selection) => selections.push(selection) } }
  const edits = []
  const context = {
    logger: { info() {}, warn() {} },
    get: (name) => ({
      credentials: { resolve: async () => ({ value: 'test-key', source: 'test' }) },
      llm: { resolveCallConfig: async () => ({}) },
      agents: { get: (id) => (id === 'session-1' ? agent : undefined) },
      loader: { entries: () => [{ options: { id: 'llm-pi-ai' }, fiber: {} }] },
      configEditor: {
        configuration: () => [{ entry: { options: { id: 'llm-pi-ai' } }, inherited: {}, override: {} }],
        edit: async (_entry, change) => {
          edits.push(change({}, {}))
        },
      },
    })[name],
  }
  return { context, selections, edits }
}

test('auto-route pings free models, enables the winner and selects it', async () => {
  const stateFile = tempStateFile()
  const { context, selections, edits } = fakeContext()
  const fetchState = fakeFetch({ pingFails: new Set(['vendor/free-small']) })
  const service = createCatalogService(context, { stateFile, maxCandidates: 4 }, {
    fetchImpl: fetchState.impl,
    now: NOW,
  })

  const result = await service.autoRoute({ sessionId: 'session-1' })

  assert.equal(result.ok, true)
  assert.equal(result.routed.model, 'vendor/free-large')
  assert.equal(result.routed.context_length, 1_000_000)
  assert.equal(result.routed.price, 'бесплатно')
  assert.ok(result.attempts.some((attempt) => attempt.model === 'vendor/free-small' && attempt.ok === false))
  assert.deepEqual(selections, [{ provider: 'openrouter', model: 'vendor/free-large' }])
  assert.equal(edits.length, 1)
  assert.ok(edits[0].providers.openrouter.models.some((model) => model.id === 'vendor/free-large'))
  assert.ok(fs.existsSync(stateFile))
})

test('auto-route without an API key reports the missing credential', async () => {
  const stateFile = tempStateFile()
  const { context } = fakeContext()
  const fetchState = fakeFetch()
  const service = createCatalogService(context, { stateFile }, {
    fetchImpl: fetchState.impl,
    now: NOW,
    resolveApiKey: () => '',
  })

  const result = await service.autoRoute({ sessionId: 'session-1' })
  assert.equal(result.ok, false)
  assert.match(result.error, /Нет ключа OpenRouter/)
  assert.equal(fetchState.calls.filter((call) => call.url.endsWith('/chat/completions')).length, 0)
})

test('auto-route reports an unknown session instead of failing silently', async () => {
  const stateFile = tempStateFile()
  const { context } = fakeContext()
  const fetchState = fakeFetch()
  const service = createCatalogService(context, { stateFile }, {
    fetchImpl: fetchState.impl,
    now: NOW,
  })

  const result = await service.autoRoute({ sessionId: 'nope' })
  assert.equal(result.ok, false)
  assert.match(result.error, /не выбрана в сессии/)
})

test('sync failure is recorded without losing the previous snapshot', async () => {
  const stateFile = tempStateFile()
  const { context } = fakeContext()
  const good = createCatalogService(context, { stateFile }, { fetchImpl: fakeFetch().impl, now: NOW })
  await good.syncNow()
  const before = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  assert.equal(before.models.length, 3)

  const bad = createCatalogService(context, { stateFile }, {
    fetchImpl: async () => {
      throw new Error('offline')
    },
    now: NOW,
  })
  await assert.rejects(() => bad.syncNow(), /offline/)

  const after = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  assert.equal(after.models.length, 3, 'existing models survive a failed refresh')
  assert.match(after.last_error, /offline/)
  assert.equal(after.failures, 1)
  assert.ok(after.events.some((event) => event.type === 'sync_failed'))
  const retryInMs = Date.parse(after.next_sync_at) - Date.parse(NOW().toISOString())
  assert.equal(retryInMs, 60 * 60 * 1000)
})

test('manual refresh and single-flight share one network request', async () => {
  const stateFile = tempStateFile()
  const { context } = fakeContext()
  let listings = 0
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/chat/completions')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200 })
    }
    listings += 1
    await new Promise((resolve) => setTimeout(resolve, 10))
    return new Response(JSON.stringify(catalogPayload()), { status: 200 })
  }
  const service = createCatalogService(context, { stateFile }, { fetchImpl, now: NOW })

  const [first, second] = await Promise.all([service.syncNow(), service.syncNow()])
  assert.equal(listings, 1)
  assert.equal(first.total, 3)
  assert.equal(second.total, 3)
})

test('status and model list expose the persisted snapshot', async () => {
  const stateFile = tempStateFile()
  const { context } = fakeContext()
  const service = createCatalogService(context, { stateFile }, { fetchImpl: fakeFetch().impl, now: NOW })
  await service.syncNow()

  const status = await service.status()
  assert.equal(status.totals.models, 3)
  assert.equal(status.totals.free, 2)
  assert.equal(status.samples, 1)

  const models = await service.models({ free: 1 })
  assert.equal(models.length, 2)

  const settings = await service.settings()
  assert.equal(settings.provider, 'openrouter')
  assert.equal(settings.interval_hours, 24)
})
