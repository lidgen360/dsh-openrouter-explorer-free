/** Free-model health cache: real pings, bounded cache, and the state snapshot. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCatalogService } from '../src/host/service.js'

const NOW = () => new Date('2026-11-10T10:00:00.000Z')

function tempStateFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-openrouter-health-'))
  return path.join(dir, 'state.json')
}

function catalogPayload() {
  const free = ['vendor/free-a', 'vendor/free-b', 'vendor/free-c']
  return {
    data: [
      ...free.map((id, index) => ({
        id,
        name: `Vendor: Free ${index}`,
        created: 1_800_000_000,
        context_length: 8_192 * (index + 1),
        architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0', completion: '0' },
      })),
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

function fakeFetch({ fails = new Set() } = {}) {
  const calls = []
  return {
    calls,
    impl: async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method || 'GET' })
      if (String(url).endsWith('/chat/completions')) {
        const body = JSON.parse(init.body || '{}')
        if (fails.has(body.model)) {
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
    },
  }
}

test('healthFree pings free chat models and caches the result', async () => {
  const file = tempStateFile()
  const fetch = fakeFetch({ fails: new Set(['vendor/free-b']) })
  const service = createCatalogService({}, { stateFile: file }, { fetchImpl: fetch.impl, now: NOW, resolveApiKey: () => 'test-key' })
  await service.syncNow()

  const first = await service.healthFree()
  assert.equal(first.ok, true)
  assert.equal(first.cached, false)
  assert.equal(first.models.length, 3, 'only free chat models are pinged')
  assert.deepEqual(first.models.map((row) => row.id).sort(), ['vendor/free-a', 'vendor/free-b', 'vendor/free-c'])
  assert.equal(first.summary.total, 3)
  assert.equal(first.summary.ok, 2)
  assert.equal(first.models.find((row) => row.id === 'vendor/free-b').ok, false)

  const second = await service.healthFree()
  assert.equal(second.cached, true, 'fresh cache is reused')
  assert.equal(fetch.calls.filter((call) => call.url.endsWith('/chat/completions')).length, 3)

  const forced = await service.healthFree({ refresh: true })
  assert.equal(forced.cached, false)
  assert.equal(fetch.calls.filter((call) => call.url.endsWith('/chat/completions')).length, 6)

  const state = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(state.health_free.models.length, 3)
})

test('healthFree reports a missing key instead of pinging', async () => {
  const file = tempStateFile()
  const fetch = fakeFetch()
  const service = createCatalogService({}, { stateFile: file }, { fetchImpl: fetch.impl, now: NOW, resolveApiKey: () => '' })
  await service.syncNow()
  const result = await service.healthFree()
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'no_key')
  assert.equal(fetch.calls.filter((call) => call.url.endsWith('/chat/completions')).length, 0)
})
