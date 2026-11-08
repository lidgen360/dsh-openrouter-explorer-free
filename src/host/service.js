/**
 * Host-side catalog service: fetches the public OpenRouter catalog, persists a
 * bounded snapshot with a price history, refreshes every 24 hours, and routes
 * the current session to a free model that actually answers ("Едем на халяву").
 */
import crypto from 'node:crypto'
import { applyCatalog, buildStatus, freeChatModels, listEvents, listModels, markEventsRead, LIMITS } from './catalog.js'
import { emptyState, readState, writeState, withStateLock } from './state.js'
import { legacyStateFilePath, stateFilePath } from './home.js'
import { ensureProviderModel, ensureProviderRoute } from './provider.js'

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
  const logger = ctx?.logger

  // No long-lived in-memory snapshot: several DSH profiles may share one
  // DSH_HOME, so every operation re-reads the file (under a lock when writing).
  let inflight = null
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

  async function fetchCatalog() {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.syncTimeoutMs)
    try {
      const response = await fetchImpl(settings.source, { headers: { accept: 'application/json' }, signal: controller.signal })
      const text = await response.text()
      if (!response.ok) throw new Error(`OpenRouter: HTTP ${response.status} — ${String(text).slice(0, 200)}`)
      let payload = null
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error('OpenRouter: ответ не является JSON')
      }
      if (!payload || !Array.isArray(payload.data)) throw new Error('OpenRouter: в ответе нет массива data')
      return payload.data
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`OpenRouter: таймаут ${Math.round(settings.syncTimeoutMs / 1000)} с`)
      throw error
    } finally {
      clearTimeout(timeout)
    }
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
    syncNow,
    autoRoute,
    useModel,
    _internals: { settings, file },
  }
}
