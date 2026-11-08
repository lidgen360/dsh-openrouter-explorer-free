/**
 * Unit tests for the pure catalog logic: normalization, price history,
 * discounts, the event journal and the free-model ranking.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyCatalog,
  buildStatus,
  computeHigh,
  freeChatModels,
  isFreeChatModel,
  listEvents,
  listModels,
  markEventsRead,
  maxDropPct,
  normalizeModel,
  usdPer1m,
  variantBaseId,
} from '../src/host/catalog.js'

const NOW = '2026-11-08T10:00:00.000Z'

function rawModel(overrides = {}) {
  return {
    id: 'vendor/model-a',
    name: 'Vendor: Model A',
    created: 1_800_000_000,
    context_length: 131_072,
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
    },
    pricing: { prompt: '0.000001', completion: '0.000004' },
    description: 'A test model.',
    ...overrides,
  }
}

function emptyState() {
  return {
    schema_version: 1,
    synced_at: null,
    next_sync_at: null,
    samples: 0,
    baseline_at: null,
    models: [],
    events: [],
    syncs: [],
    last_error: null,
    failures: 0,
  }
}

test('usdPer1m converts per-token prices and rejects variable prices', () => {
  assert.equal(usdPer1m('0.000001'), 1)
  assert.equal(usdPer1m('0.000000075'), 0.075)
  assert.equal(usdPer1m('0'), 0)
  assert.equal(usdPer1m('-1'), null)
  assert.equal(usdPer1m(undefined), null)
})

test('normalizeModel keeps prices, context and free flag', () => {
  const model = normalizeModel(rawModel(), { at: NOW })
  assert.equal(model.id, 'vendor/model-a')
  assert.equal(model.prompt_usd_per_1m, 1)
  assert.equal(model.completion_usd_per_1m, 4)
  assert.equal(model.is_free, false)
  assert.equal(model.context_length, 131072)
  assert.equal(model.modality, 'text->text')
  assert.equal(model.first_seen_at, NOW)
  assert.equal(model.status, 'active')
})

test('normalizeModel treats zero tokens as free, but not a zero-token model with paid images', () => {
  const free = normalizeModel(rawModel({ pricing: { prompt: '0', completion: '0' } }), { at: NOW })
  assert.equal(free.is_free, true)

  const imagePaid = normalizeModel(rawModel({ pricing: { prompt: '0', completion: '0', image: '0.01' } }), { at: NOW })
  assert.equal(imagePaid.is_free, false)
})

test('variantBaseId recognises :batch and :free variants only', () => {
  assert.equal(variantBaseId('vendor/model-a:batch'), 'vendor/model-a')
  assert.equal(variantBaseId('vendor/model-a:free'), 'vendor/model-a')
  assert.equal(variantBaseId('vendor/model-a'), null)
})

test('normalizeModel marks soon-expiring models', () => {
  const soon = normalizeModel(rawModel({ expiration_date: '2026-11-10' }), { at: NOW })
  assert.equal(soon.expiring_soon, true)
  const later = normalizeModel(rawModel({ expiration_date: '2027-01-10' }), { at: NOW })
  assert.equal(later.expiring_soon, false)
})

test('computeHigh returns the maximum price inside the window', () => {
  const points = [
    { at: '2026-10-01T00:00:00.000Z', p: 2, c: 8 },
    { at: '2026-11-07T00:00:00.000Z', p: 3, c: 9 },
  ]
  const high = computeHigh(points, Date.parse(NOW))
  assert.equal(high.prompt_usd_per_1m, 3)
  assert.equal(high.completion_usd_per_1m, 9)
  assert.equal(computeHigh([], Date.parse(NOW)), null)
})

test('maxDropPct measures the largest relative drop across components', () => {
  assert.equal(maxDropPct({ prompt_usd_per_1m: 2, completion_usd_per_1m: 8 }, { prompt_usd_per_1m: 1, completion_usd_per_1m: 8 }), 50)
  assert.equal(maxDropPct({ prompt_usd_per_1m: 1, completion_usd_per_1m: 1 }, { prompt_usd_per_1m: 2, completion_usd_per_1m: 2 }), null)
  assert.equal(maxDropPct(null, { prompt_usd_per_1m: 1 }), null)
})

test('first sample is a baseline: no model_added, no discounts', () => {
  const state = emptyState()
  const summary = applyCatalog(state, [rawModel(), rawModel({ id: 'vendor/free', pricing: { prompt: '0', completion: '0' } })], {
    at: NOW,
    threshold: 30,
    intervalHours: 24,
    startedAt: Date.now(),
    source: 'test',
  })
  assert.equal(summary.baseline, true)
  assert.equal(summary.total, 2)
  assert.equal(summary.free, 1)
  assert.equal(summary.added, 0)
  assert.equal(summary.events, 0)
  assert.equal(state.samples, 1)
  assert.equal(state.next_sync_at, '2026-11-09T10:00:00.000Z')
  assert.equal(state.events.length, 0)
  assert.equal(state.models[0].discount, null)
})

test('a new model after the baseline produces model_added and a price drop produces a discount', () => {
  const state = emptyState()
  applyCatalog(state, [rawModel()], { at: NOW, threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test' })

  const later = '2026-11-09T10:00:00.000Z'
  const summary = applyCatalog(
    state,
    [
      rawModel({ pricing: { prompt: '0.0000005', completion: '0.000002' } }),
      rawModel({ id: 'vendor/new-model', pricing: { prompt: '0.000002', completion: '0.000002' } }),
    ],
    { at: later, threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test' },
  )

  assert.equal(summary.baseline, false)
  assert.equal(summary.added, 1)
  assert.equal(summary.dropped, 1)
  assert.equal(summary.discounts, 1)

  const dropped = state.models.find((model) => model.id === 'vendor/model-a')
  assert.equal(dropped.discount.pct, 50)
  assert.equal(dropped.discount.basis, 'prev')

  const types = state.events.map((event) => event.type).sort()
  assert.deepEqual(types, ['model_added', 'price_drop'])
})

test('a vanished model becomes removed with an event', () => {
  const state = emptyState()
  applyCatalog(state, [rawModel()], { at: NOW, threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test' })
  const summary = applyCatalog(state, [], {
    at: '2026-11-09T10:00:00.000Z', threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test',
  })
  assert.equal(summary.removed, 1)
  assert.equal(state.models[0].status, 'removed')
  assert.ok(state.events.some((event) => event.type === 'model_removed'))
  assert.equal(listModels(state, {}).length, 0)
  assert.equal(listModels(state, { include_removed: 1 }).length, 1)
})

test('becoming free emits a hot event', () => {
  const state = emptyState()
  applyCatalog(state, [rawModel()], { at: NOW, threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test' })
  applyCatalog(state, [rawModel({ pricing: { prompt: '0', completion: '0' } })], {
    at: '2026-11-09T10:00:00.000Z', threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test',
  })
  const event = state.events.find((item) => item.type === 'became_free')
  assert.ok(event)
  assert.equal(event.severity, 'hot')
  assert.equal(state.models[0].is_free, true)
})

test('a price rise below the threshold is ignored', () => {
  const state = emptyState()
  applyCatalog(state, [rawModel()], { at: NOW, threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test' })
  applyCatalog(state, [rawModel({ pricing: { prompt: '0.0000011', completion: '0.000004' } })], {
    at: '2026-11-09T10:00:00.000Z', threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test',
  })
  assert.equal(state.events.length, 0)
})

test('freeChatModels ranks free text models by context window', () => {
  const state = {
    models: [
      { id: 'a', is_free: true, input_modalities: ['text'], output_modalities: ['text'], context_length: 8_192 },
      { id: 'b', is_free: true, input_modalities: ['text'], output_modalities: ['text'], context_length: 1_000_000 },
      { id: 'c', is_free: false, input_modalities: ['text'], output_modalities: ['text'], context_length: 2_000_000 },
      { id: 'd', is_free: true, input_modalities: ['text'], output_modalities: ['audio'], context_length: 3_000_000 },
    ],
  }
  assert.deepEqual(freeChatModels(state).map((model) => model.id), ['b', 'a'])
  assert.equal(isFreeChatModel(state.models[3]), false)
})

test('buildStatus reports totals and events', () => {
  const state = emptyState()
  applyCatalog(state, [rawModel(), rawModel({ id: 'vendor/free', pricing: { prompt: '0', completion: '0' } })], {
    at: NOW, threshold: 30, intervalHours: 24, startedAt: Date.now(), source: 'test',
  })
  const status = buildStatus(state, { settings: { intervalHours: 24, discountPct: 30 } })
  assert.equal(status.totals.models, 2)
  assert.equal(status.totals.free, 1)
  assert.equal(status.samples, 1)
  assert.equal(status.interval_hours, 24)
  assert.equal(status.in_flight, false)
})

test('events can be listed, filtered and marked read', () => {
  const state = emptyState()
  state.events = [
    { id: 'e1', type: 'price_drop', read: false },
    { id: 'e2', type: 'model_added', read: false },
  ]
  assert.equal(listEvents(state, {}).unread, 2)
  assert.equal(listEvents(state, { type: 'price_drop' }).events.length, 1)
  assert.deepEqual(markEventsRead(state, { all: true }), { unread: 0, marked: 2 })
})

test('modality filter is inclusive: universal models stay in every supported category', () => {
  const state = {
    models: [
      { id: 'vendor/text', name: 'Text', author: 'vendor', status: 'active', input_modalities: ['text'], output_modalities: ['text'] },
      { id: 'vendor/universal', name: 'Universal', author: 'vendor', status: 'active', input_modalities: ['text', 'image', 'video', 'audio'], output_modalities: ['text'] },
      { id: 'vendor/audio-out', name: 'AudioOut', author: 'vendor', status: 'active', input_modalities: ['text'], output_modalities: ['text', 'audio'] },
    ],
  }
  const ids = (filters) => listModels(state, filters).map((model) => model.id).sort()

  // input or output match, and the multimodal model is not hidden by its text capability
  assert.deepEqual(ids({ modality: 'video' }), ['vendor/universal'])
  assert.deepEqual(ids({ modality: 'audio' }), ['vendor/audio-out', 'vendor/universal'])
  assert.deepEqual(ids({ modality: 'image' }), ['vendor/universal'])
  assert.deepEqual(ids({ modality: 'text' }), ['vendor/audio-out', 'vendor/text', 'vendor/universal'])
  // no modality filter → everything
  assert.equal(ids({}).length, 3)
})
