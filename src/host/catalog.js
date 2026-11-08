/**
 * Pure OpenRouter catalog logic: normalize the public payload, diff it against
 * the previous snapshot, keep a bounded price history, derive discounts and
 * write the event journal. No I/O, no framework imports — the service owns
 * persistence and networking, which keeps this module unit-testable.
 */
import crypto from 'node:crypto'

/** Components compared when a price moves. */
export const PRICE_KEYS = ['prompt_usd_per_1m', 'completion_usd_per_1m']

/** Non-token charges that make a "$0 per token" model not actually free. */
const MONEY_KEYS = ['image', 'image_output', 'audio', 'audio_output', 'web_search', 'request', 'internal_reasoning']

/** Bounded retention shared with the service. */
export const LIMITS = {
  historyPoints: 60,
  historyDays: 30,
  maxEvents: 500,
  maxSyncs: 30,
  removedKeepDays: 90,
  expiringDays: 7,
  noisePct: 0.5,
  hotDropPct: 50,
}

const DAY_MS = 86_400_000

function finiteOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function moneyAmount(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

/** OpenRouter prices are USD per token; the UI shows USD per 1M tokens. */
export function usdPer1m(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return Math.round(number * 1e6 * 1e6) / 1e6
}

/** True when every monetary component of the price is zero. */
export function isFreePricing(pricing = {}) {
  if (usdPer1m(pricing.prompt) !== 0 || usdPer1m(pricing.completion) !== 0) return false
  return MONEY_KEYS.every((key) => moneyAmount(pricing[key]) === 0)
}

function isoFromUnix(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  return new Date(number * 1000).toISOString()
}

function authorFromId(id) {
  const clean = id.replace(/^~/, '')
  const slash = clean.indexOf('/')
  return slash > 0 ? clean.slice(0, slash) : clean
}

/** `:batch` / `:free` variant → base model id, else null. */
export function variantBaseId(id) {
  const match = /:(batch|free)$/.exec(id)
  return match ? id.slice(0, -match[0].length) : null
}

/** Normalize one raw OpenRouter model into our stored record. */
export function normalizeModel(raw, { at, expiringDays = LIMITS.expiringDays } = {}) {
  const pricing = raw?.pricing && typeof raw.pricing === 'object' ? raw.pricing : {}
  const architecture = raw?.architecture && typeof raw.architecture === 'object' ? raw.architecture : {}
  const id = String(raw?.id || '').trim()
  const overrides = Array.isArray(pricing.overrides) ? pricing.overrides : []
  const expiration = raw?.expiration_date ? String(raw.expiration_date) : null
  const expiresIn = expiration ? Date.parse(expiration) - Date.parse(at) : NaN
  return {
    id,
    name: String(raw?.name || id).trim() || id,
    author: authorFromId(id),
    created_at: isoFromUnix(raw?.created),
    first_seen_at: at,
    status: 'active',
    removed_at: null,
    context_length: finiteOrNull(raw?.context_length),
    modality: architecture.modality ? String(architecture.modality) : null,
    input_modalities: stringArray(architecture.input_modalities),
    output_modalities: stringArray(architecture.output_modalities),
    prompt_usd_per_1m: usdPer1m(pricing.prompt),
    completion_usd_per_1m: usdPer1m(pricing.completion),
    is_free: isFreePricing(pricing),
    free_since: null,
    prev: null,
    high_30d: null,
    discount: null,
    price_history: [],
    has_overrides: overrides.length > 0,
    override_count: overrides.length,
    is_batch_variant: /:batch$/.test(id),
    base_id: variantBaseId(id),
    variant_saving_pct: null,
    expiration_date: expiration,
    expiring_soon: Number.isFinite(expiresIn) && expiresIn <= expiringDays * DAY_MS,
    is_alias: id.startsWith('~'),
    hugging_face_id: raw?.hugging_face_id ? String(raw.hugging_face_id) : null,
    description: String(raw?.description || '').slice(0, 280),
  }
}

function priceSnapshot(model) {
  return {
    prompt_usd_per_1m: model?.prompt_usd_per_1m ?? null,
    completion_usd_per_1m: model?.completion_usd_per_1m ?? null,
  }
}

/** Highest price inside the history window (excludes nothing; caller passes points before now). */
export function computeHigh(points, nowMs, days = LIMITS.historyDays) {
  if (!Array.isArray(points) || points.length === 0) return null
  const cutoff = nowMs - days * DAY_MS
  let prompt = null
  let completion = null
  let at = null
  for (const point of points) {
    const time = Date.parse(point?.at || '')
    if (!Number.isFinite(time) || time < cutoff) continue
    if (Number.isFinite(point.p) && (prompt === null || point.p > prompt)) {
      prompt = point.p
      at = point.at
    }
    if (Number.isFinite(point.c) && (completion === null || point.c > completion)) {
      completion = point.c
      if (at === null) at = point.at
    }
  }
  if (prompt === null && completion === null) return null
  return { prompt_usd_per_1m: prompt, completion_usd_per_1m: completion, at }
}

/** Largest relative drop across price components, in percent, or null. */
export function maxDropPct(from, current) {
  if (!from) return null
  let best = null
  for (const key of PRICE_KEYS) {
    const before = from[key]
    const after = current?.[key]
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0 || after < 0) continue
    const pct = ((before - after) / before) * 100
    if (pct <= 0) continue
    if (best === null || pct > best) best = pct
  }
  return best
}

