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

test('rankings cache: warm reads skip the network and a failed refresh keeps the snapshot', async () => {
  const stateFile = tempStateFile()
  const rankingsFile = path.join(path.dirname(stateFile), 'rankings.json')
  const { context } = fakeContext()
  const calls = []
  const goodFetch = async (url) => {
    const target = String(url)
    calls.push(target)
    if (target.includes('/rankings/models')) {
      return new Response(JSON.stringify({
        data: [
          { date: '2026-11-07 00:00:00', model_permaslug: 'vendor/paid-20260101', variant: 'standard', rankingMetricValue: 1_000_000_000_000, count: 100, change: 0.25 },
          { date: '2026-11-07 00:00:00', model_permaslug: 'vendor/free-small-20260101', variant: 'standard', rankingMetricValue: 500_000_000_000, count: 50, change: -0.1 },
          { date: '2026-11-06 00:00:00', model_permaslug: 'vendor/old-20260101', variant: 'standard', rankingMetricValue: 9, count: 9, change: 0 },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (target.includes('/rankings/benchmarks')) {
      return new Response(JSON.stringify({
        data: {
          aaData: {
            intelligence: [{ permaslug: 'vendor/paid-20260101', aa_name: 'Paid', score: 70 }],
            coding: [{ permaslug: 'vendor/paid-20260101', aa_name: 'Paid', score: 65 }],
          },
          valsIndex: { benchmark_version: 'aa-v2' },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify(catalogPayload()), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const service = createCatalogService(context, { stateFile, rankingsFile, rankingsHours: 6 }, { fetchImpl: goodFetch, now: NOW })
  await service.syncNow()

  const first = await service.rankings()
  assert.equal(first.cached, false)
  assert.equal(first.usage.at, '2026-11-07 00:00:00')
  assert.deepEqual(first.usage.models.map((row) => row.slug), ['vendor/paid-20260101', 'vendor/free-small-20260101'])
  assert.equal(first.usage.models[0].name, 'Vendor: Paid')
  assert.equal(first.benchmarks.benchmark_version, 'aa-v2')
  assert.equal(first.benchmarks.models[0].coding, 65)

  const rankingCalls = () => calls.filter((url) => url.includes('/rankings/')).length
  const afterFirst = rankingCalls()
  const warm = await service.rankings()
  assert.equal(warm.cached, true)
  assert.equal(rankingCalls(), afterFirst, 'a warm cache must not hit the network')

  const forced = await service.rankings({ refresh: true })
  assert.equal(forced.cached, false)
  assert.equal(rankingCalls(), afterFirst + 2)

  const broken = createCatalogService(context, { stateFile, rankingsFile, rankingsHours: 6 }, {
    fetchImpl: async () => new Response('{"error":"down"}', { status: 500 }),
    now: () => new Date('2026-11-08T20:00:00.000Z'),
  })
  const stale = await broken.rankings()
  assert.equal(stale.stale, true)
  assert.equal(stale.cached, true)
  assert.equal(stale.usage.models[0].slug, 'vendor/paid-20260101')
  assert.match(stale.error, /HTTP 500/)
})

test('balance: /credits is cached, refresh is forced and a missing key is reported', async () => {
  const stateFile = tempStateFile()
  const { context } = fakeContext()
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers || {} })
    if (String(url).endsWith('/credits')) {
      return new Response(JSON.stringify({ data: { total_credits: 20, total_usage: 7.5 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(catalogPayload()), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const service = createCatalogService(context, { stateFile, balanceSeconds: 60 }, {
    fetchImpl,
    now: NOW,
    resolveApiKey: () => 'test-key',
  })
  const first = await service.balance()
  assert.equal(first.ok, true)
  assert.equal(first.total_credits, 20)
  assert.equal(first.total_usage, 7.5)
  assert.equal(first.remaining, 12.5)
  assert.equal(first.cached, false)
  assert.equal(calls[0].headers.authorization, 'Bearer test-key')

  const creditsCalls = () => calls.filter((call) => call.url.endsWith('/credits')).length
  assert.equal(creditsCalls(), 1)
  const warm = await service.balance()
  assert.equal(warm.cached, true)
  assert.equal(creditsCalls(), 1, 'a warm balance must not hit the network')
  const forced = await service.balance({ refresh: true })
  assert.equal(forced.cached, false)
  assert.equal(creditsCalls(), 2)

  const noKey = createCatalogService(context, { stateFile }, { fetchImpl, now: NOW, resolveApiKey: () => '' })
  const missing = await noKey.balance()
  assert.equal(missing.ok, false)
  assert.equal(missing.reason, 'no_key')
  assert.match(missing.error, /OPENROUTER_API_KEY/)

  const broken = createCatalogService(context, { stateFile }, {
    fetchImpl: async () => new Response('{"error":"nope"}', { status: 401 }),
    now: NOW,
    resolveApiKey: () => 'bad-key',
  })
  const failed = await broken.balance()
  assert.equal(failed.ok, false)
  assert.equal(failed.reason, 'error')
  assert.match(failed.error, /HTTP 401/)
})

test('generation: discovery, images, video job and speech are saved and cached', async () => {
  const stateFile = tempStateFile()
  const generatedDir = path.join(path.dirname(stateFile), 'generated')
  const { context } = fakeContext()
  const calls = []
  const png = Buffer.from('PNGBYTES')
  const mp3 = Buffer.from('MP3BYTES')
  const mp4 = Buffer.from('MP4BYTES')
  const fetchImpl = async (url, init = {}) => {
    const target = String(url)
    calls.push({ url: target, method: init.method || 'GET', headers: init.headers || {}, body: init.body })
    const json = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    if (target.endsWith('/images/models')) return json({ data: [{ id: 'img/a', name: 'Img A' }] })
    if (target.endsWith('/videos/models')) return json({ data: [{ id: 'vid/a', name: 'Vid A', pricing_skus: { duration_seconds_720p: '0.5' }, supported_resolutions: ['720p'], supported_durations: [8] }] })
    if (target.includes('/models?output_modalities=speech')) return json({ data: [{ id: 'tts/a', name: 'TTS A' }] })
    if (target.endsWith('/images') && init.method === 'POST') {
      return json({ created: 1, data: [{ b64_json: png.toString('base64'), media_type: 'image/png' }], usage: { cost: 0.04 } })
    }
    if (target.endsWith('/videos') && init.method === 'POST') return json({ id: 'gen-vid-1', status: 'pending', polling_url: '/api/v1/videos/gen-vid-1' })
    if (target.endsWith('/videos/gen-vid-1')) return json({ id: 'gen-vid-1', status: 'completed', urls: ['https://x/v.mp4'], usage: { cost: 0.56 } })
    if (target.includes('/videos/gen-vid-1/content')) return new Response(mp4, { status: 200, headers: { 'content-type': 'video/mp4' } })
    if (target.endsWith('/audio/speech') && init.method === 'POST') return new Response(mp3, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    return json(catalogPayload())
  }
  const service = createCatalogService(context, { stateFile, generationDir: generatedDir }, {
    fetchImpl,
    now: NOW,
    resolveApiKey: () => 'test-key',
  })

  const images = await service.generationModels({ kind: 'image' })
  const videos = await service.generationModels({ kind: 'video' })
  const speech = await service.generationModels({ kind: 'speech' })
  assert.equal(images.ok, true)
  assert.equal(images.models[0].id, 'img/a')
  assert.equal(videos.ok, true)
  assert.equal(videos.models[0].id, 'vid/a')
  assert.equal(speech.ok, true)
  assert.equal(speech.models[0].id, 'tts/a')

  const modelCalls = () => calls.filter((call) => call.url.includes('/images/models')
    || call.url.includes('/videos/models')
    || call.url.includes('output_modalities=speech')).length
  assert.equal(modelCalls(), 3)
  const warm = await service.generationModels({ kind: 'image' })
  assert.equal(warm.cached, true)
  assert.equal(modelCalls(), 3, 'model lists are cached')

  const image = await service.generateImage({ model: 'img/a', prompt: 'a cat', resolution: '2K' })
  assert.equal(image.ok, true)
  assert.equal(image.cost, 0.04)
  assert.equal(image.files.length, 1)
  assert.deepEqual(await fs.promises.readFile(path.join(generatedDir, image.files[0].name)), png)
  assert.equal(image.files[0].mediaType, 'image/png')
  const imagePost = calls.find((call) => call.url.endsWith('/images') && call.method === 'POST')
  assert.equal(imagePost.headers.authorization, 'Bearer test-key')
  assert.deepEqual(JSON.parse(imagePost.body), { model: 'img/a', prompt: 'a cat', resolution: '2K' })

  const video = await service.generateVideo({ model: 'vid/a', prompt: 'sea', duration: 8 })
  assert.equal(video.ok, true)
  assert.equal(video.job.id, 'gen-vid-1')
  assert.equal(video.estimate, 4)
  const status = await service.videoJob({ id: 'gen-vid-1' })
  assert.equal(status.ok, true)
  assert.equal(status.job.status, 'completed')
  assert.equal(status.job.cost, 0.56)
  const content = await service.videoContent({ id: 'gen-vid-1' })
  assert.equal(content.ok, true)
  assert.deepEqual(await fs.promises.readFile(path.join(generatedDir, content.file.name)), mp4)

  const spoken = await service.synthesizeSpeech({ model: 'tts/a', input: 'hello', voice: 'v1' })
  assert.equal(spoken.ok, true)
  assert.equal(spoken.file.mediaType, 'audio/mpeg')
  assert.deepEqual(await fs.promises.readFile(path.join(generatedDir, spoken.file.name)), mp3)

  const files = await service.generatedFiles()
  assert.equal(files.length, 3)
  const served = await service.generatedFile(image.files[0].name)
  assert.equal(served.mediaType, 'image/png')
  assert.equal(await service.generatedFile('../../etc/passwd'), null)

  const invalid = await service.generateImage({ model: 'img/a' })
  assert.equal(invalid.ok, false)
  assert.match(invalid.error, /prompt/)

  const noKey = createCatalogService(context, { stateFile, generationDir: generatedDir }, {
    fetchImpl,
    now: NOW,
    resolveApiKey: () => '',
  })
  const missing = await noKey.generationModels({ kind: 'image' })
  assert.equal(missing.ok, false)
  assert.equal(missing.reason, 'no_key')
})
