/* dsh-openrouter-models — browser half.
 *
 * Registers the right-sidebar tab "Модели OpenRouter" and renders the catalog:
 * prices per 1M tokens, free models, discounts, the 24h refresh state and the
 * "Едем на халяву" auto-router (largest-context free model → ping → route).
 * Shipped as one browser bundle in the client module format.
 */
window.__ModuleLoader__.load({
  id: 'dsh-openrouter-models',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const TAB_ID = 'dsh-openrouter-models'
    const TAB_KIND = 'openrouter-models'
    const API = '/openrouter-models'
    const STYLE_ID = 'dsh-openrouter-models-style'

    const CSS = `
.dsor-root { display:flex; flex-direction:column; height:100%; min-height:0; padding:0; font-size:12px; line-height:1.45;
  color: var(--dsw-alias-text-primary, #e8e8e8); background: transparent; }
.dsor-pad { padding: 10px 12px; }
.dsor-head { display:flex; align-items:flex-start; gap:8px; padding:10px 12px 8px; border-bottom:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.28)); }
.dsor-title { font-weight:600; font-size:13px; letter-spacing:.01em; }
.dsor-sub { margin-top:2px; font-size:10.5px; color: var(--dsw-alias-text-tertiary, #9a9a9a); }
.dsor-grow { flex:1; min-width:0; }
.dsor-iconbtn { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0; border:0; border-radius:7px;
  background: transparent; color: var(--dsw-alias-text-secondary, #b6b6b6); cursor:pointer; font-size:13px; }
.dsor-iconbtn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(140,140,140,.16)); color: var(--dsw-alias-text-primary, #fff); }
.dsor-iconbtn[disabled] { opacity:.45; cursor:default; }
.dsor-badge { display:inline-flex; align-items:center; gap:4px; padding:1px 6px; border-radius:999px; font-size:10px; font-weight:500;
  border:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.3)); color: var(--dsw-alias-text-secondary, #b6b6b6); white-space:nowrap; }
.dsor-badge.hot { border-color: rgba(255,138,61,.45); color: #ff9a4d; background: rgba(255,138,61,.10); }
.dsor-badge.ok { border-color: rgba(74,196,127,.45); color: #5fd08b; background: rgba(74,196,127,.10); }
.dsor-badge.warn { border-color: rgba(232,190,80,.45); color: #e8be50; background: rgba(232,190,80,.10); }
.dsor-free-btn { display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 12px 8px; padding:10px 12px;
  border:0; border-radius:10px; cursor:pointer; font-size:12.5px; font-weight:700; letter-spacing:.01em; color:#120a00;
  background: linear-gradient(135deg, #ffd24a 0%, #ff9a3d 55%, #ff6d3d 100%);
  box-shadow: 0 4px 14px rgba(255,150,60,.22); transition: transform .12s ease, box-shadow .12s ease; }
.dsor-free-btn:hover:not([disabled]) { transform: translateY(-1px); box-shadow: 0 7px 18px rgba(255,150,60,.3); }
.dsor-free-btn[disabled] { opacity:.65; cursor:default; transform:none; }
.dsor-free-btn small { font-weight:500; font-size:10.5px; opacity:.75; }
.dsor-result { margin:0 12px 8px; padding:8px 10px; border-radius:9px; font-size:11px;
  border:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.3)); background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.03)); }
.dsor-result.ok { border-color: rgba(74,196,127,.45); background: rgba(74,196,127,.08); }
.dsor-result.bad { border-color: rgba(233,105,105,.5); background: rgba(233,105,105,.08); }
.dsor-attempt { display:flex; gap:6px; align-items:baseline; padding:1px 0; font-size:10.5px; color: var(--dsw-alias-text-tertiary, #9a9a9a); }
.dsor-attempt b { font-weight:500; color: var(--dsw-alias-text-secondary, #c4c4c4); }
.dsor-kpis { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:6px; padding:0 12px 8px; }
.dsor-kpi { padding:7px 9px; border-radius:9px; border:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.26));
  background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.03)); }
.dsor-kpi b { display:block; font-size:15px; font-weight:650; font-variant-numeric: tabular-nums; }
.dsor-kpi span { font-size:10px; color: var(--dsw-alias-text-tertiary, #9a9a9a); }
.dsor-filters { display:flex; flex-direction:column; gap:6px; padding:0 12px 8px; }
.dsor-search { width:100%; box-sizing:border-box; padding:6px 9px; border-radius:8px; font-size:11.5px;
  border:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.32)); background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.04));
  color: inherit; outline:none; }
.dsor-search:focus { border-color: var(--dsw-alias-brand-primary, #4d8dff); }
.dsor-chips { display:flex; gap:5px; flex-wrap:wrap; }
.dsor-chip { padding:3px 8px; border-radius:999px; font-size:10.5px; cursor:pointer;
  border:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.3)); background:transparent; color: var(--dsw-alias-text-secondary, #b6b6b6); }
.dsor-chip[data-on="1"] { border-color: var(--dsw-alias-brand-primary, #4d8dff); color: var(--dsw-alias-text-primary, #fff);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 18%, transparent); }
.dsor-list { flex:1; min-height:0; overflow:auto; padding:0 12px 10px; }
.dsor-row { border-bottom:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.2)); }
.dsor-rowin { display:flex; gap:8px; align-items:flex-start; padding:6px 2px; cursor:pointer; border-radius:6px; }
.dsor-rowin:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(140,140,140,.12)); }
.dsor-main { flex:1; min-width:0; }
.dsor-name { font-weight:550; font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-id { font-size:9.5px; color: var(--dsw-alias-text-tertiary, #8f8f8f); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-meta { display:flex; gap:5px; flex-wrap:wrap; margin-top:3px; }
.dsor-price { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; font-size:11px; }
.dsor-price small { display:block; font-size:9.5px; color: var(--dsw-alias-text-tertiary, #8f8f8f); }
.dsor-details { padding:2px 2px 10px 2px; font-size:11px; color: var(--dsw-alias-text-secondary, #c0c0c0); }
.dsor-desc { margin:2px 0 6px; }
.dsor-hist { display:flex; align-items:flex-end; gap:2px; height:26px; margin:4px 0; }
.dsor-hist i { display:block; width:5px; border-radius:1px 1px 0 0; background: var(--dsw-alias-brand-primary, #4d8dff); opacity:.7; }
.dsor-journal { border-top:.5px solid var(--dsw-alias-border-l2, rgba(140,140,140,.28)); padding:8px 12px 10px; max-height:190px; overflow:auto; }
.dsor-jhead { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
.dsor-jhead b { font-size:11px; font-weight:600; }
.dsor-jhead .dsor-grow { flex:1; }
.dsor-linkbtn { border:0; background:transparent; color: var(--dsw-alias-text-tertiary, #9a9a9a); font-size:10px; cursor:pointer; padding:0; }
.dsor-linkbtn:hover { color: var(--dsw-alias-brand-primary, #4d8dff); }
.dsor-event { display:flex; gap:6px; padding:2px 0; font-size:10.5px; align-items:baseline; }
.dsor-event .t { font-size:9.5px; color: var(--dsw-alias-text-tertiary, #8f8f8f); white-space:nowrap; }
.dsor-event .m { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-empty { padding:14px 12px; color: var(--dsw-alias-text-tertiary, #9a9a9a); font-size:11px; }
.dsor-err { margin:0 12px 8px; padding:8px 10px; border-radius:9px; font-size:11px; border:.5px solid rgba(233,105,105,.5);
  background: rgba(233,105,105,.08); color: #ff9c9c; }
.dsor-spin { display:inline-block; width:11px; height:11px; border-radius:50%; border:1.5px solid rgba(0,0,0,.25);
  border-top-color: rgba(0,0,0,.75); animation: dsor-spin .8s linear infinite; }
@keyframes dsor-spin { to { transform: rotate(360deg); } }
`

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = CSS
      document.head.appendChild(el)
    }

    async function getJson(path) {
      const response = await fetch(API + path, { headers: { accept: 'application/json' } })
      let data = {}
      try {
        data = await response.json()
      } catch {
        /* keep the HTTP status as the only signal */
      }
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`)
      return data
    }

    async function postJson(path, body) {
      const response = await fetch(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body === undefined ? {} : body),
      })
      let data = {}
      try {
        data = await response.json()
      } catch {
        /* handled below */
      }
      if (!response.ok && !(data && typeof data.ok === 'boolean')) throw new Error(data?.error || `HTTP ${response.status}`)
      return data
    }

    function fmtUsd(value) {
      if (value === null || value === undefined) return '—'
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      if (number === 0) return '0'
      if (number < 0.01) return number.toFixed(4)
      return number.toFixed(2)
    }

    function priceCell(model) {
      if (model.is_free) return h('span', { className: 'dsor-badge ok' }, 'бесплатно')
      return h('span', null,
        h('span', null, `$${fmtUsd(model.prompt_usd_per_1m)}`),
        h('small', null, `$${fmtUsd(model.completion_usd_per_1m)}`))
    }

    function contextText(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      if (number >= 1_000_000) return `${Math.round(number / 100_000) / 10}M`
      if (number >= 1000) return `${Math.round(number / 100) / 10}K`
      return String(number)
    }

    function relativeTime(iso) {
      const time = Date.parse(iso || '')
      if (!Number.isFinite(time)) return '—'
      const diff = Math.round((Date.now() - time) / 1000)
      if (diff < 60) return 'только что'
      if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
      if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
      return `${Math.floor(diff / 86400)} дн назад`
    }

    function untilText(iso) {
      const time = Date.parse(iso || '')
      if (!Number.isFinite(time)) return '—'
      const diff = Math.round((time - Date.now()) / 1000)
      if (diff <= 0) return 'вот-вот'
      if (diff < 3600) return `через ${Math.max(1, Math.floor(diff / 60))} мин`
      if (diff < 86400) return `через ${Math.floor(diff / 3600)} ч`
      return `через ${Math.floor(diff / 86400)} дн`
    }

    const EVENT_LABEL = {
      price_drop: 'цена упала',
      price_rise: 'подорожала',
      became_free: 'стала бесплатной',
      became_paid: 'стала платной',
      model_added: 'новая модель',
      model_removed: 'исчезла',
      expiring: 'истекает срок',
      sync_failed: 'сбой синка',
    }

    function Badges({ model }) {
      const badges = []
      if (model.discount) badges.push(h('span', { className: 'dsor-badge hot', key: 'd', title: `скидка относительно ${model.discount.basis === 'prev' ? 'прошлого замера' : 'максимума за 30 дней'}` }, `−${model.discount.pct}%`))
      if (model.is_free) badges.push(h('span', { className: 'dsor-badge ok', key: 'f' }, 'free'))
      if (model.is_batch_variant) badges.push(h('span', { className: 'dsor-badge', key: 'b', title: 'batch-вариант дешевле базовой модели' }, 'batch'))
      if (model.has_overrides) badges.push(h('span', { className: 'dsor-badge warn', key: 'o', title: 'цена зависит от времени или объёма' }, 'тариф'))
      if (model.expiring_soon) badges.push(h('span', { className: 'dsor-badge warn', key: 'e', title: model.expiration_date || '' }, 'истекает'))
      return badges.length ? h('div', { className: 'dsor-meta' }, badges) : null
    }

    function PriceHistory({ points }) {
      if (!Array.isArray(points) || points.length < 2) return h('div', { className: 'dsor-meta' }, h('span', { className: 'dsor-badge' }, 'история копится'))
      const values = points.map((point) => Number(point.p)).filter((value) => Number.isFinite(value))
      if (values.length < 2) return null
      const max = Math.max(...values, 1e-9)
      const min = Math.min(...values)
      const span = max - min || max || 1
      return h('div', { className: 'dsor-hist', title: 'история цены входа' },
        values.map((value, index) => h('i', { key: index, style: { height: `${8 + ((value - min) / span) * 16}px` } })))
    }

    function ModelRow({ model }) {
      const [open, setOpen] = useState(false)
      const history = open ? h('div', { className: 'dsor-details' },
        model.description ? h('div', { className: 'dsor-desc' }, model.description) : null,
        h(PriceHistory, { points: model.price_history }),
        model.prev ? h('div', null, `прошлый замер: $${fmtUsd(model.prev.prompt_usd_per_1m)} / $${fmtUsd(model.prev.completion_usd_per_1m)}`) : null,
        model.high_30d ? h('div', null, `максимум за 30 дней: $${fmtUsd(model.high_30d.prompt_usd_per_1m)} / $${fmtUsd(model.high_30d.completion_usd_per_1m)}`) : null,
        model.expiration_date ? h('div', null, `исчезнет: ${model.expiration_date}`) : null,
        h('div', { style: { marginTop: '4px' } }, h('a', {
          href: `https://openrouter.ai/${model.id}`,
          target: '_blank',
          rel: 'noreferrer',
          style: { color: 'var(--dsw-alias-brand-primary, #4d8dff)' },
        }, 'открыть на openrouter.ai'))) : null
      return h('div', { className: 'dsor-row' },
        h('div', { className: 'dsor-rowin', onClick: () => setOpen((value) => !value) },
          h('div', { className: 'dsor-main' },
            h('div', { className: 'dsor-name', title: model.name }, model.name),
            h('div', { className: 'dsor-id' }, model.id),
            h('div', { className: 'dsor-meta' },
              h('span', { className: 'dsor-badge' }, `контекст ${contextText(model.context_length)}`),
              h(Badges, { model }))),
          h('div', { className: 'dsor-price' }, priceCell(model))),
        history)
    }

    function Journal({ events, unread, onRead }) {
      if (!events.length) return null
      return h('div', { className: 'dsor-journal' },
        h('div', { className: 'dsor-jhead' },
          h('b', null, 'Журнал'),
          unread > 0 ? h('span', { className: 'dsor-badge hot' }, `${unread} новых`) : null,
          h('span', { className: 'dsor-grow' }),
          unread > 0 ? h('button', { type: 'button', className: 'dsor-linkbtn', onClick: onRead }, 'прочитать') : null),
        events.slice(0, 10).map((event) => h('div', { className: 'dsor-event', key: event.id },
          h('span', { className: 't' }, relativeTime(event.at)),
          h('span', { className: 'dsor-badge ' + (event.severity === 'hot' ? 'hot' : event.severity === 'warn' ? 'warn' : '') }, EVENT_LABEL[event.type] || event.type),
          h('span', { className: 'm', title: event.detail || '' }, event.model_name || event.title))))
    }

    function AutoRoutePanel({ state, onRun, disabled }) {
      return h('div', null,
        h('button', {
          type: 'button',
          className: 'dsor-free-btn',
          onClick: onRun,
          disabled: disabled || state?.running,
          title: 'Найти бесплатную модель с максимальным контекстом, проверить её пингом и переключить текущую сессию',
        },
          state?.running ? h('span', { className: 'dsor-spin' }) : h('span', null, '🛷'),
          state?.running ? 'Ищем бесплатную модель…' : 'Едем на халяву',
          h('small', null, 'free · макс. контекст · пинг')),
        state?.result ? h('div', { className: 'dsor-result ' + (state.result.ok ? 'ok' : 'bad') },
          state.result.ok
            ? h('div', null,
              h('b', null, state.result.routed?.name || state.result.routed?.model),
              h('div', null, `контекст ${contextText(state.result.routed?.context_length)} · пинг ${state.result.routed?.latency_ms} мс · бесплатно`),
              h('div', { className: 'dsor-attempt' }, `сессия переключена на ${state.result.routed?.provider}/${state.result.routed?.model}${state.result.routed?.config_changed ? ' (модель добавлена в провайдер)' : ''}`))
            : h('div', null, h('b', null, 'Не получилось: '), state.result.error),
          Array.isArray(state.result.attempts) && state.result.attempts.length
            ? h('details', { style: { marginTop: '4px' } },
              h('summary', { className: 'dsor-linkbtn' }, `пинги: ${state.result.attempts.length}`),
              state.result.attempts.map((attempt) => h('div', { className: 'dsor-attempt', key: attempt.model },
                h('b', null, attempt.ok ? '✓' : '✗'),
                h('span', { title: attempt.error || attempt.reply || '' }, attempt.model),
                h('span', null, `${attempt.latency_ms ?? '?'} мс`))))
            : null) : null)
    }

    function OpenRouterTab(props) {
      const sessionId = props && props.sessionId
      const [status, setStatus] = useState(null)
      const [models, setModels] = useState([])
      const [events, setEvents] = useState([])
      const [unread, setUnread] = useState(0)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState(null)
      const [syncing, setSyncing] = useState(false)
      const [query, setQuery] = useState('')
      const [filter, setFilter] = useState('all')
      const [auto, setAuto] = useState(null)
      const alive = useRef(true)

      const load = useCallback(async (silent) => {
        if (!silent) setLoading(true)
        try {
          const [modelsResponse, eventsResponse] = await Promise.all([
            getJson('/models'),
            getJson('/events?limit=30'),
          ])
          if (!alive.current) return
          setStatus(modelsResponse.status || null)
          setModels(Array.isArray(modelsResponse.models) ? modelsResponse.models : [])
          setEvents(Array.isArray(eventsResponse.events) ? eventsResponse.events : [])
          setUnread(Number(eventsResponse.unread) || 0)
          setError(null)
        } catch (caught) {
          if (!alive.current) return
          setError(caught instanceof Error ? caught.message : String(caught))
        } finally {
          if (!alive.current) return
          if (!silent) setLoading(false)
        }
      }, [])

      useEffect(() => {
        alive.current = true
        ensureStyle()
        void load()
        const timer = setInterval(() => {
          void load(true)
        }, 60000)
        return () => {
          alive.current = false
          clearInterval(timer)
        }
      }, [load])

      const refresh = async () => {
        setSyncing(true)
        try {
          const result = await postJson('/sync')
          if (result && result.status) setStatus(result.status)
          await load(true)
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught))
        } finally {
          setSyncing(false)
        }
      }

      const runAutoRoute = async () => {
        setAuto({ running: true, result: null })
        try {
          const result = await postJson('/auto-route', { sessionId })
          setAuto({ running: false, result })
          if (result && result.ok) {
            setFilter('free')
            void load(true)
          }
        } catch (caught) {
          setAuto({ running: false, result: { ok: false, error: caught instanceof Error ? caught.message : String(caught) } })
        }
      }

      const readEvents = async () => {
        try {
          await postJson('/events/read', { all: true })
          setUnread(0)
          setEvents((current) => current.map((event) => ({ ...event, read: true })))
        } catch {
          /* the next poll restores the real unread state */
        }
      }

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return models.filter((model) => {
          if (filter === 'free' && !model.is_free) return false
          if (filter === 'discount' && !model.discount) return false
          if (!needle) return true
          return `${model.id} ${model.name} ${model.author}`.toLowerCase().includes(needle)
        })
      }, [models, query, filter])

      const totals = status?.totals || { models: 0, free: 0, discounts: 0, new_7d: 0 }

      return h('div', { className: 'dsor-root' },
        h('div', { className: 'dsor-head' },
          h('div', { className: 'dsor-grow' },
            h('div', { className: 'dsor-title' }, 'Модели OpenRouter'),
            h('div', { className: 'dsor-sub' },
              status?.synced_at
                ? `обновлено ${relativeTime(status.synced_at)} · следующее ${untilText(status.next_sync_at)}`
                : 'каталог ещё не обновлялся')),
          h('button', { type: 'button', className: 'dsor-iconbtn', title: 'Обновить каталог сейчас', onClick: refresh, disabled: syncing || !!status?.in_flight },
            syncing || status?.in_flight ? h('span', { className: 'dsor-spin' }) : '⟳')),
        error ? h('div', { className: 'dsor-err' }, error) : null,
        h(AutoRoutePanel, { state: auto, onRun: runAutoRoute, disabled: !!status?.in_flight }),
        h('div', { className: 'dsor-kpis' },
          h('div', { className: 'dsor-kpi' }, h('b', null, totals.models), h('span', null, 'моделей')),
          h('div', { className: 'dsor-kpi' }, h('b', null, totals.free), h('span', null, 'бесплатных')),
          h('div', { className: 'dsor-kpi' }, h('b', null, totals.discounts), h('span', null, 'со скидкой')),
          h('div', { className: 'dsor-kpi' }, h('b', null, totals.new_7d), h('span', null, 'новинок за 7 дн'))),
        h('div', { className: 'dsor-filters' },
          h('input', {
            className: 'dsor-search',
            placeholder: 'поиск: id, название, автор',
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h('div', { className: 'dsor-chips' },
            ['all', 'free', 'discount'].map((value) => h('button', {
              key: value,
              type: 'button',
              className: 'dsor-chip',
              'data-on': filter === value ? '1' : '0',
              onClick: () => setFilter(value),
            }, value === 'all' ? `Все (${models.length})` : value === 'free' ? `Бесплатные (${totals.free})` : `Скидки (${totals.discounts})`)))),
        loading
          ? h('div', { className: 'dsor-empty' }, 'загружаем каталог…')
          : filtered.length === 0
            ? h('div', { className: 'dsor-empty' }, status?.synced_at ? 'Ничего не найдено — измените фильтр.' : 'Каталог пуст: нажмите ⟳, чтобы обновить.')
            : h('div', { className: 'dsor-list' }, filtered.slice(0, 400).map((model) => h(ModelRow, { key: model.id, model }))),
        h(Journal, { events, unread, onRead: readEvents }))
    }

    /** Static tab declaration: a page type with one guide entry. */
    const definition = {
      id: TAB_ID,
      kind: TAB_KIND,
      title: () => 'Модели OpenRouter',
      guide: [{
        id: 'openrouter',
        order: 55,
        title: () => 'Модели OpenRouter',
        description: () => 'Цены, бесплатные, скидки, едем на халяву',
      }],
    }

    /** Register the tab type and its body. */
    function apply(ctx) {
      ctx.effect(() => ctx.sidebarRightTabs.register(definition), 'openrouter-models: tab type')
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
      }, OpenRouterTab)), 'openrouter-models: tab body')
    }

    exports.inject = ['slots', 'sidebarRightTabs']
    exports.apply = apply
    return module.exports
  },
})