/** Largest signed change across price components (positive = more expensive). */
export function signedChangePct(from, current) {
  if (!from) return null
  let best = null
  for (const key of PRICE_KEYS) {
    const before = from[key]
    const after = current?.[key]
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0 || after < 0) continue
    const pct = ((after - before) / before) * 100
    if (best === null || Math.abs(pct) > Math.abs(best)) best = pct
  }
  return best
}

function sameMoney(a, b) {
  return PRICE_KEYS.every((key) => (a?.[key] ?? null) === (b?.[key] ?? null))
}

/** Discount = drop against the previous sample or the 30-day high; null when under the threshold. */
export function computeDiscount({ prev, highBefore, model, threshold, at, previousDiscount }) {
  const current = priceSnapshot(model)
  const candidates = []
  if (prev) {
    const pct = maxDropPct(priceSnapshot(prev), current)
    if (pct !== null) candidates.push({ pct, basis: 'prev', from: priceSnapshot(prev) })
  }
  if (highBefore) {
    const pct = maxDropPct(highBefore, current)
    if (pct !== null) candidates.push({ pct, basis: '30d_high', from: highBefore })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.pct - a.pct || (a.basis === 'prev' ? -1 : 1))
  const best = candidates[0]
  if (best.pct + 1e-9 < threshold) return null
  const sameBasis = previousDiscount && previousDiscount.basis === best.basis && sameMoney(previousDiscount.from, best.from)
  return {
    pct: Math.round(best.pct + 1e-9),
    basis: best.basis,
    since: sameBasis ? previousDiscount.since || at : at,
    from: best.from,
    to: current,
  }
}

function moneyText(prompt, completion) {
  if ((prompt ?? null) === 0 && (completion ?? null) === 0) return 'бесплатно'
  const format = (value) => {
    if (value === null || value === undefined) return '—'
    const number = Number(value)
    if (!Number.isFinite(number)) return '—'
    if (number === 0) return '0'
    const digits = number >= 1 ? 2 : number >= 0.01 ? 4 : 6
    return String(Number(number.toFixed(digits)))
  }
  return `$${format(prompt)} / $${format(completion)} за 1M`
}

function makeEvent({ at, type, severity, model, modelId = null, modelName = null, title, detail, before = null, after = null }) {
  return {
    id: `evt_${crypto.randomUUID()}`,
    at,
    type,
    severity,
    model_id: modelId || model?.id || null,
    model_name: modelName || model?.name || null,
    title,
    detail,
    before,
    after,
    read: false,
  }
}

function activeCounts(models) {
  const active = (Array.isArray(models) ? models : []).filter((model) => model && model.status !== 'removed')
  return {
    total: active.length,
    free: active.filter((model) => model.is_free).length,
    discounts: active.filter((model) => model.discount).length,
  }
}

function countNew7d(models) {
  const cutoff = Date.now() - 7 * DAY_MS
  return models.filter((model) => {
    const time = Date.parse(model?.created_at || '')
    return Number.isFinite(time) && time >= cutoff
  }).length
}

/**
 * Apply an API snapshot to the stored state: normalize, diff against the
 * previous sample, extend history, derive discounts and append events.
 *
 * @param {object} data mutable stored state
 * @param {unknown[]} apiModels raw `data` array from OpenRouter
 * @param peer `{ at, threshold, intervalHours, startedAt, source }`
 * @returns summary of the sample
 */
