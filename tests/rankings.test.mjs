/**
 * Unit tests for the rankings adapters: the usage leaderboard snapshot, the
 * Artificial Analysis benchmark merge and the catalog join.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  baseSlug,
  catalogIndex,
  enrichBenchmark,
  enrichUsage,
  findCatalogModel,
  normalizeBenchmarks,
  normalizeUsage,
} from '../src/host/rankings.js'

function usagePayload() {
  return {
    data: [
      { date: '2026-11-06 00:00:00', model_permaslug: 'vendor/old-20260101', variant: 'standard', rankingMetricValue: 9e11, count: 9, change: 0 },
      { date: '2026-11-07 00:00:00', model_permaslug: 'vendor/paid-20260101', variant: 'standard', rankingMetricValue: 1e12, count: 100, change: 0.25 },
      { date: '2026-11-07 00:00:00', model_permaslug: 'vendor/free-small', variant: 'standard', rankingMetricValue: 5e11, count: 50, change: -0.1 },
      { date: '2026-11-07 00:00:00', model_permaslug: 'vendor/free-small', variant: 'free', rankingMetricValue: 7e10, count: 7, change: null },
      { date: '2026-11-07 00:00:00', model_permaslug: 'vendor/paid-20260101', variant: 'batch', rankingMetricValue: 1e11, count: 10, change: null },
    ],
  }
}

test('normalizeUsage keeps the newest snapshot and the standard variant only', () => {
  const usage = normalizeUsage(usagePayload(), { limit: 10 })
  assert.equal(usage.at, '2026-11-07 00:00:00')
  assert.deepEqual(usage.models.map((row) => row.slug), ['vendor/paid-20260101', 'vendor/free-small'])
  assert.equal(usage.total, 1.5e12)
  assert.equal(usage.models[0].tokens, 1e12)
  assert.equal(usage.models[0].share, 1e12 / 1.5e12)
  assert.equal(usage.models[0].change, 0.25)
  assert.equal(usage.models[1].change, -0.1)
  assert.equal(usage.models[0].variant, 'standard')
})

test('normalizeUsage tolerates an empty payload and respects the limit', () => {
  assert.deepEqual(normalizeUsage({}), { at: null, total: 0, models: [] })
  assert.deepEqual(normalizeUsage({ data: [] }).models, [])
  assert.equal(normalizeUsage(usagePayload(), { limit: 1 }).models.length, 1)
})

test('baseSlug strips the dated variant and the catalog join is best effort', () => {
  assert.equal(baseSlug('openai/gpt-6-luna-20260922'), 'openai/gpt-6-luna')
  assert.equal(baseSlug('vendor/paid'), 'vendor/paid')
  const index = catalogIndex([
    { id: 'vendor/paid', name: 'Vendor: Paid', author: 'vendor', context_length: 1000 },
    { id: 'vendor/paid:free', name: 'Vendor: Paid (free)', author: 'vendor', is_free: true },
  ])
  assert.equal(findCatalogModel(index, 'vendor/paid-20260101').name, 'Vendor: Paid')
  assert.equal(findCatalogModel(index, 'vendor/paid-20260101', 'free').name, 'Vendor: Paid (free)')
  assert.equal(findCatalogModel(index, 'nobody/gone-20260101'), null)
  assert.equal(findCatalogModel(null, 'vendor/paid-20260101'), null)
})

test('enrichUsage adds catalog metadata and falls back to the slug', () => {
  const index = catalogIndex([{ id: 'vendor/paid', name: 'Vendor: Paid', author: 'vendor', context_length: 1_000_000, is_free: false, prompt_usd_per_1m: 1, completion_usd_per_1m: 2 }])
  const hit = enrichUsage({ slug: 'vendor/paid-20260101', tokens: 5, requests: 1, change: null, share: 0.5 }, index)
  assert.equal(hit.name, 'Vendor: Paid')
  assert.equal(hit.context_length, 1_000_000)
  assert.deepEqual(hit.price, { prompt_usd_per_1m: 1, completion_usd_per_1m: 2 })
  const miss = enrichUsage({ slug: 'nobody/gone', tokens: 1, requests: 0, change: null, share: 0 }, index)
  assert.equal(miss.name, 'nobody/gone')
  assert.equal(miss.price, null)
  assert.equal(miss.author, 'nobody')
})

test('normalizeBenchmarks merges intelligence, coding and agentic by model', () => {
  const raw = {
    data: {
      aaData: {
        intelligence: [
          { permaslug: 'vendor/a-20260101', aa_name: 'A (Max)', score: 70 },
          { permaslug: 'vendor/b-20260101', aa_name: 'B', score: 50 },
        ],
        coding: [
          { permaslug: 'vendor/a-20260101', aa_name: 'A (Max)', score: 65 },
          { permaslug: 'vendor/c-20260101', aa_name: 'C', score: 90 },
        ],
        agentic: [{ permaslug: 'vendor/a-20260101', aa_name: 'A (Max)', score: 40 }],
      },
      valsIndex: { benchmark_version: 'aa-v2' },
    },
  }
  const benchmarks = normalizeBenchmarks(raw)
  assert.equal(benchmarks.benchmark_version, 'aa-v2')
  assert.deepEqual(benchmarks.counts, { intelligence: 2, coding: 2, agentic: 1 })
  assert.equal(benchmarks.models.length, 3)
  assert.equal(benchmarks.models[0].slug, 'vendor/c-20260101')
  const a = benchmarks.models.find((row) => row.slug === 'vendor/a-20260101')
  assert.equal(a.coding, 65)
  assert.equal(a.intelligence, 70)
  assert.equal(a.agentic, 40)
  assert.equal(a.name, 'A (Max)')
})

test('normalizeBenchmarks tolerates an empty payload', () => {
  assert.deepEqual(normalizeBenchmarks({}), {
    benchmark_version: null,
    counts: { intelligence: 0, coding: 0, agentic: 0 },
    models: [],
  })
  assert.equal(enrichBenchmark({ slug: 'vendor/a', name: 'A' }, catalogIndex([])).name, 'A')
  assert.equal(enrichBenchmark({ slug: 'vendor/a', name: 'A' }, catalogIndex([{ id: 'vendor/a', name: 'Catalog A' }])).name, 'Catalog A')
})
