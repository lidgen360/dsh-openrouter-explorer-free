/* dsh-openrouter-explorer-free — browser half.
 *
 * Registers the right-sidebar tab "Модели OpenRouter" and renders the catalog:
 * prices per 1M tokens, free models, discounts, the 24h refresh state and the
 * "Едем на халяву" auto-router (largest-context free model → ping → route).
 * Shipped as one browser bundle in the client module format.
 */
window.__ModuleLoader__.load({
  id: 'dsh-openrouter-explorer-free',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const TAB_ID = 'dsh-openrouter-explorer-free'
    const TAB_KIND = 'openrouter-models'
    const API = '/openrouter-explorer-free'
    const STYLE_ID = 'dsh-openrouter-explorer-free-style'

    /** Locale namespace; ru and en are shipped, every other locale falls back to en. */
    const NS = 'openrouterExplorer'
    const MESSAGES = {
      ru: {
        'title': 'OpenRouter Explorer Free',
        'guide.title': 'OpenRouter Explorer Free',
        'guide.desc': 'Цены, бесплатные модели, скидки, «Едем на халяву»',
        'refresh': 'Обновить каталог сейчас',
        'close': 'Закрыть',
        'auto.run': 'Едем на халяву',
        'auto.hint': 'free · макс. контекст · пинг',
        'auto.running': 'Ищем бесплатную модель…',
        'kpi.models': 'моделей',
        'kpi.free': 'бесплатных',
        'kpi.discounts': 'со скидкой',
        'kpi.new': 'новинок за 7 дн',
        'search': 'поиск: id, название, автор',
        'filter.all': 'Все',
        'filter.free': 'Бесплатные',
        'filter.discount': 'Скидки',
        'journal': 'Журнал',
        'journal.new': '{n} новых',
        'journal.read': 'прочитать',
        'event.price_drop': 'цена упала',
        'event.price_rise': 'подорожала',
        'event.became_free': 'стала бесплатной',
        'event.became_paid': 'стала платной',
        'event.model_added': 'новая модель',
        'event.model_removed': 'исчезла',
        'event.expiring': 'истекает срок',
        'event.sync_failed': 'сбой синка',
        'empty.loading': 'загружаем каталог…',
        'empty.notfound': 'Ничего не найдено — измените фильтр.',
        'empty.nocatalog': 'Каталог пуст: нажмите ⟳, чтобы обновить.',
        'menu.title': 'OpenRouter Explorer',
        'menu.summary': '{models} моделей · {free} free · {discounts} скидок',
        'menu.loading': 'загрузка…',
        'context': 'контекст {ctx}',
        'price.free': 'бесплатно',
        'price.per1m': '${in} / ${out} за 1M',
        'price.discount': '−{pct}%',
        'menu.openTab': 'Открыть вкладку «Модели»',
        'updated': 'обновлено {ago}',
        'toast.synced': 'каталог обновлён: {n} моделей',
        'toast.routed': 'сессия переключена на {name}',
        'toast.routedConfig': ' · модель добавлена в провайдер',
        'toast.noSession': 'нет активной сессии',
        'toast.useFailed': 'не удалось переключить модель',
        'toast.autoFailed': 'не получилось',
        'details.prev': 'прошлый замер: ${in} / ${out}',
        'details.high': 'максимум за 30 дней: ${in} / ${out}',
        'details.expires': 'исчезнет: {date}',
        'details.open': 'открыть на openrouter.ai',
        'details.history': 'история копится',
        'details.historyTitle': 'история цены входа',
        'badge.discountPrev': 'скидка относительно прошлого замера',
        'badge.discountHigh': 'скидка относительно максимума за 30 дней',
        'badge.batchTitle': 'batch-вариант дешевле базовой модели',
        'badge.overrideTitle': 'цена зависит от времени или объёма',
        'badge.override': 'тариф',
        'badge.expires': 'истекает',
        'status.never': 'каталог ещё не обновлялся',
        'status.updated': 'обновлено {ago} · следующее {eta}',
        'time.now': 'только что',
        'time.min': '{n} мин назад',
        'time.hour': '{n} ч назад',
        'time.day': '{n} дн назад',
        'time.inMin': 'через {n} мин',
        'time.inHour': 'через {n} ч',
        'time.inDay': 'через {n} дн',
        'time.soon': 'вот-вот',
        'selected': 'сессия: {provider}/{model}',
        'modality.text': 'текст',
        'modality.image': 'картинки',
        'modality.audio': 'аудио',
        'modality.video': 'видео',
        'modality.file': 'файлы',
        'modality.onlyText': 'только текст',
        'modality.textOnlyTitle': 'принимает и выдаёт только текст',
        'modality.accepts': 'вход: {list}',
        'modality.out': 'на выходе: {list}',
        'modality.title': 'вход: {input} · выход: {output}',
      },
      en: {
        'title': 'OpenRouter Explorer Free',
        'guide.title': 'OpenRouter Explorer Free',
        'guide.desc': 'Prices, free models, discounts, “Ride for free”',
        'refresh': 'Refresh the catalog now',
        'close': 'Close',
        'auto.run': 'Ride for free',
        'auto.hint': 'free · max context · ping',
        'auto.running': 'Looking for a free model…',
        'kpi.models': 'models',
        'kpi.free': 'free',
        'kpi.discounts': 'discounted',
        'kpi.new': 'new in 7 days',
        'search': 'search: id, name, author',
        'filter.all': 'All',
        'filter.free': 'Free',
        'filter.discount': 'Discounts',
        'journal': 'Journal',
        'journal.new': '{n} new',
        'journal.read': 'mark read',
        'event.price_drop': 'price dropped',
        'event.price_rise': 'price rose',
        'event.became_free': 'became free',
        'event.became_paid': 'became paid',
        'event.model_added': 'new model',
        'event.model_removed': 'removed',
        'event.expiring': 'expiring',
        'event.sync_failed': 'sync failed',
        'empty.loading': 'loading the catalog…',
        'empty.notfound': 'Nothing matches — change the filter.',
        'empty.nocatalog': 'Catalog is empty: press ⟳ to refresh.',
        'menu.title': 'OpenRouter Explorer',
        'menu.summary': '{models} models · {free} free · {discounts} discounted',
        'menu.loading': 'loading…',
        'context': 'context {ctx}',
        'price.free': 'free',
        'price.per1m': '${in} / ${out} per 1M',
        'price.discount': '−{pct}%',
        'menu.openTab': 'Open the “Models” tab',
        'updated': 'updated {ago}',
        'toast.synced': 'catalog refreshed: {n} models',
        'toast.routed': 'session switched to {name}',
        'toast.routedConfig': ' · model added to the provider',
        'toast.noSession': 'no active session',
        'toast.useFailed': 'could not switch the model',
        'toast.autoFailed': 'no luck',
        'details.prev': 'previous sample: ${in} / ${out}',
        'details.high': '30-day high: ${in} / ${out}',
        'details.expires': 'expires: {date}',
        'details.open': 'open on openrouter.ai',
        'details.history': 'history is accumulating',
        'details.historyTitle': 'input price history',
        'badge.discountPrev': 'discount against the previous sample',
        'badge.discountHigh': 'discount against the 30-day high',
        'badge.batchTitle': 'batch variant is cheaper than the base model',
        'badge.overrideTitle': 'price depends on time or volume',
        'badge.override': 'tiered',
        'badge.expires': 'expiring',
        'status.never': 'catalog has not been refreshed yet',
        'status.updated': 'updated {ago} · next {eta}',
        'time.now': 'just now',
        'time.min': '{n} min ago',
        'time.hour': '{n} h ago',
        'time.day': '{n} d ago',
        'time.inMin': 'in {n} min',
        'time.inHour': 'in {n} h',
        'time.inDay': 'in {n} d',
        'time.soon': 'any moment',
        'selected': 'session: {provider}/{model}',
        'modality.text': 'text',
        'modality.image': 'images',
        'modality.audio': 'audio',
        'modality.video': 'video',
        'modality.file': 'files',
        'modality.onlyText': 'text only',
        'modality.textOnlyTitle': 'accepts and returns text only',
        'modality.accepts': 'input: {list}',
        'modality.out': 'outputs: {list}',
        'modality.title': 'input: {input} · output: {output}',
      },
    }

    /** Translator over the slot-provided `t`; falls back to Russian copy. */
    function makeTranslator(translate) {
      return (key, vars) => {
        let text = null
        if (typeof translate === 'function') {
          try {
            text = translate(key)
          } catch {
            text = null
          }
        }
        if (text === null || text === undefined || text === key) text = MESSAGES.ru[key] ?? key
        return vars
          ? String(text).replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])))
          : String(text)
      }
    }

    const CSS = `
/* ---- theme bridge: inherit the harness look, keep surfaces solid ---- */
.dsor-root { display:flex; flex-direction:column; height:100%; min-height:0; padding:0;
  font-family: var(--dsw-font-family, inherit); font-size:12px; line-height:1.45;
  color: var(--dsw-alias-label-primary, #e8e8e8); background: transparent; }
.dsor-pad { padding:10px 12px; }
.dsor-head { display:flex; align-items:flex-start; gap:8px; padding:10px 12px 8px;
  border-bottom:.5px solid var(--dsw-alias-border-l2, #3a3b3d); }
.dsor-title { font-weight:600; font-size:13px; letter-spacing:.01em; }
.dsor-sub { margin-top:2px; font-size:10.5px; color: var(--dsw-alias-label-tertiary, #9a9a9a); }
.dsor-grow { flex:1; min-width:0; }
.dsor-iconbtn { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0;
  border:0; border-radius: var(--dsw-radius-sm, 6px); background: transparent;
  color: var(--dsw-alias-label-secondary, #b6b6b6); cursor:pointer; font-size:13px; }
.dsor-iconbtn:hover { background: var(--dsw-alias-interactive-bg-hover, #3c3d3f); color: var(--dsw-alias-label-primary, #fff); }
.dsor-iconbtn[disabled] { opacity:.45; cursor:default; }
.dsor-badge { display:inline-flex; align-items:center; gap:4px; padding:1px 6px; border-radius: var(--dsw-radius-sm, 6px);
  font-size:10px; font-weight:500; white-space:nowrap;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); color: var(--dsw-alias-label-secondary, #b6b6b6);
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-badge.hot { border-color: var(--dsw-alias-state-warn-secondary, #a37a2c);
  color: var(--dsw-alias-state-warn-primary, #ffb454); background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-badge.ok { border-color: var(--dsw-alias-state-success-secondary, #2f7d52);
  color: var(--dsw-alias-state-success-primary, #5fd08b); background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-badge.warn { border-color: var(--dsw-alias-state-warn-secondary, #a37a2c);
  color: var(--dsw-alias-state-warn-label, #e8be50); background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-free-btn { display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 12px 8px; padding:10px 12px;
  border:0; border-radius: var(--dsw-radius-lg, 10px); cursor:pointer; font-size:12.5px; font-weight:700; letter-spacing:.01em;
  color:#120a00; background: linear-gradient(135deg, #ffd24a 0%, #ff9a3d 55%, #ff6d3d 100%);
  box-shadow: var(--dsw-elevation-soft, 0 4px 14px rgba(255,150,60,.22)); transition: transform .12s ease, box-shadow .12s ease; }
.dsor-free-btn:hover:not([disabled]) { transform: translateY(-1px); box-shadow: var(--dsw-elevation-panel, 0 7px 18px rgba(255,150,60,.3)); }
.dsor-free-btn[disabled] { opacity:.65; cursor:default; transform:none; }
.dsor-free-btn small { font-weight:500; font-size:10.5px; opacity:.75; }
.dsor-result { margin:0 12px 8px; padding:8px 10px; border-radius: var(--dsw-radius-md, 8px); font-size:11px;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-result.ok { border-color: var(--dsw-alias-state-success-secondary, #2f7d52); }
.dsor-result.bad { border-color: var(--dsw-alias-state-error-primary, #e96969); }
.dsor-attempt { display:flex; gap:6px; align-items:baseline; padding:1px 0; font-size:10.5px;
  color: var(--dsw-alias-label-tertiary, #9a9a9a); }
.dsor-attempt b { font-weight:500; color: var(--dsw-alias-label-secondary, #c4c4c4); }
.dsor-kpis { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:6px; padding:0 12px 8px; }
.dsor-kpi { padding:7px 9px; border-radius: var(--dsw-radius-md, 8px);
  border:.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2, #3a3b3d));
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2, #2b2c2e)); }
.dsor-kpi b { display:block; font-size:15px; font-weight:650; font-variant-numeric: tabular-nums; }
.dsor-kpi span { font-size:10px; color: var(--dsw-alias-label-tertiary, #9a9a9a); }
.dsor-filters { display:flex; flex-direction:column; gap:6px; padding:0 12px 8px; }
.dsor-search { width:100%; box-sizing:border-box; padding:6px 9px; border-radius: var(--dsw-radius-md, 8px); font-size:11.5px;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); background: var(--dsw-alias-bg-layer-2, #2b2c2e);
  color: inherit; outline:none; font-family: inherit; }
.dsor-search:focus { border-color: var(--dsw-alias-brand-primary, #4d8dff); }
.dsor-chips { display:flex; gap:5px; flex-wrap:wrap; }
.dsor-chip { padding:3px 8px; border-radius: var(--dsw-radius-sm, 6px); font-size:10.5px; cursor:pointer;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); background: var(--dsw-alias-bg-layer-2, #2b2c2e);
  color: var(--dsw-alias-label-secondary, #b6b6b6); font-family: inherit; }
.dsor-chip[data-on="1"] { border-color: var(--dsw-alias-brand-primary, #4d8dff);
  color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-bg-layer-3, #353638); }
.dsor-list { flex:1; min-height:0; overflow:auto; padding:0 12px 10px; }
.dsor-row { border-bottom:.5px solid var(--dsw-alias-border-l1, #333436); }
.dsor-rowin { display:flex; gap:8px; align-items:flex-start; padding:6px 2px; cursor:pointer;
  border-radius: var(--dsw-radius-sm, 6px); }
.dsor-rowin:hover { background: var(--dsw-alias-interactive-bg-hover, #3c3d3f); }
.dsor-main { flex:1; min-width:0; }
.dsor-name { font-weight:550; font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-id { font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-meta { display:flex; gap:5px; flex-wrap:wrap; margin-top:3px; }
/* Modality icons: what the model takes in (image/video/audio/file) and gives back. */
.dsor-mods { display:inline-flex; align-items:center; gap:2px; }
.dsor-mod { display:inline-flex; align-items:center; justify-content:center; min-width:15px; height:15px; padding:0 2px;
  border-radius:3px; font-size:10px; line-height:1;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-mod[data-mod="image"] { border-color: var(--dsw-alias-state-info-secondary, #3d6fa8); }
.dsor-mod[data-mod="video"] { border-color: var(--dsw-alias-state-warn-secondary, #a37a2c); }
.dsor-mod[data-mod="audio"] { border-color: var(--dsw-alias-state-success-secondary, #2f7d52); }
.dsor-mod[data-mod="file"] { border-color: var(--dsw-alias-border-l3, #4a4b4d); }
.dsor-mod.out { border-style:dashed; border-color: var(--dsw-alias-brand-primary, #4d8dff); }
.dsor-mod-arrow { font-size:9px; color: var(--dsw-alias-label-tertiary, #8f8f8f); }
.dsor-mini .dsor-mods { margin-right:4px; }
.dsor-mini .dsor-mod { min-width:13px; height:13px; font-size:9px; }
.dsor-price { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; font-size:11px; }
.dsor-price small { display:block; font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f); }
.dsor-details { padding:2px 2px 10px 2px; font-size:11px; color: var(--dsw-alias-label-secondary, #c0c0c0); }
.dsor-desc { margin:2px 0 6px; }
.dsor-hist { display:flex; align-items:flex-end; gap:2px; height:26px; margin:4px 0; }
.dsor-hist i { display:block; width:5px; border-radius:1px 1px 0 0; background: var(--dsw-alias-brand-primary, #4d8dff); opacity:.7; }
.dsor-journal { border-top:.5px solid var(--dsw-alias-border-l2, #3a3b3d); padding:8px 12px 10px; max-height:190px; overflow:auto; }
.dsor-jhead { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
.dsor-jhead b { font-size:11px; font-weight:600; }
.dsor-jhead .dsor-grow { flex:1; }
.dsor-linkbtn { border:0; background:transparent; color: var(--dsw-alias-link, #4d8dff); font-size:10px;
  cursor:pointer; padding:0; font-family: inherit; }
.dsor-linkbtn:hover { color: var(--dsw-alias-brand-primary, #6ea4ff); }
.dsor-event { display:flex; gap:6px; padding:2px 0; font-size:10.5px; align-items:baseline; }
.dsor-event .t { font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f); white-space:nowrap; }
.dsor-event .m { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-empty { padding:14px 12px; color: var(--dsw-alias-label-tertiary, #9a9a9a); font-size:11px; }
.dsor-err { margin:0 12px 8px; padding:8px 10px; border-radius: var(--dsw-radius-md, 8px); font-size:11px;
  border:.5px solid var(--dsw-alias-state-error-primary, #e96969);
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); color: var(--dsw-alias-state-error-primary, #ff9c9c); }
.dsor-spin { display:inline-block; width:11px; height:11px; border-radius:50%; border:1.5px solid rgba(0,0,0,.25);
  border-top-color: rgba(0,0,0,.75); animation: dsor-spin .8s linear infinite; }
@keyframes dsor-spin { to { transform: rotate(360deg); } }

/* Composer: the catalog pill and its popup menu, next to the model selector. */
.dsor-anchor { position:relative; display:inline-flex; align-items:center; }
.dsor-pill { display:inline-flex; align-items:center; gap:4px; height:26px; padding:0 9px;
  border-radius: var(--dsw-radius-sm, 6px); border:.5px solid var(--dsw-alias-border-l2, #3a3b3d);
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); color: var(--dsw-alias-label-secondary, #b6b6b6);
  font-size:11px; cursor:pointer; white-space:nowrap; font-family: inherit; }
.dsor-pill:hover { background: var(--dsw-alias-interactive-bg-hover, #3c3d3f); color: var(--dsw-alias-label-primary, #fff); }
.dsor-pill[data-open="1"] { border-color: var(--dsw-alias-brand-primary, #4d8dff);
  color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-bg-layer-3, #353638); }
.dsor-panel { position:fixed; z-index:80; display:flex; flex-direction:column; max-height:min(72vh, 470px);
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); border-radius: var(--dsw-radius-panel, 14px);
  background: var(--dsw-alias-bg-layer-3, #353638);
  box-shadow: var(--dsw-elevation-panel, 0 14px 38px rgba(0,0,0,.42));
  overflow:hidden; font-size:12px; color: var(--dsw-alias-label-primary, #e8e8e8); }
.dsor-panel-head { display:flex; align-items:center; gap:6px; padding:8px 10px;
  border-bottom:.5px solid var(--dsw-alias-border-l2, #3a3b3d); }
.dsor-panel-head b { font-size:12px; font-weight:600; }
.dsor-panel-actions { display:flex; flex-direction:column; gap:6px; padding:8px 10px 4px; }
.dsor-panel .dsor-free-btn { margin:0; padding:8px 10px; font-size:12px; }
.dsor-panel-body { flex:1; min-height:0; overflow:auto; padding:4px 6px 6px; }
.dsor-mini { display:flex; align-items:center; gap:8px; width:100%; padding:5px 7px; border:0;
  border-radius: var(--dsw-radius-sm, 6px); background:transparent; color:inherit; text-align:left;
  cursor:pointer; font-size:11.5px; font-family: inherit; }
.dsor-mini:hover { background: var(--dsw-alias-interactive-bg-hover, #3c3d3f); }
.dsor-mini .n { flex:1; min-width:0; overflow:hidden; }
.dsor-mini .n b { display:block; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-mini .n small { display:block; font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-mini .p { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #c4c4c4);
  white-space:nowrap; font-size:11px; }
.dsor-panel .dsor-filters { padding:0 10px 6px; }
.dsor-panel .dsor-search { padding:6px 8px; }
.dsor-foot { display:flex; align-items:center; gap:6px; padding:6px 10px 8px;
  border-top:.5px solid var(--dsw-alias-border-l2, #3a3b3d); }
.dsor-toast { margin:0 10px 6px; padding:6px 8px; border-radius: var(--dsw-radius-md, 8px); font-size:10.5px;
  line-height:1.35; border:.5px solid var(--dsw-alias-border-l2, #3a3b3d);
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-toast.ok { border-color: var(--dsw-alias-state-success-secondary, #2f7d52);
  color: var(--dsw-alias-state-success-primary, #5fd08b); }
.dsor-toast.bad { border-color: var(--dsw-alias-state-error-primary, #e96969);
  color: var(--dsw-alias-state-error-primary, #ff9c9c); }
.dsor-price-label { margin-left:6px; font-size:10.5px; color: var(--dsw-alias-label-tertiary, #9a9a9a);
  font-variant-numeric: tabular-nums; white-space:nowrap; }
.dsor-price-label.hot { color: var(--dsw-alias-state-warn-primary, #ff9a4d); }
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

    function priceCell(model, tr) {
      if (model.is_free) return h('span', { className: 'dsor-badge ok' }, tr('price.free'))
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

    /* Modality icons: what the model accepts (input) and what it returns (output).
     * OpenRouter gives both arrays and a "text+image->text" string; arrays win,
     * the string is the fallback for older snapshots. */
    const MODALITY_ICONS = { text: '📝', image: '🖼️', audio: '🔊', video: '🎬', file: '📎' }
    const MODALITY_ORDER = ['text', 'image', 'video', 'audio', 'file']

    function normalizeModalities(model) {
      const input = []
      const output = []
      const add = (list, value) => {
        const token = String(value || '').trim().toLowerCase()
        if (token && !list.includes(token)) list.push(token)
      }
      if (Array.isArray(model.input_modalities)) model.input_modalities.forEach((value) => add(input, value))
      if (Array.isArray(model.output_modalities)) model.output_modalities.forEach((value) => add(output, value))
      if ((!input.length || !output.length) && typeof model.modality === 'string' && model.modality.includes('->')) {
        const [left, right] = model.modality.split('->')
        String(left || '').split('+').forEach((value) => add(input, value))
        String(right || '').split('+').forEach((value) => add(output, value))
      }
      const order = (value) => {
        const index = MODALITY_ORDER.indexOf(value)
        return index === -1 ? MODALITY_ORDER.length : index
      }
      input.sort((a, b) => order(a) - order(b))
      output.sort((a, b) => order(a) - order(b))
      return { input, output }
    }

    function modalityText(list, tr) {
      if (!list.length) return '—'
      return list.map((value) => {
        const key = 'modality.' + value
        const text = tr(key)
        return text === key ? value : text
      }).join(', ')
    }

    /** Compact capability icons for a model row; text-only models get a word instead. */
    function ModalityBadges({ model, tr }) {
      const { input, output } = normalizeModalities(model)
      const extraInput = input.filter((value) => value !== 'text')
      const extraOutput = output.filter((value) => value !== 'text')
      if (!extraInput.length && !extraOutput.length) {
        return h('span', { className: 'dsor-badge', title: tr('modality.textOnlyTitle') }, tr('modality.onlyText'))
      }
      const title = tr('modality.title', { input: modalityText(input, tr), output: modalityText(output, tr) })
      const nodes = []
      extraInput.forEach((value) => nodes.push(h('span', {
        key: 'in-' + value, className: 'dsor-mod', 'data-mod': value,
        title: tr('modality.accepts', { list: modalityText([value], tr) }),
      }, MODALITY_ICONS[value] || '•')))
      if (extraOutput.length) {
        nodes.push(h('span', { key: 'arrow', className: 'dsor-mod-arrow' }, '→'))
        extraOutput.forEach((value) => nodes.push(h('span', {
          key: 'out-' + value, className: 'dsor-mod out', 'data-mod': value,
          title: tr('modality.out', { list: modalityText([value], tr) }),
        }, MODALITY_ICONS[value] || '•')))
      }
      return h('span', { className: 'dsor-mods', title }, nodes)
    }

    function relativeTime(iso, tr) {
      const time = Date.parse(iso || '')
      if (!Number.isFinite(time)) return '—'
      const diff = Math.round((Date.now() - time) / 1000)
      if (diff < 60) return tr('time.now')
      if (diff < 3600) return tr('time.min', { n: Math.floor(diff / 60) })
      if (diff < 86400) return tr('time.hour', { n: Math.floor(diff / 3600) })
      return tr('time.day', { n: Math.floor(diff / 86400) })
    }

    function untilText(iso, tr) {
      const time = Date.parse(iso || '')
      if (!Number.isFinite(time)) return '—'
      const diff = Math.round((time - Date.now()) / 1000)
      if (diff <= 0) return tr('time.soon')
      if (diff < 3600) return tr('time.inMin', { n: Math.max(1, Math.floor(diff / 60)) })
      if (diff < 86400) return tr('time.inHour', { n: Math.floor(diff / 3600) })
      return tr('time.inDay', { n: Math.floor(diff / 86400) })
    }

    function eventLabel(type, tr) {
      return tr('event.' + type) === 'event.' + type ? type : tr('event.' + type)
    }

    function Badges({ model, tr }) {
      const badges = []
      if (model.discount) badges.push(h('span', { className: 'dsor-badge hot', key: 'd', title: tr(model.discount.basis === 'prev' ? 'badge.discountPrev' : 'badge.discountHigh') }, tr('price.discount', { pct: model.discount.pct })))
      if (model.is_free) badges.push(h('span', { className: 'dsor-badge ok', key: 'f' }, tr('price.free')))
      if (model.is_batch_variant) badges.push(h('span', { className: 'dsor-badge', key: 'b', title: tr('badge.batchTitle') }, 'batch'))
      if (model.has_overrides) badges.push(h('span', { className: 'dsor-badge warn', key: 'o', title: tr('badge.overrideTitle') }, tr('badge.override')))
      if (model.expiring_soon) badges.push(h('span', { className: 'dsor-badge warn', key: 'e', title: model.expiration_date || '' }, tr('badge.expires')))
      return badges.length ? h('div', { className: 'dsor-meta' }, badges) : null
    }

    function PriceHistory({ points, tr }) {
      if (!Array.isArray(points) || points.length < 2) return h('div', { className: 'dsor-meta' }, h('span', { className: 'dsor-badge' }, tr('details.history')))
      const values = points.map((point) => Number(point.p)).filter((value) => Number.isFinite(value))
      if (values.length < 2) return null
      const max = Math.max(...values, 1e-9)
      const min = Math.min(...values)
      const span = max - min || max || 1
      return h('div', { className: 'dsor-hist', title: tr('details.historyTitle') },
        values.map((value, index) => h('i', { key: index, style: { height: `${8 + ((value - min) / span) * 16}px` } })))
    }

    function ModelRow({ model, tr }) {
      const [open, setOpen] = useState(false)
      const history = open ? h('div', { className: 'dsor-details' },
        model.description ? h('div', { className: 'dsor-desc' }, model.description) : null,
        h(PriceHistory, { points: model.price_history, tr }),
        model.prev ? h('div', null, tr('details.prev', { in: `$${fmtUsd(model.prev.prompt_usd_per_1m)}`, out: `$${fmtUsd(model.prev.completion_usd_per_1m)}` })) : null,
        model.high_30d ? h('div', null, tr('details.high', { in: `$${fmtUsd(model.high_30d.prompt_usd_per_1m)}`, out: `$${fmtUsd(model.high_30d.completion_usd_per_1m)}` })) : null,
        model.expiration_date ? h('div', null, tr('details.expires', { date: model.expiration_date })) : null,
        h('div', { style: { marginTop: '4px' } }, h('a', {
          href: `https://openrouter.ai/${model.id}`,
          target: '_blank',
          rel: 'noreferrer',
          style: { color: 'var(--dsw-alias-link, #4d8dff)' },
        }, tr('details.open')))) : null
      return h('div', { className: 'dsor-row' },
        h('div', { className: 'dsor-rowin', onClick: () => setOpen((value) => !value) },
          h('div', { className: 'dsor-main' },
            h('div', { className: 'dsor-name', title: model.name }, model.name),
            h('div', { className: 'dsor-id' }, model.id),
            h('div', { className: 'dsor-meta' },
              h('span', { className: 'dsor-badge' }, tr('context', { ctx: contextText(model.context_length) })),
              h(ModalityBadges, { model, tr }),
              h(Badges, { model, tr }))),
          h('div', { className: 'dsor-price' }, priceCell(model, tr))),
        history)
    }

    function Journal({ events, unread, onRead, tr }) {
      if (!events.length) return null
      return h('div', { className: 'dsor-journal' },
        h('div', { className: 'dsor-jhead' },
          h('b', null, tr('journal')),
          unread > 0 ? h('span', { className: 'dsor-badge hot' }, tr('journal.new', { n: unread })) : null,
          h('span', { className: 'dsor-grow' }),
          unread > 0 ? h('button', { type: 'button', className: 'dsor-linkbtn', onClick: onRead }, tr('journal.read')) : null),
        events.slice(0, 10).map((event) => h('div', { className: 'dsor-event', key: event.id },
          h('span', { className: 't' }, relativeTime(event.at, tr)),
          h('span', { className: 'dsor-badge ' + (event.severity === 'hot' ? 'hot' : event.severity === 'warn' ? 'warn' : '') }, eventLabel(event.type, tr)),
          h('span', { className: 'm', title: event.detail || '' }, event.model_name || event.title))))
    }

    /* ------------------------------------------------------------------ */
    /* Composer integration: price labels and the catalog popup menu.      */
    /* ------------------------------------------------------------------ */

    let catalogCache = null
    let catalogPromise = null

    function invalidateCatalog() {
      catalogCache = null
      catalogPromise = null
    }

    function loadCatalog(force) {
      if (force) invalidateCatalog()
      if (catalogCache) return Promise.resolve(catalogCache)
      if (!catalogPromise) {
        catalogPromise = getJson('/models')
          .then((data) => {
            const models = Array.isArray(data.models) ? data.models : []
            catalogCache = {
              models,
              map: new Map(models.map((model) => [model.id, model])),
              status: data.status || null,
              at: Date.now(),
            }
            catalogPromise = null
            return catalogCache
          })
          .catch((error) => {
            catalogPromise = null
            throw error
          })
      }
      return catalogPromise
    }

    /** Shared, lazily loaded catalog for the labels and the menu. */
    function useCatalog() {
      const [catalog, setCatalog] = useState(catalogCache)
      useEffect(() => {
        let alive = true
        if (!catalog) {
          loadCatalog().then((next) => {
            if (alive) setCatalog(next)
          }).catch(() => {})
        }
        return () => {
          alive = false
        }
      }, [])
      return catalog
    }

    /**
     * `conversation.input.model.label` contribution: price of the model in the
     * model list, trigger, and `/model` rows. Non-interactive inline content.
     */
    function ModelPriceLabel(props) {
      const tr = makeTranslator(props && props.t)
      const catalog = useCatalog()
      const model = props && props.model ? props.model : null
      if (!model) return null
      const name = h('span', null, model.name || model.id)
      const info = catalog && model.id ? catalog.map.get(model.id) : null
      if (!info || info.status === 'removed') return name
      if (info.is_free) {
        return h('span', null, name, h('span', { className: 'dsor-badge ok', style: { marginLeft: '6px' } }, tr('price.free')))
      }
      return h('span', null,
        name,
        h('span', { className: 'dsor-price-label' }, `$${fmtUsd(info.prompt_usd_per_1m)}/$${fmtUsd(info.completion_usd_per_1m)}`),
        info.discount ? h('span', { className: 'dsor-price-label hot' }, ` −${info.discount.pct}%`) : null)
    }

    /** The composer pill that opens the OpenRouter catalog menu. */
    function CatalogMenu(props) {
      const tr = makeTranslator(props && props.t)
      const useSession = props && props.useSession
      const sessionId = typeof useSession === 'function'
        ? useSession((state) => state && state.sessionId)
        : undefined
      const [catalog, setCatalog] = useState(catalogCache)
      const [open, setOpen] = useState(false)
      const [position, setPosition] = useState(null)
      const [query, setQuery] = useState('')
      const [filter, setFilter] = useState('all')
      const [syncing, setSyncing] = useState(false)
      const [auto, setAuto] = useState(null)
      const [using, setUsing] = useState(null)
      const [notice, setNotice] = useState(null)
      const anchorRef = useRef(null)
      const panelRef = useRef(null)

      const place = () => {
        const rect = anchorRef.current && anchorRef.current.getBoundingClientRect()
        if (!rect) return
        const width = Math.min(420, Math.max(300, window.innerWidth - 24))
        setPosition({
          width,
          right: Math.max(12, window.innerWidth - rect.right),
          bottom: Math.max(12, window.innerHeight - rect.top + 8),
        })
      }

      useEffect(() => {
        if (!open) return undefined
        ensureStyle()
        place()
        const onResize = () => place()
        const onDown = (event) => {
          const anchor = anchorRef.current
          const panel = panelRef.current
          if (anchor && anchor.contains(event.target)) return
          if (panel && panel.contains(event.target)) return
          setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('resize', onResize)
        document.addEventListener('pointerdown', onDown, true)
        document.addEventListener('keydown', onKey)
        return () => {
          window.removeEventListener('resize', onResize)
          document.removeEventListener('pointerdown', onDown, true)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      useEffect(() => {
        if (!open) return undefined
        let alive = true
        loadCatalog(!!catalog && Date.now() - catalog.at > 60000)
          .then((next) => {
            if (alive && next) setCatalog({ ...next })
          })
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [open])

      const refresh = async () => {
        if (syncing) return
        setSyncing(true)
        setNotice(null)
        try {
          await postJson('/sync')
          const next = await loadCatalog(true)
          if (next) setCatalog({ ...next })
          setNotice({ ok: true, text: tr('toast.synced', { n: next && next.status && next.status.totals ? next.status.totals.models : '?' }) })
        } catch (error) {
          setNotice({ ok: false, text: error instanceof Error ? error.message : String(error) })
        } finally {
          setSyncing(false)
        }
      }

      const runAutoRoute = async () => {
        if (auto && auto.running) return
        if (!sessionId) {
          setNotice({ ok: false, text: tr('toast.noSession') })
          return
        }
        setAuto({ running: true, result: null })
        try {
          const result = await postJson('/auto-route', { sessionId })
          setAuto({ running: false, result })
          if (result && result.ok) {
            setNotice({ ok: true, text: tr('toast.routed', { name: result.routed && result.routed.name ? result.routed.name : result.routed && result.routed.model }) })
          }
        } catch (error) {
          setAuto({ running: false, result: { ok: false, error: error instanceof Error ? error.message : String(error) } })
        }
      }

      const applyModel = async (model) => {
        if (!sessionId) {
          setNotice({ ok: false, text: tr('toast.noSession') })
          return
        }
        if (using) return
        setUsing(model.id)
        setNotice(null)
        try {
          const result = await postJson('/use-model', { sessionId, model: model.id })
          if (result && result.ok) {
            const name = result.model && result.model.name ? result.model.name : model.id
            setNotice({ ok: true, text: tr('toast.routed', { name }) + (result.config_changed ? tr('toast.routedConfig') : '') })
            setOpen(false)
          } else {
            setNotice({ ok: false, text: (result && result.error) || tr('toast.useFailed') })
          }
        } catch (error) {
          setNotice({ ok: false, text: error instanceof Error ? error.message : String(error) })
        } finally {
          setUsing(null)
        }
      }

      const openTab = () => {
        try {
          if (props && typeof props.openPanel === 'function') props.openPanel()
        } catch {
          /* the sidebar service may be absent in a minimal composition */
        }
        setOpen(false)
      }

      const visible = useMemo(() => {
        let list = catalog && Array.isArray(catalog.models) ? catalog.models : []
        const needle = query.trim().toLowerCase()
        if (filter === 'free') list = list.filter((model) => model.is_free)
        if (filter === 'discount') list = list.filter((model) => model.discount)
        if (needle) list = list.filter((model) => `${model.id} ${model.name} ${model.author}`.toLowerCase().includes(needle))
        const score = (model) => (model.discount ? model.discount.pct * 1000 : 0)
          + (model.is_free ? 500 : 0)
          + Math.min(400, (model.context_length || 0) / 5000)
        return [...list].sort((a, b) => score(b) - score(a)).slice(0, 80)
      }, [catalog, query, filter])

      const totals = (catalog && catalog.status && catalog.status.totals) || null

      const pill = h('button', {
        type: 'button',
        className: 'dsor-pill',
        'data-open': open ? '1' : '0',
        title: tr('title'),
        onClick: () => setOpen((value) => !value),
      }, h('span', null, '🛷'), h('span', null, 'explorer'))

      const head = h('div', { className: 'dsor-panel-head' },
        h('b', null, tr('menu.title')),
        h('span', { className: 'dsor-price-label', style: { marginLeft: 0 } },
          totals ? tr('menu.summary', totals) : tr('menu.loading')),
        h('span', { style: { flex: 1 } }),
        h('button', {
          type: 'button', className: 'dsor-iconbtn', title: tr('refresh'),
          onClick: refresh, disabled: syncing || !!(catalog && catalog.status && catalog.status.in_flight),
        }, syncing ? h('span', { className: 'dsor-spin' }) : '⟳'),
        h('button', { type: 'button', className: 'dsor-iconbtn', title: tr('close'), onClick: () => setOpen(false) }, '×'))

      const autoResult = auto && auto.result
        ? h('div', { className: 'dsor-toast ' + (auto.result.ok ? 'ok' : 'bad') },
          auto.result.ok
            ? `${auto.result.routed && auto.result.routed.name ? auto.result.routed.name : ''} · ${tr('context', { ctx: contextText(auto.result.routed && auto.result.routed.context_length) })} · ${auto.result.routed ? auto.result.routed.latency_ms : '?'} ms`
            : auto.result.error || tr('toast.autoFailed'))
        : null

      const actions = h('div', { className: 'dsor-panel-actions' },
        h('button', {
          type: 'button', className: 'dsor-free-btn', onClick: runAutoRoute,
          disabled: !!(auto && auto.running) || !sessionId,
        },
          auto && auto.running ? h('span', { className: 'dsor-spin' }) : h('span', null, '🛷'),
          auto && auto.running ? tr('auto.running') : tr('auto.run'),
          h('small', null, tr('auto.hint'))),
        autoResult)

      const chips = h('div', { className: 'dsor-chips' },
        [['all', `${tr('filter.all')} (${totals ? totals.models : '…'})`], ['free', `${tr('filter.free')} (${totals ? totals.free : '…'})`], ['discount', `${tr('filter.discount')} (${totals ? totals.discounts : '…'})`]]
          .map(([value, label]) => h('button', {
            key: value, type: 'button', className: 'dsor-chip', 'data-on': filter === value ? '1' : '0',
            onClick: () => setFilter(value),
          }, label)))

      const filters = h('div', { className: 'dsor-filters' },
        h('input', {
          className: 'dsor-search', placeholder: tr('search'),
          value: query, onChange: (event) => setQuery(event.target.value),
        }),
        chips)

      const row = (model) => h('button', {
        key: model.id, type: 'button', className: 'dsor-mini', title: model.id,
        onClick: () => applyModel(model), disabled: !!using,
      },
        h('span', { className: 'n' },
          h('b', null, model.name),
          h('small', null, h(ModalityBadges, { model, tr }), ` ${model.id} · ${tr('context', { ctx: contextText(model.context_length) })}`),
          h('small', null, model.is_free
            ? tr('price.free')
            : tr('price.per1m', { in: fmtUsd(model.prompt_usd_per_1m), out: fmtUsd(model.completion_usd_per_1m) }) + (model.discount ? ' · ' + tr('price.discount', { pct: model.discount.pct }) : ''))),
        h('span', { className: 'p' }, using === model.id ? h('span', { className: 'dsor-spin' }) : '→'))

      const body = h('div', { className: 'dsor-panel-body' },
        !catalog
          ? h('div', { className: 'dsor-empty' }, tr('empty.loading'))
          : visible.length === 0
            ? h('div', { className: 'dsor-empty' }, tr('empty.notfound'))
            : visible.map(row))

      const foot = h('div', { className: 'dsor-foot' },
        h('button', { type: 'button', className: 'dsor-linkbtn', onClick: openTab }, tr('menu.openTab')),
        h('span', { style: { flex: 1 } }),
        h('span', { className: 'dsor-price-label' },
          catalog && catalog.status && catalog.status.synced_at ? tr('updated', { ago: relativeTime(catalog.status.synced_at, tr) }) : ''))

      const panel = open && position
        ? h('div', {
          className: 'dsor-panel',
          ref: panelRef,
          style: { width: `${position.width}px`, right: `${position.right}px`, bottom: `${position.bottom}px` },
        }, head, notice ? h('div', { className: 'dsor-toast ' + (notice.ok ? 'ok' : 'bad') }, notice.text) : null, actions, filters, body, foot)
        : null

      return h('span', { className: 'dsor-anchor', ref: anchorRef }, pill, panel)

    }

    function AutoRoutePanel({ state, onRun, disabled, tr }) {
      return h('div', null,
        h('button', {
          type: 'button',
          className: 'dsor-free-btn',
          onClick: onRun,
          disabled: disabled || state?.running,
          title: tr('auto.run'),
        },
          state?.running ? h('span', { className: 'dsor-spin' }) : h('span', null, '🛷'),
          state?.running ? tr('auto.running') : tr('auto.run'),
          h('small', null, tr('auto.hint'))),
        state?.result ? h('div', { className: 'dsor-result ' + (state.result.ok ? 'ok' : 'bad') },
          state.result.ok
            ? h('div', null,
              h('b', null, state.result.routed?.name || state.result.routed?.model),
              h('div', null, `контекст ${contextText(state.result.routed?.context_length)} · пинг ${state.result.routed?.latency_ms} мс · бесплатно`),
              h('div', { className: 'dsor-attempt' }, tr('toast.routed', { name: `${state.result.routed?.provider}/${state.result.routed?.model}` }) + (state.result.routed?.config_changed ? tr('toast.routedConfig') : '')))
            : h('div', null, h('b', null, tr('toast.autoFailed') + ': '), state.result.error),
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
      const tr = makeTranslator(props && props.t)
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

      const head = h('div', { className: 'dsor-head' },
        h('div', { className: 'dsor-grow' },
          h('div', { className: 'dsor-title' }, tr('title')),
          h('div', { className: 'dsor-sub' },
            status?.synced_at
              ? tr('status.updated', { ago: relativeTime(status.synced_at, tr), eta: untilText(status.next_sync_at, tr) })
              : tr('status.never'))),
        h('button', {
          type: 'button', className: 'dsor-iconbtn', title: tr('refresh'), onClick: refresh,
          disabled: syncing || !!status?.in_flight,
        }, syncing || status?.in_flight ? h('span', { className: 'dsor-spin' }) : '⟳'))

      const kpis = h('div', { className: 'dsor-kpis' },
        h('div', { className: 'dsor-kpi' }, h('b', null, totals.models), h('span', null, tr('kpi.models'))),
        h('div', { className: 'dsor-kpi' }, h('b', null, totals.free), h('span', null, tr('kpi.free'))),
        h('div', { className: 'dsor-kpi' }, h('b', null, totals.discounts), h('span', null, tr('kpi.discounts'))),
        h('div', { className: 'dsor-kpi' }, h('b', null, totals.new_7d), h('span', null, tr('kpi.new'))))

      const chips = h('div', { className: 'dsor-chips' },
        ['all', 'free', 'discount'].map((value) => {
          const label = value === 'all' ? tr('filter.all') : value === 'free' ? tr('filter.free') : tr('filter.discount')
          const count = value === 'all' ? models.length : value === 'free' ? totals.free : totals.discounts
          return h('button', {
            key: value, type: 'button', className: 'dsor-chip', 'data-on': filter === value ? '1' : '0',
            onClick: () => setFilter(value),
          }, `${label} (${count})`)
        }))

      const filters = h('div', { className: 'dsor-filters' },
        h('input', {
          className: 'dsor-search', placeholder: tr('search'), value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        chips)

      const list = loading
        ? h('div', { className: 'dsor-empty' }, tr('empty.loading'))
        : filtered.length === 0
          ? h('div', { className: 'dsor-empty' }, status?.synced_at ? tr('empty.notfound') : tr('empty.nocatalog'))
          : h('div', { className: 'dsor-list' }, filtered.slice(0, 400).map((model) => h(ModelRow, { key: model.id, model, tr })))

      return h('div', { className: 'dsor-root' },
        head,
        error ? h('div', { className: 'dsor-err' }, error) : null,
        h(AutoRoutePanel, { state: auto, onRun: runAutoRoute, disabled: !!status?.in_flight, tr }),
        kpis,
        filters,
        list,
        h(Journal, { events, unread, onRead: readEvents, tr }))

    }

    /** Tab declaration: a page type with one guide entry, localized via the bound translator. */
    function createDefinition(tr) {
      return {
        id: TAB_ID,
        kind: TAB_KIND,
        title: () => tr('title'),
        guide: [{
          id: 'openrouter',
          order: 55,
          title: () => tr('guide.title'),
          description: () => tr('guide.desc'),
        }],
      }
    }

    /** Register the tab, the composer menu and the model price labels. */
    function apply(ctx) {
      ensureStyle()

      // Locale dictionaries live with the harness locale service; without it we
      // keep the Russian copy. Slot registrations carry `locale` so the renderer
      // hands each component a live `t` that follows the user's language.
      const locale = ctx.get('locale')
      if (locale && typeof locale.register === 'function') {
        ctx.effect(() => locale.register(NS, MESSAGES), 'openrouter-explorer-free: locale')
      }
      const bind = locale && typeof locale.bind === 'function' ? locale.bind(NS) : null
      const tr = makeTranslator(bind)
      const definition = createDefinition(tr)

      ctx.effect(() => ctx.sidebarRightTabs.register(definition), 'openrouter-explorer-free: tab type')
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
        locale: NS,
      }, OpenRouterTab)), 'openrouter-explorer-free: tab body')

      // Price / free / discount badges inside the built-in model selector.
      // A single slot: priority -1 shadows the temporary 1017 badge plugin.
      ctx.effect(() => ctx.slots.inject('conversation.input.model.label', () => ctx.slots.register({
        name: 'conversation.input.model.label',
        priority: -1,
        locale: NS,
      }, ModelPriceLabel)), 'openrouter-explorer-free: model price labels')

      // The "explorer" pill in the composer, right beside the model selector.
      ctx.effect(() => ctx.slots.inject('conversation.input.right', () => {
        const MenuEntry = (props) => h(CatalogMenu, {
          ...props,
          openPanel: () => {
            try {
              const sidebarRight = ctx.get('sidebarRight')
              if (sidebarRight && typeof sidebarRight.openTab === 'function') sidebarRight.openTab(TAB_KIND)
            } catch {
              /* minimal compositions may omit the right sidebar */
            }
          },
        })
        return ctx.slots.register({ name: 'conversation.input.right', id: 'openrouter-explorer-free-menu', order: 10, locale: NS }, MenuEntry)
      }), 'openrouter-explorer-free: composer menu')
    }

    exports.inject = ['slots', 'sidebarRightTabs']
    exports.apply = apply
    return module.exports
  },
})