export function applyCatalog(data, apiModels, peer) {
  const { at, threshold, intervalHours, startedAt, source } = peer
  const baseline = !Number(data.samples)
  const nowMs = Date.parse(at)
  data.source = source || data.source
  data.interval_hours = intervalHours
  data.discount_threshold_pct = threshold

  const expiringNotified = new Set(
    (Array.isArray(data.events) ? data.events : []).filter((event) => event?.type === 'expiring').map((event) => event.model_id),
  )
  const prior = Array.isArray(data.models) ? data.models.filter((model) => model?.id) : []
  const priorActive = new Map()
  for (const model of prior) if (model.status !== 'removed') priorActive.set(model.id, model)

  const normalized = new Map()
  for (const raw of Array.isArray(apiModels) ? apiModels : []) {
    const id = String(raw?.id || '').trim()
    if (!id || normalized.has(id)) continue
    const model = normalizeModel(raw, { at })
    model.first_seen_at = priorActive.get(id)?.first_seen_at || at
    normalized.set(id, model)
  }

  for (const model of normalized.values()) {
    if (!model.base_id) continue
    const base = normalized.get(model.base_id)
    const basePrice = base?.prompt_usd_per_1m
    const price = model.prompt_usd_per_1m
    if (!Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(price) || price >= basePrice) continue
    model.variant_saving_pct = Math.floor((1 - price / basePrice) * 100)
  }

  const events = []
  const stats = { added: 0, removed: 0, dropped: 0, risen: 0, freeChanged: 0 }

  for (const model of normalized.values()) {
    const prev = priorActive.get(model.id) || null
    const history = Array.isArray(prev?.price_history) ? prev.price_history.slice(-LIMITS.historyPoints) : []
    const highBefore = computeHigh(history, nowMs)
    history.push({ at, p: model.prompt_usd_per_1m, c: model.completion_usd_per_1m })
    while (history.length > LIMITS.historyPoints) history.shift()
    model.price_history = history
    model.high_30d = computeHigh(history, nowMs)

    if (baseline) {
      model.prev = null
      model.free_since = model.is_free ? at : null
    } else if (prev) {
      model.prev = { ...priceSnapshot(prev), at: data.synced_at }
      const wasFree = !!prev.is_free
      if (model.is_free && !wasFree) {
        stats.freeChanged += 1
        model.free_since = at
        events.push(makeEvent({
          at, type: 'became_free', severity: 'hot', model,
          title: `Модель стала бесплатной: ${model.name}`,
          detail: `${model.id} · ${moneyText(prev.prompt_usd_per_1m, prev.completion_usd_per_1m)} → бесплатно`,
          before: priceSnapshot(prev), after: priceSnapshot(model),
        }))
      } else if (!model.is_free && wasFree) {
        stats.freeChanged += 1
        model.free_since = null
        events.push(makeEvent({
          at, type: 'became_paid', severity: 'warn', model,
          title: `Модель стала платной: ${model.name}`,
          detail: `${model.id} · бесплатно → ${moneyText(model.prompt_usd_per_1m, model.completion_usd_per_1m)}`,
          before: priceSnapshot(prev), after: priceSnapshot(model),
        }))
      } else {
        model.free_since = model.is_free ? prev.free_since || at : null
      }

      if (!model.is_free && !wasFree) {
        const change = signedChangePct(prev, model)
        if (change !== null && Math.abs(change) >= LIMITS.noisePct) {
          if (change <= -threshold + 1e-9) {
            stats.dropped += 1
            events.push(makeEvent({
              at, type: 'price_drop', severity: Math.abs(change) >= LIMITS.hotDropPct ? 'hot' : 'info', model,
              title: `Цена снизилась на ${Math.round(Math.abs(change))}%: ${model.name}`,
              detail: `${model.id} · ${moneyText(prev.prompt_usd_per_1m, prev.completion_usd_per_1m)} → ${moneyText(model.prompt_usd_per_1m, model.completion_usd_per_1m)}`,
              before: priceSnapshot(prev), after: priceSnapshot(model),
            }))
          } else if (change >= threshold - 1e-9) {
            stats.risen += 1
            events.push(makeEvent({
              at, type: 'price_rise', severity: 'warn', model,
              title: `Цена выросла на ${Math.round(change)}%: ${model.name}`,
              detail: `${model.id} · ${moneyText(prev.prompt_usd_per_1m, prev.completion_usd_per_1m)} → ${moneyText(model.prompt_usd_per_1m, model.completion_usd_per_1m)}`,
              before: priceSnapshot(prev), after: priceSnapshot(model),
            }))
          }
        }
      }
    } else {
      model.prev = null
      model.free_since = model.is_free ? at : null
      stats.added += 1
      events.push(makeEvent({
        at, type: 'model_added', severity: model.is_free ? 'hot' : 'info', model,
        title: `Новая модель: ${model.name}`,
        detail: `${model.id} · ${model.modality || 'модальность ?'} · ${moneyText(model.prompt_usd_per_1m, model.completion_usd_per_1m)}`,
      }))
    }

    model.discount = baseline || model.is_free
      ? null
      : computeDiscount({ prev, highBefore, model, threshold, at, previousDiscount: prev?.discount || null })

    if (model.expiring_soon && !expiringNotified.has(model.id)) {
      expiringNotified.add(model.id)
      events.push(makeEvent({
        at, type: 'expiring', severity: 'warn', model,
        title: `Модель скоро исчезнет из каталога: ${model.name}`,
        detail: `${model.id} · до ${model.expiration_date}`,
      }))
    }
  }

  const models = []
  const seen = new Set()
  for (const previous of prior) {
    const current = normalized.get(previous.id)
    if (current) {
      models.push(current)
      seen.add(current.id)
      continue
    }
    if (previous.status !== 'removed') {
      stats.removed += 1
      const removed = { ...previous, status: 'removed', removed_at: at }
      models.push(removed)
      events.push(makeEvent({
        at, type: 'model_removed', severity: 'info', model: removed,
        title: `Модель исчезла из каталога: ${removed.name}`,
        detail: `${removed.id} · последняя цена: ${moneyText(removed.prompt_usd_per_1m, removed.completion_usd_per_1m)}`,
        before: priceSnapshot(removed),
      }))
      continue
    }
    const removedAt = Date.parse(previous.removed_at || '')
    if (Number.isFinite(removedAt) && nowMs - removedAt <= LIMITS.removedKeepDays * DAY_MS) models.push(previous)
  }
  for (const model of normalized.values()) if (!seen.has(model.id)) models.push(model)

  data.models = models
  const counts = activeCounts(models)
  const summary = {
    at,
    duration_ms: Math.max(0, Date.now() - (startedAt || Date.now())),
    total: counts.total,
    free: counts.free,
    discounts: counts.discounts,
    added: stats.added,
    removed: stats.removed,
    dropped: stats.dropped,
    risen: stats.risen,
    free_changed: stats.freeChanged,
    events: events.length,
    baseline,
    error: null,
  }
  data.samples = (Number(data.samples) || 0) + 1
  data.baseline_at = baseline ? at : data.baseline_at || at
  data.synced_at = at
  data.attempted_at = at
  data.next_sync_at = new Date(nowMs + Number(intervalHours) * 3_600_000).toISOString()
  data.last_error = null
  data.last_error_at = null
  data.failures = 0
  data.syncs = [
    {
      at,
      ok: true,
      total: counts.total,
      free: counts.free,
      discounts: counts.discounts,
      added: stats.added,
      removed: stats.removed,
      dropped: stats.dropped,
      risen: stats.risen,
      duration_ms: summary.duration_ms,
      error: null,
    },
    ...(Array.isArray(data.syncs) ? data.syncs : []),
  ].slice(0, LIMITS.maxSyncs)
  data.events = [...events, ...(Array.isArray(data.events) ? data.events : [])].slice(0, LIMITS.maxEvents)
  return summary
}

