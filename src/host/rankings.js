/**
 * OpenRouter rankings: the model-usage leaderboard and the Artificial Analysis
 * benchmark tables that the website renders on https://openrouter.ai/rankings.
 *
 * The site itself talks to two frontend endpoints (they are used by the page,
 * not part of the documented public API):
 *   - /api/frontend/v1/rankings/models       daily usage snapshot per model
 *   - /api/frontend/v1/rankings/benchmarks   AA scores: intelligence/coding/agentic
 *
 * This module is pure: it takes parsed JSON and returns compact, stable shapes.
 * Network, caching and catalog joins live in service.js.
 */

export const RANKINGS_SOURCES = {
  usage: 'https://openrouter.ai/api/frontend/v1/rankings/models',
  benchmarks: 'https://openrouter.ai/api/frontend/v1/rankings/benchmarks',
}

/** Suffix that marks a dated model variant, e.g. `openai/gpt-6-luna-20260922`. */
const DATE_SUFFIX = /-\d{8}$/

/** Strip the `-YYYYMMDD` suffix so a rankings slug can meet a catalog id. */
export function baseSlug(slug) {
  return String(slug || '').trim().replace(DATE_SUFFIX, '')
}

/**
 * Compact leaderboard from the usage endpoint. The response carries one row
 * per model per day; the newest day is the full leaderboard, older days only
 * describe models that changed, so the latest snapshot is the right basis.
 *
 * @param {{data?: object[]}} raw parsed JSON
 * @param {{limit?: number}} [options]
 */
export function normalizeUsage(raw, { limit = 60 } = {}) {
  const rows = Array.isArray(raw?.data) ? raw.data.filter((row) => row && row.model_permaslug) : []
  const dates = [...new Set(rows.map((row) => String(row.date || '')))].filter(Boolean).sort()
  const at = dates.length ? dates[dates.length - 1] : null
  if (!at) return { at: null, total: 0, models: [] }
  const snapshot = rows.filter((row) => String(row.date) === at && String(row.variant || 'standard') === 'standard')
  const total = snapshot.reduce((sum, row) => sum + (Number(row.rankingMetricValue) || 0), 0)
  const models = snapshot
    .map((row) => ({
      slug: String(row.model_permaslug),
      variant: String(row.variant || 'standard'),
      tokens: Number(row.rankingMetricValue) || 0,
      requests: Number(row.count) || 0,
      // The endpoint reports the day-over-day change as a fraction (-0.29 = −29%).
      change: Number.isFinite(row.change) ? Number(row.change) : null,
      share: total ? (Number(row.rankingMetricValue) || 0) / total : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, Math.min(200, Math.max(1, Number(limit) || 60)))
  return { at, total, models }
}

/**
 * Artificial Analysis benchmark scores merged by model. Scores are 0..100;
 * a model can appear in one, two or all three tables.
 *
 * @param {{data?: {aaData?: object, valsIndex?: object}}} raw parsed JSON
 */
export function normalizeBenchmarks(raw) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : {}
  const aaData = data.aaData && typeof data.aaData === 'object' ? data.aaData : {}
  const bySlug = new Map()
  const collect = (key) => (Array.isArray(aaData[key]) ? aaData[key] : [])
  for (const key of ['intelligence', 'coding', 'agentic']) {
    for (const row of collect(key)) {
      const slug = String(row?.permaslug || row?.uid || '').trim()
      const score = Number(row?.score)
      if (!slug || !Number.isFinite(score)) continue
      const hit = bySlug.get(slug) || { slug, name: String(row?.aa_name || row?.permaslug || slug) }
      hit[key] = score
      bySlug.set(slug, hit)
    }
  }
  const models = [...bySlug.values()].sort((a, b) => (b.coding ?? -1) - (a.coding ?? -1)
    || (b.intelligence ?? -1) - (a.intelligence ?? -1)
    || (b.agentic ?? -1) - (a.agentic ?? -1))
  const version = data.valsIndex && data.valsIndex.benchmark_version
  return {
    benchmark_version: version ? String(version) : null,
    counts: {
      intelligence: models.filter((model) => model.intelligence !== undefined).length,
      coding: models.filter((model) => model.coding !== undefined).length,
      agentic: models.filter((model) => model.agentic !== undefined).length,
    },
    models,
  }
}

/**
 * Catalog index for joining rankings slugs with the local catalog snapshot:
 * exact ids first, then the date-less form, then the `:free` variant.
 *
 * @param {object[]} catalogModels models from the persisted catalog state
 */
export function catalogIndex(catalogModels) {
  const byId = new Map()
  const byBase = new Map()
  for (const model of Array.isArray(catalogModels) ? catalogModels : []) {
    if (!model || !model.id) continue
    byId.set(model.id, model)
    const base = baseSlug(model.id)
    if (!byBase.has(base)) byBase.set(base, model)
  }
  return { byId, byBase }
}

/** Best-effort catalog model for a rankings slug (null when the catalog has none). */
export function findCatalogModel(index, slug, variant = 'standard') {
  if (!index || !slug) return null
  const raw = String(slug)
  if (index.byId.has(raw)) return index.byId.get(raw)
  const base = baseSlug(raw)
  // A free variant of a known model is a separate catalog row: prefer it.
  if (variant === 'free' && index.byId.has(base + ':free')) return index.byId.get(base + ':free')
  if (index.byId.has(base)) return index.byId.get(base)
  if (index.byBase.has(base)) return index.byBase.get(base)
  return null
}

/** Merge a usage row with catalog metadata (name, author, context, price). */
export function enrichUsage(row, index) {
  const model = findCatalogModel(index, row?.slug, row?.variant)
  return {
    ...row,
    name: model?.name || String(row?.slug || ''),
    author: model?.author || String(row?.slug || '').split('/')[0] || '',
    context_length: model?.context_length ?? null,
    is_free: model?.is_free === true,
    price: model
      ? { prompt_usd_per_1m: model.prompt_usd_per_1m ?? null, completion_usd_per_1m: model.completion_usd_per_1m ?? null }
      : null,
  }
}

/** Merge a benchmark row with the catalog name when it is available. */
export function enrichBenchmark(row, index) {
  const model = findCatalogModel(index, row?.slug)
  return {
    ...row,
    name: model?.name || row?.name || String(row?.slug || ''),
    author: model?.author || String(row?.slug || '').split('/')[0] || '',
  }
}
