/**
 * Host-side catalog service: fetches the public OpenRouter catalog, persists a
 * bounded snapshot with a price history, refreshes every 24 hours, and routes
 * the current session to a free model that actually answers ("Едем на халяву").
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { applyCatalog, buildStatus, freeChatModels, listEvents, listModels, markEventsRead, LIMITS } from './catalog.js'
import { emptyState, readState, writeState, withStateLock } from './state.js'
import { generationDir, legacyStateFilePath, rankingsFilePath, stateFilePath } from './home.js'
import { ensureProviderModel, ensureProviderRoute } from './provider.js'
import { creditsUrl, normalizeCredits } from './balance.js'
import {
  IMAGE_GENERATE_PATH,
  IMAGE_MODELS_PATH,
  SPEECH_GENERATE_PATH,
  SPEECH_MODELS_PATH,
  VIDEO_MODELS_PATH,
  VIDEO_SUBMIT_PATH,
  estimateVideoCost,
  extensionFor,
  imageRequestBody,
  mediaTypeFor,
  normalizeImageModels,
  normalizeSpeechModels,
  normalizeVideoModels,
  parseImageResponse,
  parseVideoResponse,
  safeFileName,
  speechRequestBody,
  videoRequestBody,
} from './generation.js'
import {
  RANKINGS_SOURCES,
  catalogIndex,
  enrichBenchmark,
  enrichUsage,
  normalizeBenchmarks,
  normalizeUsage,
} from './rankings.js'

const DEFAULT_SOURCE = 'https://openrouter.ai/api/v1/models'
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const TICK_MS = 5 * 60_000
const RETRY_MS = 60 * 60_000
const PING_BATCH = 3

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

/** Normalize the row config shared by the bundle patch and user overrides. */
export function normalizeConfig(raw = {}) {
  return {
    provider: String(raw.provider || 'openrouter'),
    providerEntryId: String(raw.providerEntryId || 'llm-pi-ai'),
    intervalHours: clampNumber(raw.intervalHours, 1, 24 * 30, 24),
    discountPct: clampNumber(raw.discountPct, 1, 100, 30),
    apiKeyRef: String(raw.apiKeyRef || 'OPENROUTER_API_KEY'),
    source: String(raw.source || process.env.OPENROUTER_MODELS_URL || DEFAULT_SOURCE),
    baseURL: String(raw.baseURL || process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    maxCandidates: clampNumber(raw.maxCandidates, 1, 12, 6),
    pingTimeoutMs: clampNumber(raw.pingTimeoutMs, 3_000, 60_000, 20_000),
    syncTimeoutMs: clampNumber(raw.syncTimeoutMs, 5_000, 120_000, 30_000),
    journalDays: clampNumber(raw.journalDays, 1, 3_650, 90),
    autoProvision: raw.autoProvision !== false,
    stateFile: raw.stateFile ? String(raw.stateFile) : undefined,
    // Rankings are derived data with a short TTL (hours) and a bounded table size.
    rankingsHours: clampNumber(raw.rankingsHours, 1, 24 * 30, 6),
    rankingsLimit: clampNumber(raw.rankingsLimit, 5, 200, 60),
    rankingsFile: raw.rankingsFile ? String(raw.rankingsFile) : undefined,
    // Balance is small, read-only data: a short in-memory TTL (0 = always fetch).
    balanceSeconds: clampNumber(raw.balanceSeconds, 0, 3_600, 60),
    // Media generation: where files land, how big they may be, model-cache TTL.
    generationDir: raw.generationDir ? String(raw.generationDir) : undefined,
    generationMaxBytes: clampNumber(raw.generationMaxBytes, 100_000, 512_000_000, 100_000_000),
    generationModelsHours: clampNumber(raw.generationModelsHours, 1, 24 * 30, 6),
  }
}

function failureEvent(at, message) {
  return {
    id: `evt_${crypto.randomUUID()}`,
    at,
    type: 'sync_failed',
    severity: 'warn',
    model_id: null,
    model_name: null,
    title: 'Не удалось обновить каталог моделей OpenRouter',
    detail: message,
    before: null,
    after: null,
    read: false,
  }
}

/**
 * @param {object} ctx Cordis plugin context (may be a bare faked object in tests)
 * @param {object} rawConfig row config
 * @param {{ fetchImpl?: Function, now?: () => Date, resolveApiKey?: Function }} [options] test seams
 */
export function createCatalogService(ctx, rawConfig = {}, options = {}) {
  const settings = normalizeConfig(rawConfig)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const clock = options.now || (() => new Date())
  const file = settings.stateFile || stateFilePath()
  const rankingsFile = settings.rankingsFile || rankingsFilePath()
  const generatedDir = settings.generationDir || generationDir()
  const logger = ctx?.logger

  // No long-lived in-memory snapshot: several DSH profiles may share one
  // DSH_HOME, so every operation re-reads the file (under a lock when writing).
  let inflight = null
  let rankingsInflight = null
  let balanceCache = null
  const generationModelsCache = { image: null, video: null, speech: null }
  let timer = null
  let disposed = false

  const log = (message) => {
    try {
      logger?.info?.(`[openrouter-models] ${message}`)
    } catch {
      /* logging must never break the service */
    }
  }
  const nowIso = () => clock().toISOString()

  async function ensureState() {
    // One-time migration from the pre-0.4.0 state directory; the next write
    // lands on the new path, so the legacy file becomes stale on purpose.
    const stored = (await readState(file)) || (settings.stateFile ? null : await readState(legacyStateFilePath()))
    return stored || emptyState({
      source: settings.source,
      interval_hours: settings.intervalHours,
      discount_threshold_pct: settings.discountPct,
      journal_days: settings.journalDays,
    })
  }

  async function fetchJson(url) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.syncTimeoutMs)
    try {
      const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: controller.signal })
      const text = await response.text()
      if (!response.ok) throw new Error(`OpenRouter: HTTP ${response.status} — ${String(text).slice(0, 200)}`)
      try {
        return JSON.parse(text)
      } catch {
        throw new Error('OpenRouter: ответ не является JSON')
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`OpenRouter: таймаут ${Math.round(settings.syncTimeoutMs / 1000)} с`)
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async function fetchCatalog() {
    const payload = await fetchJson(settings.source)
    if (!payload || !Array.isArray(payload.data)) throw new Error('OpenRouter: в ответе нет массива data')
    return payload.data
  }

  async function recordFailure(error, at, startedAt) {
    return withStateLock(file, async () => {
      const current = await ensureState()
      const firstInSeries = !Number(current.failures)
    current.failures = (Number(current.failures) || 0) + 1
    current.attempted_at = at
    current.last_error = String(error?.message || 'Не удалось обновить каталог').slice(0, 500)
    current.last_error_at = at
    current.next_sync_at = new Date(Date.parse(at) + RETRY_MS).toISOString()
    if (firstInSeries) current.events = [failureEvent(at, current.last_error), ...(Array.isArray(current.events) ? current.events : [])].slice(0, LIMITS.maxEvents)
    current.syncs = [
      {
        at,
        ok: false,
        total: (current.models || []).filter((model) => model.status !== 'removed').length,
        free: (current.models || []).filter((model) => model.status !== 'removed' && model.is_free).length,
        discounts: (current.models || []).filter((model) => model.status !== 'removed' && model.discount).length,
        added: 0,
        removed: 0,
        dropped: 0,
        risen: 0,
        duration_ms: Math.max(0, Date.now() - (startedAt || Date.now())),
        error: current.last_error,
      },
      ...(Array.isArray(current.syncs) ? current.syncs : []),
    ].slice(0, LIMITS.maxSyncs)
      await writeState(file, current)
    })
  }

  async function runSync() {
    const startedAt = Date.now()
    const at = nowIso()
    let apiModels
    try {
      apiModels = await fetchCatalog()
    } catch (error) {
      await recordFailure(error, at, startedAt)
      throw error
    }
    return withStateLock(file, async () => {
      const current = await ensureState()
      const summary = applyCatalog(current, apiModels, {
        at,
        threshold: settings.discountPct,
        intervalHours: settings.intervalHours,
        startedAt,
        source: settings.source,
        journalDays: settings.journalDays,
      })
      current.journal_days = settings.journalDays
      await writeState(file, current)
      log(`каталог обновлён: ${summary.total} моделей, бесплатных ${summary.free}, событий ${summary.events}`)
      return summary
    })
  }

  /** Single-flight refresh; the second caller joins the first request. */
  function syncNow() {
    if (inflight) return inflight
    const started = runSync()
    inflight = started
    const clear = () => {
      if (inflight === started) inflight = null
    }
    started.then(clear, clear)
    return started
  }

  function isDue(state) {
    const next = Date.parse(state?.next_sync_at || '')
    if (!state?.synced_at || !Number.isFinite(next)) return true
    return next <= clock().getTime()
  }

  async function scheduleNext() {
    if (disposed) return
    clearTimeout(timer)
    let next = NaN
    try {
      next = Date.parse((await ensureState()).next_sync_at || '')
    } catch {
      /* a transient read failure retries at once */
    }
    const delay = Number.isFinite(next) ? Math.max(0, next - clock().getTime()) : 0
    timer = setTimeout(() => {
      void tick()
    }, delay + 500)
    timer?.unref?.()
  }

  async function tick() {
    if (disposed) return
    try {
      const current = await ensureState()
      if (isDue(current)) await syncNow()
    } catch (error) {
      log(`автосинхронизация не удалась: ${error?.message || error}`)
    } finally {
      await scheduleNext()
    }
  }

  async function resolveApiKey() {
    if (options.resolveApiKey) return { value: String((await options.resolveApiKey()) || ''), source: 'test' }
    const credentials = ctx?.get?.('credentials')
    if (credentials?.resolve) {
      try {
        const hit = await credentials.resolve(settings.apiKeyRef)
        if (hit?.value) return { value: String(hit.value), source: hit.source || 'credentials' }
      } catch {
        /* fall back to the process environment */
      }
    }
    const env = String(process.env[settings.apiKeyRef] || '').trim()
    return { value: env, source: env ? 'env' : 'none' }
  }

  async function pingModel(modelId, key) {
    const startedAt = clock().getTime()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.pingTimeoutMs)
    const latency = () => clock().getTime() - startedAt
    try {
      const response = await fetchImpl(`${settings.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          max_tokens: 8,
          temperature: 0,
        }),
        signal: controller.signal,
      })
      const text = await response.text()
      if (!response.ok) return { ok: false, latency_ms: latency(), status: response.status, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
      let payload = null
      try {
        payload = JSON.parse(text)
      } catch {
        /* a 200 with a non-JSON body still proves the model answered */
      }
      return { ok: true, latency_ms: latency(), status: response.status, reply: String(payload?.choices?.[0]?.message?.content ?? '').slice(0, 120) }
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, latency_ms: latency(), error: `таймаут ${Math.round(settings.pingTimeoutMs / 1000)} с` }
      return { ok: false, latency_ms: latency(), error: String(error?.message || error) }
    } finally {
      clearTimeout(timeout)
    }
  }

  /** Wait for a live agent whose model controller is installed. */
  async function waitForAgent(sessionId, timeoutMs = 2_500) {
    const agents = ctx?.get?.('agents')
    if (!agents) throw new Error('в этом профиле нет реестра агентов')
    const startedAt = Date.now()
    let agent = agents.get(sessionId)
    while ((!agent || !agent.model) && Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 120))
      agent = agents.get(sessionId)
    }
    if (!agent) throw new Error(`сессия ${sessionId} не найдена`)
    if (!agent.model || typeof agent.model.select !== 'function') {
      throw new Error('агент сессии ещё не готов — повторите через секунду')
    }
    return agent
  }

  async function selectSessionModel(sessionId, provider, model) {
    const llm = ctx?.get?.('llm')
    if (!llm) throw new Error('в этом профиле нет LLM-сервиса')
    if (!sessionId) throw new Error('не передан id сессии')
    await llm.resolveCallConfig({ provider, model })
    const agent = await waitForAgent(sessionId)
    agent.model.select({ provider, model })
  }

  function winnerSummary(result) {
    return {
      provider: settings.provider,
      model: result.model.id,
      name: result.model.name,
      context_length: result.model.context_length ?? null,
      latency_ms: result.latency_ms,
      status: result.status ?? null,
      reply: result.reply ?? '',
      price: 'бесплатно',
    }
  }

  /**
   * Route one catalog model into the current session: enable it on the
   * provider route when missing, then apply the selection. Used by the
   * composer's catalog menu (no ping, no free-model filtering).
   */
  async function useModel(input = {}) {
    const modelId = String(input?.modelId || input?.model || '').trim()
    if (!modelId) return { ok: false, error: 'не передана модель' }
    const current = await ensureState()
    const model = (Array.isArray(current.models) ? current.models : [])
      .find((item) => item?.id === modelId && item.status !== 'removed')
    if (!model) return { ok: false, error: `модель «${modelId}» не найдена в каталоге` }
    try {
      const { changed } = await ensureProviderModel(ctx, {
        provider: settings.provider,
        entryId: settings.providerEntryId,
        model,
      })
      await selectSessionModel(input.sessionId, settings.provider, modelId)
      log(`модель выбрана вручную: ${modelId}${changed ? ' (добавлена в провайдер)' : ''}`)
      return {
        ok: true,
        provider: settings.provider,
        config_changed: changed,
        model: {
          id: model.id,
          name: model.name,
          context_length: model.context_length ?? null,
          is_free: !!model.is_free,
          prompt_usd_per_1m: model.prompt_usd_per_1m,
          completion_usd_per_1m: model.completion_usd_per_1m,
        },
      }
    } catch (error) {
      return { ok: false, error: String(error?.message || error) }
    }
  }

  /**
   * «Едем на халяву»: take free chat models ordered by context window, ping
   * them until one answers, enable that model on the harness OpenRouter route
   * when needed, and switch the current session to it.
   */
  async function autoRoute(input = {}) {
    const current = await ensureState()
    const attempts = []
    const attempted = (result) => ({
      model: result.model.id,
      name: result.model.name,
      context_length: result.model.context_length ?? null,
      ok: !!result.ok,
      latency_ms: result.latency_ms ?? null,
      status: result.status ?? null,
      error: result.error ?? null,
      reply: result.reply ?? null,
    })

    if (!freeChatModels(current, { limit: 1 }).length) {
      try {
        await syncNow()
      } catch {
        /* the empty-catalog message below is more useful */
      }
    }
    const candidates = freeChatModels(await ensureState(), { limit: settings.maxCandidates })
    if (candidates.length === 0) {
      return { ok: false, error: 'В каталоге нет бесплатных chat-моделей. Обновите каталог.', attempts }
    }

    const key = await resolveApiKey()
    if (!key.value) {
      return {
        ok: false,
        error: `Нет ключа OpenRouter: добавьте «${settings.apiKeyRef}» в credentials DSH или в окружение`,
        attempts,
        candidates: candidates.map(({ id, name, context_length }) => ({ model: id, name, context_length })),
      }
    }

    let winner = null
    for (let index = 0; index < candidates.length && !winner; index += PING_BATCH) {
      const batch = candidates.slice(index, index + PING_BATCH)
      const results = await Promise.all(batch.map(async (model) => ({ model, ...(await pingModel(model.id, key.value)) })))
      attempts.push(...results.map(attempted))
      winner = results.find((result) => result.ok) || null
    }
    if (!winner) {
      return { ok: false, error: 'Ни одна бесплатная модель не ответила на пинг', attempts }
    }

    const summary = winnerSummary(winner)
    try {
      const { changed } = await ensureProviderModel(ctx, {
        provider: settings.provider,
        entryId: settings.providerEntryId,
        model: winner.model,
      })
      summary.enabled = changed || true
      summary.config_changed = changed
    } catch (error) {
      return {
        ok: false,
        error: `Пинг успешен, но модель не включилась в провайдера «${settings.provider}»: ${error?.message || error}`,
        winner: summary,
        attempts,
      }
    }

    try {
      await selectSessionModel(input.sessionId, settings.provider, winner.model.id)
    } catch (error) {
      return {
        ok: false,
        error: `Модель «${winner.model.id}» включена, но не выбрана в сессии: ${error?.message || error}`,
        winner: summary,
        attempts,
      }
    }

    log(`едем на халяву: ${winner.model.id} (${summary.context_length ?? '?'} токенов, пинг ${summary.latency_ms} мс)`)
    return { ok: true, routed: summary, attempts, settings: { provider: settings.provider, interval_hours: settings.intervalHours } }
  }

  async function status() {
    const current = await ensureState()
    return buildStatus(current, {
      inFlight: !!inflight,
      settings: { intervalHours: settings.intervalHours, discountPct: settings.discountPct, journalDays: settings.journalDays, source: settings.source },
    })
  }

  async function models(filters = {}) {
    const current = await ensureState()
    return listModels(current, filters)
  }

  async function events(filters = {}) {
    const current = await ensureState()
    return listEvents(current, filters)
  }

  async function readEvents(input = {}) {
    return withStateLock(file, async () => {
      const current = await ensureState()
      const result = markEventsRead(current, input)
      if (result.marked > 0) await writeState(file, current)
      return result
    })
  }

  /**
   * Usage leaderboard + benchmark tables, cached in rankings.json for
   * `rankingsHours`. `refresh: true` forces a fetch; a failed refresh keeps the
   * previous snapshot and reports `stale: true` instead of an empty view.
   */
  async function refreshRankings(previous) {
    const at = nowIso()
    try {
      const [usageRaw, benchmarkRaw] = await Promise.all([
        fetchJson(RANKINGS_SOURCES.usage),
        fetchJson(RANKINGS_SOURCES.benchmarks),
      ])
      const current = await ensureState()
      const index = catalogIndex(current.models)
      const usage = normalizeUsage(usageRaw, { limit: settings.rankingsLimit })
      usage.models = usage.models.map((row) => enrichUsage(row, index))
      const benchmarks = normalizeBenchmarks(benchmarkRaw)
      benchmarks.models = benchmarks.models.map((row) => enrichBenchmark(row, index))
      const payload = {
        schema_version: 1,
        at,
        source: { usage: RANKINGS_SOURCES.usage, benchmarks: RANKINGS_SOURCES.benchmarks },
        usage,
        benchmarks,
        limits: { hours: settings.rankingsHours, limit: settings.rankingsLimit },
      }
      await writeState(rankingsFile, payload)
      log(`рейтинги обновлены: ${usage.models.length} моделей, бенчмарков ${benchmarks.models.length}`)
      return { ...payload, cached: false, stale: false }
    } catch (error) {
      const message = String(error?.message || error)
      log(`рейтинги не обновились: ${message}`)
      if (previous) return { ...previous, cached: true, stale: true, error: message }
      return {
        schema_version: 1,
        at: null,
        usage: { at: null, total: 0, models: [] },
        benchmarks: { benchmark_version: null, counts: { intelligence: 0, coding: 0, agentic: 0 }, models: [] },
        cached: false,
        stale: true,
        error: message,
      }
    }
  }

  function rankings(input = {}) {
    const refresh = input?.refresh === true || input?.refresh === '1' || input?.refresh === 'true'
    const read = async () => {
      const cached = await readState(rankingsFile)
      const ageMs = cached?.at ? clock().getTime() - Date.parse(cached.at) : Number.POSITIVE_INFINITY
      const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < settings.rankingsHours * 3_600_000
      if (cached && fresh && !refresh) return { ...cached, cached: true, stale: false }
      if (rankingsInflight) return rankingsInflight
      const started = refreshRankings(cached)
      rankingsInflight = started
      const clear = () => {
        if (rankingsInflight === started) rankingsInflight = null
      }
      started.then(clear, clear)
      return started
    }
    return read()
  }

  /**
   * OpenRouter credit balance for the current API key. The key never leaves the
   * host process. Results are cached for `balanceSeconds`; a missing key or a
   * failed request returns `ok: false` with a reason instead of throwing.
   */
  async function balance(input = {}) {
    const force = input?.refresh === true || input?.refresh === '1' || input?.refresh === 'true'
    const nowMs = clock().getTime()
    const ttlMs = settings.balanceSeconds * 1_000
    if (!force && balanceCache && nowMs - balanceCache.atMs < ttlMs) {
      return { ...balanceCache.value, cached: true }
    }
    const key = await resolveApiKey()
    if (!key.value) {
      const value = {
        ok: false,
        reason: 'no_key',
        error: `Нет ключа OpenRouter (${settings.apiKeyRef}) — баланс недоступен`,
        at: nowIso(),
      }
      balanceCache = { atMs: nowMs, value }
      return { ...value, cached: false }
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.syncTimeoutMs)
    try {
      const response = await fetchImpl(creditsUrl(settings.baseURL), {
        headers: { accept: 'application/json', authorization: `Bearer ${key.value}` },
        signal: controller.signal,
      })
      const text = await response.text()
      if (!response.ok) throw new Error(`OpenRouter: HTTP ${response.status} — ${String(text).slice(0, 200)}`)
      let payload = null
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error('OpenRouter: ответ не является JSON')
      }
      const value = { ok: true, ...normalizeCredits(payload), source: key.source, at: nowIso() }
      balanceCache = { atMs: nowMs, value }
      return { ...value, cached: false }
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? `OpenRouter: таймаут ${Math.round(settings.syncTimeoutMs / 1000)} с`
        : String(error?.message || error)
      // Failures are not cached: the next poll retries the request.
      return { ok: false, reason: 'error', error: message, at: nowIso(), cached: false }
    } finally {
      clearTimeout(timeout)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Media generation: images, video jobs, speech. Key stays host-side.  */
  /* ------------------------------------------------------------------ */

  function truthy(value) {
    return value === true || value === 1 || value === '1' || value === 'true'
  }

  /** Authorized OpenRouter request; returns parsed JSON, a buffer, or an error. */
  async function generationRequest(apiPath, { method = 'GET', body, binary = false, accept = 'application/json' } = {}) {
    const key = await resolveApiKey()
    if (!key.value) {
      return { ok: false, reason: 'no_key', error: `Нет ключа OpenRouter (${settings.apiKeyRef}) — генерация недоступна` }
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.syncTimeoutMs)
    try {
      const response = await fetchImpl(`${settings.baseURL}${apiPath}`, {
        method,
        headers: {
          accept,
          authorization: `Bearer ${key.value}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      if (binary) {
        const buffer = Buffer.from(await response.arrayBuffer())
        if (!response.ok) throw new Error(`OpenRouter: HTTP ${response.status} — ${buffer.toString('utf8').slice(0, 200)}`)
        return { ok: true, buffer, contentType: response.headers.get('content-type') || 'application/octet-stream' }
      }
      const text = await response.text()
      if (!response.ok) throw new Error(`OpenRouter: HTTP ${response.status} — ${String(text).slice(0, 200)}`)
      try {
        return { ok: true, payload: JSON.parse(text) }
      } catch {
        throw new Error('OpenRouter: ответ не является JSON')
      }
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? `OpenRouter: таймаут ${Math.round(settings.syncTimeoutMs / 1000)} с`
        : String(error?.message || error)
      return { ok: false, reason: 'error', error: message }
    } finally {
      clearTimeout(timeout)
    }
  }

  /** Write generated bytes next to the state and describe the served file. */
  async function saveGenerated({ base64, buffer, extension, prefix }) {
    const bytes = buffer || Buffer.from(String(base64 || ''), 'base64')
    if (!bytes.length) throw new Error('OpenRouter вернул пустой файл')
    if (bytes.length > settings.generationMaxBytes) {
      throw new Error(`файл больше ${Math.round(settings.generationMaxBytes / 1_000_000)} МБ — сохранение отменено`)
    }
    await fs.mkdir(generatedDir, { recursive: true })
    const ext = String(extension || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
    const name = safeFileName(`${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}.${ext}`)
    const filePath = path.join(generatedDir, name)
    await fs.writeFile(filePath, bytes)
    return {
      name,
      bytes: bytes.length,
      mediaType: mediaTypeFor(ext),
      url: `/openrouter-explorer-free/generated/${encodeURIComponent(name)}`,
    }
  }

  /** Model lists for the generation pickers (cached for `generationModelsHours`). */
  async function generationModels(input = {}) {
    const kind = ['image', 'video', 'speech'].includes(String(input.kind || 'image')) ? String(input.kind || 'image') : 'image'
    const refresh = truthy(input.refresh)
    const cached = generationModelsCache[kind]
    if (!refresh && cached && Date.now() - cached.at < settings.generationModelsHours * 3_600_000) {
      return { ok: true, kind, at: new Date(cached.at).toISOString(), models: cached.models, cached: true }
    }
    const apiPath = kind === 'image' ? IMAGE_MODELS_PATH : kind === 'video' ? VIDEO_MODELS_PATH : SPEECH_MODELS_PATH
    const result = await generationRequest(apiPath)
    if (!result.ok) return { ok: false, kind, error: result.error, reason: result.reason }
    const models = kind === 'image'
      ? normalizeImageModels(result.payload)
      : kind === 'video'
        ? normalizeVideoModels(result.payload)
        : normalizeSpeechModels(result.payload)
    generationModelsCache[kind] = { at: Date.now(), models }
    return { ok: true, kind, at: new Date().toISOString(), models }
  }

  async function generateImage(input = {}) {
    let body
    try {
      body = imageRequestBody(input)
    } catch (error) {
      return { ok: false, error: error?.message || String(error) }
    }
    const result = await generationRequest(IMAGE_GENERATE_PATH, { method: 'POST', body })
    if (!result.ok) return { ok: false, error: result.error, reason: result.reason }
    const parsed = parseImageResponse(result.payload)
    if (!parsed.images.length) return { ok: false, error: 'OpenRouter не вернул изображение' }
    const files = []
    for (const [index, image] of parsed.images.entries()) {
      const extension = extensionFor(image.mediaType, 'png')
      files.push(await saveGenerated({ base64: image.base64, extension, prefix: `image-${index + 1}` }))
    }
    log(`изображение сгенерировано: ${files.map((file) => file.name).join(', ')}`)
    return { ok: true, kind: 'image', model: body.model, prompt: body.prompt, files, cost: parsed.cost }
  }

  async function generateVideo(input = {}) {
    let body
    try {
      body = videoRequestBody(input)
    } catch (error) {
      return { ok: false, error: error?.message || String(error) }
    }
    const result = await generationRequest(VIDEO_SUBMIT_PATH, { method: 'POST', body })
    if (!result.ok) return { ok: false, error: result.error, reason: result.reason }
    const job = parseVideoResponse(result.payload)
    if (!job.id) return { ok: false, error: 'OpenRouter не вернул id задачи' }
    const model = (generationModelsCache.video?.models || []).find((item) => item.id === body.model)
    return {
      ok: true,
      kind: 'video',
      model: body.model,
      prompt: body.prompt,
      job,
      estimate: model ? estimateVideoCost(model.pricing_skus, { resolution: body.resolution, duration: body.duration }) : null,
    }
  }

  async function videoJob(input = {}) {
    const id = String(input.id || '').trim()
    if (!id) return { ok: false, error: 'не передан id задачи' }
    const result = await generationRequest(`/videos/${encodeURIComponent(id)}`)
    if (!result.ok) return { ok: false, error: result.error, reason: result.reason }
    return { ok: true, kind: 'video', job: parseVideoResponse(result.payload) }
  }

  /** Download the finished MP4 once and serve it from our own generated dir. */
  async function videoContent(input = {}) {
    const id = String(input.id || '').trim()
    if (!id) return { ok: false, error: 'не передан id задачи' }
    const index = Math.max(0, Number(input.index) || 0)
    const result = await generationRequest(`/videos/${encodeURIComponent(id)}/content?index=${index}`, { binary: true, accept: 'video/mp4' })
    if (!result.ok) return { ok: false, error: result.error, reason: result.reason }
    let extension = extensionFor(result.contentType, 'mp4')
    if (!['mp4', 'webm', 'mov'].includes(extension)) extension = 'mp4'
    const file = await saveGenerated({ buffer: result.buffer, extension, prefix: `video-${id.slice(0, 24)}` })
    log(`видео сохранено: ${file.name} (${file.bytes} байт)`)
    return { ok: true, kind: 'video', file }
  }

  async function synthesizeSpeech(input = {}) {
    let body
    try {
      body = speechRequestBody(input)
    } catch (error) {
      return { ok: false, error: error?.message || String(error) }
    }
    const result = await generationRequest(SPEECH_GENERATE_PATH, {
      method: 'POST',
      body,
      binary: true,
      accept: body.response_format === 'mp3' ? 'audio/mpeg' : 'application/octet-stream',
    })
    if (!result.ok) return { ok: false, error: result.error, reason: result.reason }
    let extension = extensionFor(result.contentType, body.response_format || 'mp3')
    if (extension === 'bin') extension = body.response_format === 'pcm' ? 'pcm' : 'mp3'
    const file = await saveGenerated({ buffer: result.buffer, extension, prefix: 'speech' })
    return { ok: true, kind: 'speech', model: body.model, file, cost: null }
  }

  /** Recently generated files, newest first. */
  async function generatedFiles() {
    try {
      const names = await fs.readdir(generatedDir)
      const files = []
      for (const name of names) {
        if (name.startsWith('.')) continue
        const stat = await fs.stat(path.join(generatedDir, name)).catch(() => null)
        if (!stat || !stat.isFile()) continue
        const extension = path.extname(name).slice(1).toLowerCase()
        files.push({
          name,
          bytes: stat.size,
          at: new Date(stat.mtimeMs).toISOString(),
          mediaType: mediaTypeFor(extension),
          url: `/openrouter-explorer-free/generated/${encodeURIComponent(name)}`,
        })
      }
      files.sort((a, b) => b.at.localeCompare(a.at))
      return files.slice(0, 50)
    } catch {
      return []
    }
  }

  /** One generated file for the media route; never escapes the generated dir. */
  async function generatedFile(name) {
    const safe = safeFileName(name)
    const filePath = path.join(generatedDir, safe)
    const stat = await fs.stat(filePath).catch(() => null)
    if (!stat || !stat.isFile()) return null
    const extension = path.extname(safe).slice(1).toLowerCase()
    return { path: filePath, name: safe, bytes: stat.size, mediaType: mediaTypeFor(extension) }
  }

  async function settingsView() {
    return {
      provider: settings.provider,
      provider_entry: settings.providerEntryId,
      interval_hours: settings.intervalHours,
      discount_pct: settings.discountPct,
      source: settings.source,
      base_url: settings.baseURL,
      api_key_ref: settings.apiKeyRef,
      max_candidates: settings.maxCandidates,
      journal_days: settings.journalDays,
      auto_provision: settings.autoProvision,
      state_file: file,
      rankings_hours: settings.rankingsHours,
      rankings_limit: settings.rankingsLimit,
      rankings_file: rankingsFile,
      balance_seconds: settings.balanceSeconds,
      credits_url: creditsUrl(settings.baseURL),
      generation_dir: generatedDir,
      generation_max_mb: Math.round(settings.generationMaxBytes / 1_000_000),
      generation_models_hours: settings.generationModelsHours,
    }
  }

  let started = false

  function stop() {
    disposed = true
    clearTimeout(timer)
  }

  function start() {
    if (started) return stop
    started = true
    void (async () => {
      try {
        const state = await ensureState()
        // Connect the OpenRouter route from the credential reference when the
        // profile has none. Never selects a model, never changes the default.
        if (settings.autoProvision) {
          try {
            const provisioned = await ensureProviderRoute(ctx, {
              provider: settings.provider,
              entryId: settings.providerEntryId,
              apiKeyRef: settings.apiKeyRef,
              baseURL: settings.baseURL,
            })
            if (provisioned.created) log(`провайдер «${settings.provider}» подключён (ключ из credentials)`)
            else if (provisioned.reason) log(`провайдер «${settings.provider}» не подключён: ${provisioned.reason}`)
          } catch (error) {
            log(`не удалось подключить провайдера: ${error?.message || error}`)
          }
        }
        if (isDue(state)) await syncNow()
      } catch (error) {
        log(`стартовая синхронизация не удалась: ${error?.message || error}`)
      } finally {
        await scheduleNext()
      }
    })()
    return stop
  }

  return {
    start,
    stop,
    settings: settingsView,
    status,
    models,
    events,
    readEvents,
    rankings,
    balance,
    generationModels,
    generateImage,
    generateVideo,
    videoJob,
    videoContent,
    synthesizeSpeech,
    generatedFiles,
    generatedFile,
    syncNow,
    autoRoute,
    useModel,
    _internals: { settings, file, rankingsFile },
  }
}