/** Lightweight sync status for the tab header. */
export function buildStatus(data, { inFlight = false, settings = {} } = {}) {
  const models = Array.isArray(data?.models) ? data.models : []
  const active = models.filter((model) => model && model.status !== 'removed')
  const events = Array.isArray(data?.events) ? data.events : []
  const syncedAt = data?.synced_at || null
  const baselineAt = data?.baseline_at || null
  const historyDays = syncedAt && baselineAt
    ? Math.round(((Date.parse(syncedAt) - Date.parse(baselineAt)) / DAY_MS) * 10) / 10
    : 0
  return {
    synced_at: syncedAt,
    attempted_at: data?.attempted_at || null,
    next_sync_at: data?.next_sync_at || null,
    interval_hours: data?.interval_hours ?? settings.intervalHours ?? 24,
    discount_threshold_pct: data?.discount_threshold_pct ?? settings.discountPct ?? 30,
    samples: Number(data?.samples) || 0,
    baseline_at: baselineAt,
    history_days: historyDays,
    in_flight: inFlight,
    last_error: data?.last_error || null,
    last_error_at: data?.last_error_at || null,
    failures: Number(data?.failures) || 0,
    source: data?.source || settings.source || null,
    totals: {
      models: active.length,
      free: active.filter((model) => model.is_free).length,
      discounts: active.filter((model) => model.discount).length,
      overrides: active.filter((model) => model.has_overrides).length,
      new_7d: countNew7d(active),
      unread_events: events.filter((event) => event && !event.read).length,
    },
  }
}

function flag(value) {
  if (value === true || value === 1) return true
  return /^(1|true|yes)$/i.test(String(value ?? ''))
}

function matchesModality(model, modality) {
  const values = [...(model.input_modalities || []), ...(model.output_modalities || [])].map((value) => String(value).toLowerCase())
  if (values.includes(modality)) return true
  return String(model.modality || '').toLowerCase().split(/[^a-z]+/).includes(modality)
}

function compareNullable(a, b, ascending) {
  const emptyA = a === null || a === undefined || !Number.isFinite(a)
  const emptyB = b === null || b === undefined || !Number.isFinite(b)
  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1
  return ascending ? a - b : b - a
}

function comparator(sort) {
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru') || String(a.id).localeCompare(String(b.id))
  if (sort === 'new') return (a, b) => compareNullable(Date.parse(a.created_at || ''), Date.parse(b.created_at || ''), false) || byName(a, b)
  if (sort === 'price_asc') return (a, b) => compareNullable(a.prompt_usd_per_1m, b.prompt_usd_per_1m, true) || compareNullable(a.completion_usd_per_1m, b.completion_usd_per_1m, true) || byName(a, b)
  if (sort === 'price_desc') return (a, b) => compareNullable(a.prompt_usd_per_1m, b.prompt_usd_per_1m, false) || compareNullable(a.completion_usd_per_1m, b.completion_usd_per_1m, false) || byName(a, b)
  if (sort === 'discount') return (a, b) => compareNullable(a.discount?.pct ?? null, b.discount?.pct ?? null, false) || byName(a, b)
  if (sort === 'context') return (a, b) => compareNullable(a.context_length, b.context_length, false) || byName(a, b)
  return byName
}

/** Filtered and sorted model list for the tab. */
export function listModels(data, filters = {}) {
  const includeRemoved = flag(filters.include_removed)
  let models = (Array.isArray(data?.models) ? data.models : []).filter((model) => model && (includeRemoved || model.status !== 'removed'))
  const query = String(filters.q || '').trim().toLowerCase()
  if (query) models = models.filter((model) => `${model.id} ${model.name} ${model.author}`.toLowerCase().includes(query))
  if (flag(filters.free)) models = models.filter((model) => model.is_free === true)
  if (flag(filters.discount)) models = models.filter((model) => !!model.discount)
  const modality = String(filters.modality || '').trim().toLowerCase()
  if (modality) models = models.filter((model) => matchesModality(model, modality))
  models = [...models].sort(comparator(filters.sort))
  const rawLimit = Number(filters.limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(2000, Math.floor(rawLimit)) : 1000
  return models.slice(0, limit)
}

/** Event journal, newest first. */
export function listEvents(data, { limit = 100, unread = false, type = '' } = {}) {
  const all = (Array.isArray(data?.events) ? data.events : []).filter(Boolean)
  const unreadCount = all.filter((event) => !event.read).length
  let events = all
  const typeFilter = String(type || '').trim()
  if (typeFilter) events = events.filter((event) => event.type === typeFilter)
  if (flag(unread)) events = events.filter((event) => !event.read)
  const rawLimit = Number(limit)
  const bound = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(500, Math.floor(rawLimit)) : 100
  return { events: events.slice(0, bound), unread: unreadCount }
}

/** Mark events read; returns the remaining unread count. */
export function markEventsRead(data, input = {}) {
  const ids = Array.isArray(input.ids) ? new Set(input.ids.map((id) => String(id))) : null
  const all = input.all === true || input.all === '1' || input.all === 1 || input.all === 'true'
  const events = (Array.isArray(data?.events) ? data.events : []).filter(Boolean)
  if (!all && !ids) return { unread: events.filter((event) => !event.read).length, marked: 0 }
  let marked = 0
  for (const event of events) {
    if (event.read) continue
    if (!all && !ids.has(event.id)) continue
    event.read = true
    marked += 1
  }
  return { unread: events.filter((event) => !event.read).length, marked }
}

/** A free model the chat protocol can actually run: text in, text out. */
export function isFreeChatModel(model) {
  if (!model || model.is_free !== true || model.status === 'removed') return false
  const input = Array.isArray(model.input_modalities) ? model.input_modalities : []
  const output = Array.isArray(model.output_modalities) ? model.output_modalities : []
  return input.includes('text') && output.includes('text')
}

/** Free chat models ordered by the largest context window first. */
export function freeChatModels(data, { limit = 20 } = {}) {
  return (Array.isArray(data?.models) ? data.models : [])
    .filter(isFreeChatModel)
    .sort((a, b) => (b.context_length || 0) - (a.context_length || 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(1, limit))
}
