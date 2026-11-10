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
    /** Product mark: the brand logo links to the vendor site with campaign attribution. */
    const BRAND_URL = 'https://lidogenerator.top/?utm_source=openrouter-explorer-free&utm_medium=app&utm_campaign=brand'
    const BRAND_LOGO = '/openrouter-explorer-free/brand/logo.svg'
    // Embedded so the composer pill renders immediately, even before a host restart
    // picks up the /brand/truck.svg route.
    const PRODUCT_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyNiIgZmlsbD0iIzc2MjRGNCIvPgoKICA8IS0tIHN1c3BlbnNpb24gLyBheGxlcyAtLT4KICA8cmVjdCB4PSIzMCIgeT0iNTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSI0NiIgcng9IjMiIGZpbGw9IiNDOEZGMDAiLz4KICA8cmVjdCB4PSI4OCIgeT0iNTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSI0NiIgcng9IjMiIGZpbGw9IiNDOEZGMDAiLz4KCiAgPCEtLSBoaWdoLXJpZGluZyBTVVYgYm9keSAtLT4KICA8cGF0aCBmaWxsPSIjQzhGRjAwIiBkPSJNMTIgNjQgTDE2IDQ2IEwzOSA0MiBMNTAgMjYgTDg0IDI2IEw5NyA0MiBMMTExIDQ2IEwxMTUgNjIgTDExNSA2NyBMMTIgNjcgWiIvPgogIDwhLS0gd2luZHNoaWVsZCArIHNpZGUgd2luZG93IC0tPgogIDxwYXRoIGZpbGw9IiM3NjI0RjQiIGQ9Ik00NyA0MiBMNTcgMzAgTDc4IDMwIEw5MCA0MiBaIi8+CiAgPHBhdGggZmlsbD0iIzc2MjRGNCIgZD0iTTUyIDQ3IEw1OSA0MCBMODYgNDAgTDk0IDQ3IFoiLz4KCiAgPCEtLSBodWdlIGtub2JieSB3aGVlbHMgLS0+CiAgPGcgZmlsbD0iI0M4RkYwMCI+CiAgICA8Y2lyY2xlIGN4PSIzNSIgY3k9IjkyIiByPSIyMyIvPgogICAgPGNpcmNsZSBjeD0iOTMiIGN5PSI5MiIgcj0iMjMiLz4KICA8L2c+CiAgPGcgZmlsbD0iIzc2MjRGNCI+CiAgICA8Y2lyY2xlIGN4PSIzNSIgY3k9IjkyIiByPSI5Ii8+CiAgICA8Y2lyY2xlIGN4PSI5MyIgY3k9IjkyIiByPSI5Ii8+CiAgPC9nPgogIDxnIHN0cm9rZT0iIzc2MjRGNCIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoMCAzNSA5MikiPjxwYXRoIGQ9Ik0zNSA2NiBMMzUgNzIiLz48L2c+CiAgICA8ZyB0cmFuc2Zvcm09InJvdGF0ZSg0NSAzNSA5MikiPjxwYXRoIGQ9Ik0zNSA2NiBMMzUgNzIiLz48L2c+CiAgICA8ZyB0cmFuc2Zvcm09InJvdGF0ZSg5MCAzNSA5MikiPjxwYXRoIGQ9Ik0zNSA2NiBMMzUgNzIiLz48L2c+CiAgICA8ZyB0cmFuc2Zvcm09InJvdGF0ZSgxMzUgMzUgOTIpIj48cGF0aCBkPSJNMzUgNjYgTDM1IDcyIi8+PC9nPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDM1IDkyKSI+PHBhdGggZD0iTTM1IDY2IEwzNSA3MiIvPjwvZz4KICAgIDxnIHRyYW5zZm9ybT0icm90YXRlKDIyNSAzNSA5MikiPjxwYXRoIGQ9Ik0zNSA2NiBMMzUgNzIiLz48L2c+CiAgICA8ZyB0cmFuc2Zvcm09InJvdGF0ZSgyNzAgMzUgOTIpIj48cGF0aCBkPSJNMzUgNjYgTDM1IDcyIi8+PC9nPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoMzE1IDM1IDkyKSI+PHBhdGggZD0iTTM1IDY2IEwzNSA3MiIvPjwvZz4KICAgIDxnIHRyYW5zZm9ybT0icm90YXRlKDAgOTMgOTIpIj48cGF0aCBkPSJNOTMgNjYgTDkzIDcyIi8+PC9nPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoNDUgOTMgOTIpIj48cGF0aCBkPSJNOTMgNjYgTDkzIDcyIi8+PC9nPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoOTAgOTMgOTIpIj48cGF0aCBkPSJNOTMgNjYgTDkzIDcyIi8+PC9nPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoMTM1IDkzIDkyKSI+PHBhdGggZD0iTTkzIDY2IEw5MyA3MiIvPjwvZz4KICAgIDxnIHRyYW5zZm9ybT0icm90YXRlKDE4MCA5MyA5MikiPjxwYXRoIGQ9Ik05MyA2NiBMOTMgNzIiLz48L2c+CiAgICA8ZyB0cmFuc2Zvcm09InJvdGF0ZSgyMjUgOTMgOTIpIj48cGF0aCBkPSJNOTMgNjYgTDkzIDcyIi8+PC9nPgogICAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoMjcwIDkzIDkyKSI+PHBhdGggZD0iTTkzIDY2IEw5MyA3MiIvPjwvZz4KICAgIDxnIHRyYW5zZm9ybT0icm90YXRlKDMxNSA5MyA5MikiPjxwYXRoIGQ9Ik05MyA2NiBMOTMgNzIiLz48L2c+CiAgPC9nPgo8L3N2Zz4K'
    /** Transparent lime silhouette for coloured buttons (no purple tile inside the button). */
    const PRODUCT_LOGO_LIME = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPGRlZnM+CiAgICA8bWFzayBpZD0idHJ1Y2stY3V0Ij4KICAgICAgPGcgZmlsbD0iI2ZmZiI+CiAgICAgICAgPHJlY3QgeD0iMzAiIHk9IjUwIiB3aWR0aD0iMTAiIGhlaWdodD0iNDYiIHJ4PSIzIi8+CiAgICAgICAgPHJlY3QgeD0iODgiIHk9IjUwIiB3aWR0aD0iMTAiIGhlaWdodD0iNDYiIHJ4PSIzIi8+CiAgICAgICAgPHBhdGggZD0iTTEyIDY0IEwxNiA0NiBMMzkgNDIgTDUwIDI2IEw4NCAyNiBMOTcgNDIgTDExMSA0NiBMMTE1IDYyIEwxMTUgNjcgTDEyIDY3IFoiLz4KICAgICAgICA8Y2lyY2xlIGN4PSIzNSIgY3k9IjkyIiByPSIyMyIvPgogICAgICAgIDxjaXJjbGUgY3g9IjkzIiBjeT0iOTIiIHI9IjIzIi8+CiAgICAgIDwvZz4KICAgICAgPGcgZmlsbD0iIzAwMCI+CiAgICAgICAgPHBhdGggZD0iTTQ3IDQyIEw1NyAzMCBMNzggMzAgTDkwIDQyIFoiLz4KICAgICAgICA8cGF0aCBkPSJNNTIgNDcgTDU5IDQwIEw4NiA0MCBMOTQgNDcgWiIvPgogICAgICAgIDxjaXJjbGUgY3g9IjM1IiBjeT0iOTIiIHI9IjkiLz4KICAgICAgICA8Y2lyY2xlIGN4PSI5MyIgY3k9IjkyIiByPSI5Ii8+CiAgICAgIDwvZz4KICAgIDwvbWFzaz4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiNDOEZGMDAiIG1hc2s9InVybCgjdHJ1Y2stY3V0KSIvPgo8L3N2Zz4K'
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
        'auto.running': 'Ищем бесплатную модель…',
        'balance.label': 'Баланс OpenRouter',
        'balance.topUp': 'Пополнить',
        'balance.title': 'куплено {total} · использовано {used}',
        'balance.openHint': 'пополнение — на сайте OpenRouter; плагин платежи не обрабатывает',
        'view.generation': 'Генерация',
        'gen.image': 'Картинки',
        'gen.video': 'Видео',
        'gen.speech': 'Звук',
        'gen.model': 'Модель',
        'gen.modelLoading': 'загружаем модели…',
        'gen.searchModels': 'поиск модели: id или название',
        'gen.modelsCount': '{n} из {total}',
        'gen.noModelsFound': 'ничего не найдено',
        'gen.pricePerSecond': '{price}/с',
        'gen.freeOnly': 'только бесплатные',
        'gen.freeBadge': 'бесплатно',
        'gen.freeNone': 'бесплатных моделей этого типа сейчас нет',
        'chat.notForChat': 'не для чата',
        'chat.notForChatTitle': 'модель генерирует медиа или ждёт видео/аудио — для чата не подходит; генерация — во вкладке «Генерация»',
        'chat.openGeneration': 'Открыть «Генерацию»',
        'favorites.filter': 'Избранное',
        'favorites.add': 'В избранное',
        'favorites.remove': 'Убрать из избранного',
        'health.check': 'Проверить фри',
        'health.checking': 'Проверяю…',
        'health.summary': '{ok}/{total} живы',
        'health.dead': 'не отвечает',
        'health.alive': 'живая',
        'health.never': 'не проверялась',
        'health.error': 'проверка недоступна',
        'health.title': 'Пинг бесплатных моделей через OpenRouter',
        'export.csv': 'CSV',
        'export.json': 'JSON',
        'export.title': 'Скачать текущую выборку',
        'preset.all': 'Все',
        'preset.cheap': 'Дешёвые',
        'preset.long': 'Длинный контекст',
        'preset.code': 'Код',
        'preset.reset': 'Сброс',
        'badge.new': 'NEW',
        'badge.newTitle': 'новая в каталоге (7 дней)',
        'badge.cheaper': '↓{pct}%',
        'badge.expensive': '↑{pct}%',
        'badge.priceMuchCheaper': 'подешевела с прошлого снапшота',
        'badge.priceMuchExpensive': 'подорожала с прошлого снапшота',
        'help.title': 'OpenRouter Explorer Free',
        'help.subtitle': 'Что умеет плагин и с чего начать',
        'help.balance': 'Баланс и ключ: ключ живёт в credentials DSH, пополнение — на сайте OpenRouter.',
        'help.filters': 'Фильтры, модальности, пресеты и избранное — чтобы быстро найти модель под задачу.',
        'help.auto': '«Едем на халяву» пингует бесплатные модели и переключает на живую.',
        'help.gen': 'Вкладка «Генерация»: картинки, видео и озвучка — только внешними API OpenRouter.',
        'help.health': '«Проверить фри» пингует бесплатные модели и показывает, кто реально отвечает.',
        'help.close': 'Понятно',
        'help.open': 'Что нового',
        'gen.gallery': 'Недавние генерации',
        'gen.galleryEmpty': 'Пока ничего не сгенерировано',
        'gen.galleryRefresh': 'Обновить',
        'gen.variants': 'Вариантов',
        'gen.tpl.image.0': 'Портрет с мягким светом',
        'gen.tpl.image.1': 'Товар на белом фоне',
        'gen.tpl.image.2': 'Обложка 16:9',
        'gen.tpl.image.3': 'Иконка приложения',
        'gen.tpl.video.0': 'Облёт дроном',
        'gen.tpl.video.1': 'Закат над морем',
        'gen.tpl.video.2': 'Продуктовый ролик',
        'gen.tpl.speech.0': 'Приветствие',
        'gen.tpl.speech.1': 'Озвучка новости',
        'gen.tpl.speech.2': 'Реклама 15 секунд',
        'compare.title': 'Сравнение моделей',
        'compare.add': 'Добавить к сравнению',
        'compare.remove': 'Убрать',
        'compare.open': 'Сравнить ({n})',
        'compare.clear': 'Очистить',
        'compare.param': 'Параметр',
        'compare.context': 'Контекст',
        'compare.priceIn': 'Вход $/1M',
        'compare.priceOut': 'Выход $/1M',
        'compare.free': 'Бесплатная',
        'compare.input': 'Вход',
        'compare.output': 'Выход',
        'compare.discount': 'Скидка',
        'full.open': 'Развернуть',
        'full.close': 'Свернуть',
        'providers.title': 'Провайдеры',
        'providers.load': 'Показать провайдеров',
        'providers.empty': 'эндпоинты не найдены',
        'providers.note': 'Данные OpenRouter по эндпоинтам; routing задаётся на стороне провайдера DSH.',
        'gen.repeat': 'Повторить',
        'gen.delete': 'Удалить',
        'alert.low': 'Баланс ниже $5 — пополните на openrouter.ai',
        'alert.newFree': '{n} новых бесплатных моделей',
        'alert.freeFilter': 'Показать бесплатные',
        'balance.days': '≈ {n} дн.',
        'balance.daysTitle': 'прогноз по расходу за последние дни',
        'brand.text': 'lidogenerator.top',
        'brand.title': 'Lidogen 360 — сайты и лендинги, которые приносят клиентов',
        'gen.prompt': 'что нарисовать или сгенерировать',
        'gen.promptSpeech': 'текст для озвучки',
        'gen.aspect': 'Пропорции',
        'gen.resolution': 'Разрешение',
        'gen.quality': 'Качество',
        'gen.duration': 'Длительность, с',
        'gen.audio': 'со звуком',
        'gen.voice': 'Голос',
        'gen.format': 'Формат',
        'gen.speed': 'Скорость',
        'gen.generate': 'Сгенерировать',
        'gen.busy': 'Генерируем…',
        'gen.error': 'Ошибка: {message}',
        'gen.cost': 'стоимость {cost}',
        'gen.estimate': '≈ {cost} за {duration} с',
        'gen.videoStatus': 'видео: {status}',
        'gen.recent': 'Последние файлы',
        'gen.empty': 'Пока ничего не сгенерировано',
        'gen.download': 'Скачать',
        'kpi.models': 'моделей',
        'kpi.free': 'бесплатных',
        'kpi.discounts': 'со скидкой',
        'kpi.new': 'новинок за 7 дн',
        'search': 'поиск: id, название, автор',
        'filter.all': 'Все',
        'filter.free': 'Бесплатные',
        'filter.discount': 'Скидки',
        'filter.modality': 'Тип модели',
        'filter.modalityHint': 'в том числе мультимодальные: универсальная модель остаётся в каждой своей категории',
        'filter.modality.text': 'Текст',
        'filter.modality.image': 'Картинки',
        'filter.modality.video': 'Видео',
        'filter.modality.audio': 'Аудио',
        'filter.modality.file': 'Файлы',
        'view.catalog': 'Каталог',
        'view.rankings': 'Рейтинги',
        'ranking.usage': 'По использованию',
        'ranking.coding': 'Кодинг-бенчмарк',
        'ranking.refresh': 'Обновить рейтинги',
        'ranking.loading': 'загружаем рейтинги…',
        'ranking.error': 'Рейтинги не загрузились: {message}',
        'ranking.stale': 'показаны прошлые данные',
        'ranking.updated': 'обновлено {ago}',
        'ranking.tokens': 'токены',
        'ranking.tokensHint': 'суммарные токены за неделю по данным OpenRouter',
        'ranking.changeHint': 'изменение к прошлому замеру',
        'ranking.shareHint': 'доля от общего объёма токенов',
        'ranking.scoresHint': '0–100, Artificial Analysis',
        'ranking.intelligence': 'интеллект',
        'ranking.agentic': 'агентность',
        'ranking.empty': 'Рейтинги пусты — нажмите ⟳.',
        'ranking.open': 'открыть на openrouter.ai/rankings',
        'error.crash': 'Модуль OpenRouter упал: {message}. Перезагрузите страницу — остальные окна не затронуты.',
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
        'auto.running': 'Looking for a free model…',
        'balance.label': 'OpenRouter balance',
        'balance.topUp': 'Top up',
        'balance.title': 'purchased {total} · used {used}',
        'balance.openHint': 'top-up happens on the OpenRouter website; the plugin never handles payments',
        'view.generation': 'Generation',
        'gen.image': 'Images',
        'gen.video': 'Video',
        'gen.speech': 'Speech',
        'gen.model': 'Model',
        'gen.modelLoading': 'loading models…',
        'gen.searchModels': 'search models: id or name',
        'gen.modelsCount': '{n} of {total}',
        'gen.noModelsFound': 'nothing found',
        'gen.pricePerSecond': '{price}/s',
        'gen.freeOnly': 'free only',
        'gen.freeBadge': 'free',
        'gen.freeNone': 'no free models of this type right now',
        'chat.notForChat': 'not for chat',
        'chat.notForChatTitle': 'the model generates media or expects video/audio input — use the Generation tab instead',
        'chat.openGeneration': 'Open Generation',
        'favorites.filter': 'Favorites',
        'favorites.add': 'Add to favorites',
        'favorites.remove': 'Remove from favorites',
        'health.check': 'Check free',
        'health.checking': 'Checking…',
        'health.summary': '{ok}/{total} alive',
        'health.dead': 'not responding',
        'health.alive': 'alive',
        'health.never': 'not checked',
        'health.error': 'check unavailable',
        'health.title': 'Ping free models through OpenRouter',
        'export.csv': 'CSV',
        'export.json': 'JSON',
        'export.title': 'Download the current selection',
        'preset.all': 'All',
        'preset.cheap': 'Cheap',
        'preset.long': 'Long context',
        'preset.code': 'Code',
        'preset.reset': 'Reset',
        'badge.new': 'NEW',
        'badge.newTitle': 'new in the catalog (7 days)',
        'badge.cheaper': '↓{pct}%',
        'badge.expensive': '↑{pct}%',
        'badge.priceMuchCheaper': 'cheaper than the previous snapshot',
        'badge.priceMuchExpensive': 'more expensive than the previous snapshot',
        'help.title': 'OpenRouter Explorer Free',
        'help.subtitle': 'What the plugin does and where to start',
        'help.balance': 'Balance and key: the key stays in DSH credentials, top-up happens on the OpenRouter site.',
        'help.filters': 'Filters, modalities, presets and favorites help you find the right model fast.',
        'help.auto': '“Ride for free” pings free models and switches to a live one.',
        'help.gen': 'The “Generation” tab: images, video and speech via external OpenRouter APIs only.',
        'help.health': '“Check free” pings free models and shows which ones actually answer.',
        'help.close': 'Got it',
        'help.open': 'What is new',
        'gen.gallery': 'Recent generations',
        'gen.galleryEmpty': 'Nothing generated yet',
        'gen.galleryRefresh': 'Refresh',
        'gen.variants': 'Variants',
        'gen.tpl.image.0': 'Soft-light portrait',
        'gen.tpl.image.1': 'Product on white',
        'gen.tpl.image.2': '16:9 cover',
        'gen.tpl.image.3': 'App icon',
        'gen.tpl.video.0': 'Drone flyover',
        'gen.tpl.video.1': 'Sunset over the sea',
        'gen.tpl.video.2': 'Product commercial',
        'gen.tpl.speech.0': 'Greeting',
        'gen.tpl.speech.1': 'News voice-over',
        'gen.tpl.speech.2': '15-second ad',
        'compare.title': 'Compare models',
        'compare.add': 'Add to comparison',
        'compare.remove': 'Remove',
        'compare.open': 'Compare ({n})',
        'compare.clear': 'Clear',
        'compare.param': 'Parameter',
        'compare.context': 'Context',
        'compare.priceIn': 'Input $/1M',
        'compare.priceOut': 'Output $/1M',
        'compare.free': 'Free',
        'compare.input': 'Input',
        'compare.output': 'Output',
        'compare.discount': 'Discount',
        'full.open': 'Expand',
        'full.close': 'Collapse',
        'providers.title': 'Providers',
        'providers.load': 'Show providers',
        'providers.empty': 'no endpoints found',
        'providers.note': 'Endpoint data from OpenRouter; routing is configured by the DSH provider.',
        'gen.repeat': 'Repeat',
        'gen.delete': 'Delete',
        'alert.low': 'Balance below $5 — top up on openrouter.ai',
        'alert.newFree': '{n} new free models',
        'alert.freeFilter': 'Show free',
        'balance.days': '≈ {n} d',
        'balance.daysTitle': 'forecast from recent spending',
        'brand.text': 'lidogenerator.top',
        'brand.title': 'Lidogen 360 — websites and landing pages that bring clients',
        'gen.prompt': 'what to draw or generate',
        'gen.promptSpeech': 'text to speak',
        'gen.aspect': 'Aspect ratio',
        'gen.resolution': 'Resolution',
        'gen.quality': 'Quality',
        'gen.duration': 'Duration, s',
        'gen.audio': 'with audio',
        'gen.voice': 'Voice',
        'gen.format': 'Format',
        'gen.speed': 'Speed',
        'gen.generate': 'Generate',
        'gen.busy': 'Generating…',
        'gen.error': 'Error: {message}',
        'gen.cost': 'cost {cost}',
        'gen.estimate': '≈ {cost} for {duration} s',
        'gen.videoStatus': 'video: {status}',
        'gen.recent': 'Recent files',
        'gen.empty': 'Nothing generated yet',
        'gen.download': 'Download',
        'kpi.models': 'models',
        'kpi.free': 'free',
        'kpi.discounts': 'discounted',
        'kpi.new': 'new in 7 days',
        'search': 'search: id, name, author',
        'filter.all': 'All',
        'filter.free': 'Free',
        'filter.discount': 'Discounts',
        'filter.modality': 'Model type',
        'filter.modalityHint': 'multimodal included: a universal model stays in every category it supports',
        'filter.modality.text': 'Text',
        'filter.modality.image': 'Images',
        'filter.modality.video': 'Video',
        'filter.modality.audio': 'Audio',
        'filter.modality.file': 'Files',
        'view.catalog': 'Catalog',
        'view.rankings': 'Rankings',
        'ranking.usage': 'By usage',
        'ranking.coding': 'Coding benchmark',
        'ranking.refresh': 'Refresh rankings',
        'ranking.loading': 'loading rankings…',
        'ranking.error': 'Rankings failed to load: {message}',
        'ranking.stale': 'showing the previous snapshot',
        'ranking.updated': 'updated {ago}',
        'ranking.tokens': 'tokens',
        'ranking.tokensHint': 'total tokens per week according to OpenRouter',
        'ranking.changeHint': 'change against the previous sample',
        'ranking.shareHint': 'share of the total token volume',
        'ranking.scoresHint': '0–100, Artificial Analysis',
        'ranking.intelligence': 'intelligence',
        'ranking.agentic': 'agentic',
        'ranking.empty': 'Rankings are empty — press ⟳.',
        'ranking.open': 'open openrouter.ai/rankings',
        'error.crash': 'The OpenRouter module crashed: {message}. Reload the page — other panes are unaffected.',
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
  color:#ffffff; background: linear-gradient(135deg, #5a16c9 0%, #6d1ee6 55%, #7624f4 100%);
  box-shadow: var(--dsw-elevation-soft, 0 4px 14px rgba(118,36,244,.28)); transition: transform .12s ease, box-shadow .12s ease; }
.dsor-free-btn:hover:not([disabled]) { transform: translateY(-1px); box-shadow: var(--dsw-elevation-panel, 0 7px 18px rgba(118,36,244,.35)); }
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
.dsor-row { border-bottom:.5px solid var(--dsw-alias-border-l1, #333436);
  content-visibility:auto; contain-intrinsic-size:auto 62px; }
.dsor-rowin { display:flex; gap:8px; align-items:flex-start; padding:6px 2px; cursor:pointer;
  border-radius: var(--dsw-radius-sm, 6px); }
.dsor-rowin:hover { background: var(--dsw-alias-interactive-bg-hover, #3c3d3f); }
.dsor-star { background:none; border:0; padding:0 2px 0 0; color: var(--dsw-alias-label-tertiary, #9a9a9a);
  font-size:13px; line-height:1.25; cursor:pointer; }
.dsor-star[data-on="1"] { color:#ffcf4a; }
.dsor-health { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:0 12px 6px; }
.dsor-presets { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.dsor-filterline { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.dsor-help { position:fixed; inset:0; z-index:200; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.55); }
.dsor-help-card { width:min(430px, calc(100vw - 32px)); max-height:80vh; overflow:auto; padding:18px;
  border-radius: var(--dsw-radius-lg, 12px); border:.5px solid var(--dsw-alias-border-l2, #3a3b3d);
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); color: var(--dsw-alias-label-primary, #e8e8e8);
  box-shadow: var(--dsw-elevation-panel, 0 12px 32px rgba(0,0,0,.45)); font-size:12px; line-height:1.55; }
.dsor-help-card p.dsor-help-sub { margin:4px 0 10px; color: var(--dsw-alias-label-secondary, #b6b6b6); }
.dsor-help-card ul { margin:0 0 12px; padding-left:18px; }
.dsor-help-card li { margin:4px 0; }
.dsor-balance[data-low="1"] b { color: var(--dsw-alias-state-warn-primary, #ffb454); }
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
/* Modality filter: chips carry an icon, an inclusive match includes multimodal models. */
.dsor-mods-filter { display:flex; flex-direction:column; gap:3px; }
.dsor-filter-label { font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f); }
.dsor-mods-filter .dsor-chip { padding:2px 6px; font-size:10px; }
.dsor-chip-ico { margin-right:3px; }
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
.dsor-panel { position:fixed; z-index:120; display:flex; flex-direction:column; max-height:min(72vh, 470px);
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
.dsor-pill-logo { width:16px; height:16px; border-radius:4px; display:block; }
.dsor-free-btn-logo { width:19px; height:19px; display:block; flex:0 0 auto; }
.dsor-price-label.hot { color: var(--dsw-alias-state-warn-primary, #ff9a4d); }
.dsor-brand { display:flex; align-items:center; gap:5px; padding:5px 12px 8px;
  border-top:.5px solid var(--dsw-alias-border-l2, #3a3b3d);
  font-size:10px; color: var(--dsw-alias-label-tertiary, #8f8f8f); text-decoration:none; }
.dsor-brand:hover { color: var(--dsw-alias-label-primary, #e8e8e8); }
.dsor-brand-logo { width:15px; height:15px; border-radius:50%; background:#fff; padding:1px; box-sizing:border-box; }

/* Compare, providers, gallery, templates, alerts and the expanded mode. */
.dsor-alert { display:flex; align-items:center; gap:8px; margin:2px 12px 6px; padding:7px 10px;
  border-radius:8px; font-size:11px; border:.5px solid var(--dsw-alias-border-l2, #3a3b3d);
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); color: var(--dsw-alias-label-secondary, #b6b6b6); }
.dsor-alert.warn { border-color: rgba(255,180,84,.45); color: var(--dsw-alias-state-warn-primary, #ffb454); }
.dsor-cmpbar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:6px 12px 10px;
  border-top:.5px solid var(--dsw-alias-border-l1, #333436); }
.dsor-cmp-btn { font-size:12px; }
.dsor-compare { width:min(660px, calc(100vw - 32px)); }
.dsor-cmp-head { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
.dsor-cmp-scroll { overflow:auto; max-height:60vh; }
.dsor-cmp-table { border-collapse:collapse; width:100%; font-size:11px; }
.dsor-cmp-table th, .dsor-cmp-table td { border-bottom:.5px solid var(--dsw-alias-border-l1, #333436);
  padding:5px 6px; text-align:left; vertical-align:top; }
.dsor-cmp-table th { color: var(--dsw-alias-label-secondary, #b6b6b6); font-weight:600; }
.dsor-providers { margin-top:6px; display:flex; flex-direction:column; gap:3px; }
.dsor-provider { display:flex; gap:8px; align-items:baseline; font-size:10.5px; color: var(--dsw-alias-label-tertiary, #9a9a9a); flex-wrap:wrap; }
.dsor-provider b { color: var(--dsw-alias-label-primary, #e8e8e8); font-weight:550; }
.dsor-templates { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:4px; }
.dsor-gallery { padding:8px 12px 12px; border-top:.5px solid var(--dsw-alias-border-l1, #333436); }
.dsor-ghead { display:flex; align-items:center; gap:6px; margin-bottom:8px; font-size:11px;
  color: var(--dsw-alias-label-secondary, #b6b6b6); }
.dsor-ggrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(128px, 1fr)); gap:8px; }
.dsor-gcard { border:.5px solid var(--dsw-alias-border-l1, #333436); border-radius:8px; overflow:hidden;
  background: var(--dsw-alias-bg-layer-2, #2b2c2e); display:flex; flex-direction:column; min-width:0; }
.dsor-gthumb { display:block; height:84px; overflow:hidden; background:#141517; }
.dsor-gthumb img, .dsor-gthumb video { width:100%; height:100%; object-fit:cover; display:block; }
.dsor-gicon { display:flex; align-items:center; justify-content:center; height:100%; font-size:22px; }
.dsor-gmeta { padding:5px 6px; display:flex; flex-direction:column; gap:1px; min-width:0; }
.dsor-gmeta b { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#C8FF00; }
.dsor-gmeta small { font-size:9.5px; color: var(--dsw-alias-label-tertiary, #9a9a9a); overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.dsor-gactions { display:flex; gap:6px; padding:0 6px 6px; }
.dsor-full { position:fixed; inset:12px; z-index:180; display:flex; flex-direction:column; overflow:hidden;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); border-radius:14px;
  background: var(--dsw-alias-bg-layer-1, #1f2022); box-shadow: var(--dsw-elevation-panel, 0 18px 48px rgba(0,0,0,.5)); }

/* Balance of the OpenRouter key: shown in the "ride for free" block, top-up is a website link. */
.dsor-balance { display:flex; align-items:center; gap:6px; margin:6px 12px 2px; font-size:10.5px;
  color: var(--dsw-alias-label-tertiary, #9a9a9a); }
.dsor-balance b { font-size:12px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary, #e8e8e8); }
.dsor-balance .dsor-linkbtn { margin-left:auto; }
.dsor-panel .dsor-balance { margin:2px 2px 6px; }

/* Rankings view: usage leaderboard and Artificial Analysis benchmarks. */
.dsor-views { display:flex; align-items:center; gap:6px; padding:6px 12px 6px; }
.dsor-rankings { display:flex; flex-direction:column; flex:1; min-height:0; }
.dsor-rank-head { display:flex; align-items:center; gap:6px; padding:6px 12px 4px; }
.dsor-rank-head .dsor-chips { flex:1; }
.dsor-rank-list { flex:1; min-height:0; overflow:auto; padding:2px 12px 8px; }
.dsor-rank-row { display:flex; align-items:center; gap:8px; padding:5px 2px;
  border-bottom:.5px solid var(--dsw-alias-border-l1, #333436); }
.dsor-rank-n { width:18px; text-align:right; font-size:10px; color: var(--dsw-alias-label-tertiary, #8f8f8f);
  font-variant-numeric: tabular-nums; }
.dsor-rank-main { flex:1; min-width:0; }
.dsor-rank-name { font-size:11.5px; font-weight:550; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-rank-sub { font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-rank-metrics { text-align:right; font-variant-numeric: tabular-nums; font-size:11px; white-space:nowrap; }
.dsor-rank-metrics small { display:block; font-size:9.5px; color: var(--dsw-alias-label-tertiary, #8f8f8f); }
.dsor-delta.up { color: var(--dsw-alias-state-success-primary, #5fd08b); }
.dsor-delta.down { color: var(--dsw-alias-state-error-primary, #ff9c9c); }
.dsor-rank-foot { padding:6px 12px 8px; border-top:.5px solid var(--dsw-alias-border-l2, #3a3b3d); font-size:10px; }

/* Generation view: media forms, results and the recent-files strip. */
.dsor-gen { display:flex; flex-direction:column; flex:1; min-height:0; }
.dsor-gen-form { display:flex; flex-direction:column; gap:6px; padding:4px 12px 8px; }
.dsor-gen-kinds { display:flex; gap:5px; }
.dsor-gen-field { display:flex; flex-direction:column; gap:2px; font-size:9.5px;
  color: var(--dsw-alias-label-tertiary, #9a9a9a); }
.dsor-gen-input, .dsor-gen-select { width:100%; box-sizing:border-box; padding:5px 8px;
  border-radius: var(--dsw-radius-md, 8px); font-size:11px;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); background: var(--dsw-alias-bg-layer-2, #2b2c2e);
  color: inherit; font-family: inherit; outline:none; }
.dsor-gen-input:focus, .dsor-gen-select:focus { border-color: var(--dsw-alias-brand-primary, #4d8dff); }
.dsor-gen-textarea { min-height:52px; resize:vertical; }
.dsor-gen-params { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:6px; }
.dsor-gen-check { flex-direction:row; align-items:center; gap:5px; }
.dsor-gen-models { display:flex; flex-direction:column; gap:1px; max-height:132px; overflow:auto;
  border:.5px solid var(--dsw-alias-border-l2, #3a3b3d); border-radius: var(--dsw-radius-md, 8px);
  padding:3px; background: var(--dsw-alias-bg-layer-2, #2b2c2e); }
.dsor-gen-model { display:flex; align-items:center; gap:6px; width:100%; padding:3px 6px; border:0;
  border-radius: var(--dsw-radius-sm, 6px); background:transparent; color:inherit; cursor:pointer;
  text-align:left; font-family:inherit; font-size:10.5px; }
.dsor-gen-model:hover { background: var(--dsw-alias-interactive-bg-hover, #3c3d3f); }
.dsor-gen-model[data-on="1"] { background: var(--dsw-alias-bg-layer-3, #353638);
  box-shadow: inset 0 0 0 .5px var(--dsw-alias-brand-primary, #4d8dff); }
.dsor-gen-model .n { flex:1; min-width:0; }
.dsor-gen-model .n b { display:block; font-weight:550; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-gen-model .n small { display:block; font-size:9px; color: var(--dsw-alias-label-tertiary, #8f8f8f);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsor-gen-model .p { font-size:9.5px; color: var(--dsw-alias-label-secondary, #c4c4c4);
  white-space:nowrap; font-variant-numeric: tabular-nums; }
.dsor-gen-models-count { font-size:9px; color: var(--dsw-alias-label-tertiary, #8f8f8f); }
.dsor-gen-actions { display:flex; align-items:center; gap:8px; }
.dsor-gen-actions .dsor-free-btn { margin:0; padding:8px 12px; font-size:12px; }
.dsor-gen-hint { font-size:10px; color: var(--dsw-alias-label-tertiary, #8f8f8f); }
.dsor-gen-result { flex:1; min-height:0; overflow:auto; padding:0 12px 8px; }
.dsor-gen-images { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:6px; }
.dsor-gen-images img { width:100%; border-radius: var(--dsw-radius-md, 8px); display:block; }
.dsor-gen-media { width:100%; border-radius: var(--dsw-radius-md, 8px); }
.dsor-gen-recent { display:flex; flex-wrap:wrap; gap:3px 6px; padding:4px 12px 10px; }
.dsor-gen-recent a { font-size:10px; color: var(--dsw-alias-link, #4d8dff); }
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

    /** Compact token volume: 56.0T, 17.7T, 812.0B, 4.2M. */
    function fmtTokens(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      if (number >= 1e12) return `${(number / 1e12).toFixed(1)}T`
      if (number >= 1e9) return `${(number / 1e9).toFixed(1)}B`
      if (number >= 1e6) return `${(number / 1e6).toFixed(1)}M`
      if (number >= 1e3) return `${(number / 1e3).toFixed(1)}K`
      return String(Math.round(number))
    }

    function fmtPercent(value, digits = 0) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return `${(number * 100).toFixed(digits)}%`
    }

    /* ---------- Favorites: a browser-local list shared by the menu and the tab ---------- */
    const FAVORITES_KEY = 'dsor:favorites'
    let favoritesCache = null
    const favoriteListeners = new Set()

    function readFavorites() {
      if (Array.isArray(favoritesCache)) return favoritesCache
      try {
        const raw = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]')
        favoritesCache = Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : []
      } catch {
        favoritesCache = []
      }
      return favoritesCache
    }

    function toggleFavorite(id) {
      const current = new Set(readFavorites())
      if (current.has(id)) current.delete(id)
      else current.add(id)
      favoritesCache = [...current]
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesCache))
      } catch {
        /* private mode without storage: the in-memory list still works */
      }
      for (const listener of favoriteListeners) {
        try {
          listener()
        } catch {
          /* one listener must not break the others */
        }
      }
    }

    function useFavorites() {
      const [ids, setIds] = useState(() => new Set(readFavorites()))
      useEffect(() => {
        const update = () => setIds(new Set(readFavorites()))
        favoriteListeners.add(update)
        return () => favoriteListeners.delete(update)
      }, [])
      return ids
    }

    function FavoriteStar({ id, tr }) {
      const favorites = useFavorites()
      const active = favorites.has(id)
      return h('button', {
        type: 'button',
        className: 'dsor-star',
        'data-on': active ? '1' : '0',
        title: active ? tr('favorites.remove') : tr('favorites.add'),
        onClick: (event) => {
          if (event) event.stopPropagation()
          toggleFavorite(id)
        },
      }, active ? '★' : '☆')
    }

    /* ---------- Free-model health: cached host pings ---------- */
    let healthCache = null
    let healthPromise = null

    function loadHealth(refresh) {
      if (refresh) healthCache = null
      if (healthCache) return Promise.resolve(healthCache)
      if (!healthPromise) {
        healthPromise = getJson('/health/free' + (refresh ? '?refresh=1' : ''))
          .then((value) => {
            healthCache = value
            return value
          })
          .finally(() => {
            healthPromise = null
          })
      }
      return healthPromise
    }

    function healthIndex(health) {
      const index = new Map()
      const rows = health && Array.isArray(health.models) ? health.models : []
      for (const row of rows) if (row && row.id) index.set(row.id, row)
      return index
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
    const ModalityBadges = React.memo(function ModalityBadges({ model, tr }) {
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
    })

    /** Inclusive modality filter: a universal model matches each capability it has. */
    const MODALITY_FILTERS = ['text', 'image', 'video', 'audio', 'file']

    function modelSupports(model, modality) {
      const { input, output } = normalizeModalities(model)
      return input.includes(modality) || output.includes(modality)
    }

    /** Client-side mirror of the host chat-capability rule. */
    function isChatCapableModel(model) {
      const { input, output } = normalizeModalities(model)
      if (!input.includes('text')) return false
      if (input.includes('audio') || input.includes('video')) return false
      return output.length > 0 && output.every((value) => value === 'text')
    }

    function countModalities(models) {
      const counts = {}
      MODALITY_FILTERS.forEach((value) => {
        counts[value] = 0
      })
      for (const model of models) {
        for (const value of MODALITY_FILTERS) {
          if (modelSupports(model, value)) counts[value] += 1
        }
      }
      return counts
    }

    const ModalityFilter = React.memo(function ModalityFilter({ modality, counts, onSelect, tr }) {
      return h('div', { className: 'dsor-mods-filter' },
        h('span', { className: 'dsor-filter-label' }, tr('filter.modality')),
        h('div', { className: 'dsor-chips' },
          MODALITY_FILTERS.map((value) => h('button', {
            key: value,
            type: 'button',
            className: 'dsor-chip',
            'data-on': modality === value ? '1' : '0',
            title: tr('filter.modalityHint'),
            onClick: () => onSelect(modality === value ? '' : value),
          },
            h('span', { className: 'dsor-chip-ico' }, MODALITY_ICONS[value]),
            tr('filter.modality.' + value),
            counts && counts[value] !== undefined ? ` (${counts[value]})` : ''))))
    })

    /** Keeps one broken contribution from taking down the whole harness page. */
    class PluginBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error) {
        try {
          console.warn('[openrouter-explorer-free]', error)
        } catch {
          /* console may be unavailable */
        }
      }
      render() {
        if (this.state.error) {
          if (this.props.silent) return null
          const message = this.state.error && this.state.error.message ? this.state.error.message : String(this.state.error || '')
          const tr = this.props.tr || ((key) => key)
          return h('div', { className: 'dsor-err' }, tr('error.crash', { message }))
        }
        return this.props.children
      }
    }

    function withBoundary(Component, options) {
      const silent = !!(options && options.silent)
      return function SafeContribution(props) {
        return h(PluginBoundary, { tr: makeTranslator(props && props.t), silent }, h(Component, props))
      }
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
      const seen = Date.parse(model.first_seen_at || '')
      if (Number.isFinite(seen) && Date.now() - seen < 7 * 24 * 3600_000) {
        badges.push(h('span', { className: 'dsor-badge hot', key: 'new', title: tr('badge.newTitle') }, tr('badge.new')))
      }
      const prev = model.prev
      if (prev && !model.is_free) {
        const before = Number(prev.prompt_usd_per_1m)
        const now = Number(model.prompt_usd_per_1m)
        if (Number.isFinite(before) && Number.isFinite(now) && before > 0) {
          const pct = Math.round(Math.abs(1 - now / before) * 100)
          if (pct >= 5) {
            badges.push(h('span', {
              className: 'dsor-badge ' + (now < before ? 'ok' : 'warn'),
              key: 'pc',
              title: tr(now < before ? 'badge.priceMuchCheaper' : 'badge.priceMuchExpensive'),
            }, tr(now < before ? 'badge.cheaper' : 'badge.expensive', { pct })))
          }
        }
      }
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

    const ModelRow = React.memo(function ModelRow({ model, tr, health, selected, onCompare }) {
      const [open, setOpen] = useState(false)
      const [providers, setProviders] = useState(null)
      const [provLoading, setProvLoading] = useState(false)
      const loadProviders = async () => {
        if (provLoading) return
        setProvLoading(true)
        try {
          const data = await getJson('/model/endpoints?id=' + encodeURIComponent(model.id))
          setProviders(data && data.ok && Array.isArray(data.models) ? data.models : [])
        } catch {
          setProviders([])
        } finally {
          setProvLoading(false)
        }
      }
      const providerBlock = providers
        ? h('div', { className: 'dsor-providers' },
          providers.length === 0
            ? h('div', { className: 'dsor-meta' }, tr('providers.empty'))
            : providers.slice(0, 12).map((row) => h('div', { className: 'dsor-provider', key: row.provider + row.quantization },
              h('b', null, row.provider),
              h('span', null, `${row.prompt_usd_per_1m !== null ? '$' + fmtUsd(row.prompt_usd_per_1m) : '—'} / ${row.completion_usd_per_1m !== null ? '$' + fmtUsd(row.completion_usd_per_1m) : '—'}`),
              row.latency_last_30m !== null ? h('span', null, ' ' + row.latency_last_30m + ' ms') : null,
              row.uptime_last_30m !== null ? h('span', null, ' ' + Math.round(row.uptime_last_30m) + '%') : null,
              h('small', null, ' ' + (row.quantization || row.status || '')))),
          h('div', { className: 'dsor-meta' }, tr('providers.note')))
        : null
      const history = open ? h('div', { className: 'dsor-details' },
        model.description ? h('div', { className: 'dsor-desc' }, model.description) : null,
        h(PriceHistory, { points: model.price_history, tr }),
        h('div', { style: { marginTop: '4px' } },
          h('button', { type: 'button', className: 'dsor-linkbtn', onClick: loadProviders, disabled: provLoading },
            provLoading ? '…' : tr('providers.load'))),
        providerBlock,
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
          h(FavoriteStar, { id: model.id, tr }),
          onCompare
            ? h('button', {
              type: 'button', className: 'dsor-star dsor-cmp-btn', 'data-on': selected ? '1' : '0',
              title: tr(selected ? 'compare.remove' : 'compare.add'),
              onClick: (event) => {
                if (event) event.stopPropagation()
                onCompare(model.id)
              },
            }, selected ? '✓' : '⇄')
            : null,
          h('div', { className: 'dsor-main' },
            h('div', { className: 'dsor-name', title: model.name }, model.name),
            h('div', { className: 'dsor-id' }, model.id),
            h('div', { className: 'dsor-meta' },
              h('span', { className: 'dsor-badge' }, tr('context', { ctx: contextText(model.context_length) })),
              model.is_free && health
                ? h('span', {
                  className: 'dsor-badge ' + (health.ok ? 'ok' : 'warn'),
                  title: health.ok ? `${tr('health.alive')} · ${health.latency_ms ?? '?'} ms` : `${tr('health.dead')}${health.error ? ' · ' + health.error : ''}`,
                }, health.ok ? `${health.latency_ms ?? '?'} ms` : '✕')
                : null,
              isChatCapableModel(model) ? null : h('span', { className: 'dsor-badge warn', title: tr('chat.notForChatTitle') }, tr('chat.notForChat')),
              h(ModalityBadges, { model, tr }),
              h(Badges, { model, tr }))),
          h('div', { className: 'dsor-price' }, priceCell(model, tr))),
        history)
    })

    /** One row of the composer catalog menu. */
    const MenuModelRow = React.memo(function MenuModelRow({ model, tr, using, onPick }) {
      return h('button', {
        key: model.id, type: 'button', className: 'dsor-mini', title: model.id,
        onClick: () => onPick(model), disabled: !!using,
      },
        h('span', { className: 'n' },
          h('b', null, model.name),
          h('small', null, h(ModalityBadges, { model, tr }), ` ${model.id} · ${tr('context', { ctx: contextText(model.context_length) })}`),
          h('small', null, model.is_free
            ? tr('price.free')
            : tr('price.per1m', { in: fmtUsd(model.prompt_usd_per_1m), out: fmtUsd(model.completion_usd_per_1m) }) + (model.discount ? ' · ' + tr('price.discount', { pct: model.discount.pct }) : ''))),
        h('span', { className: 'p' }, using === model.id ? h('span', { className: 'dsor-spin' }) : '→'))
    })

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

    /* Cross-contribution bridge: a failed "use in chat" can jump to the Generation view. */
    let pendingGenerationView = false
    const generationViewListeners = new Set()

    function requestGenerationView() {
      pendingGenerationView = true
      for (const listener of generationViewListeners) {
        try {
          listener()
        } catch {
          /* one listener must not break the others */
        }
      }
    }

    function consumeGenerationView() {
      const pending = pendingGenerationView
      pendingGenerationView = false
      return pending
    }

    /** Small vendor mark: logo plus a link to lidogenerator.top with UTM attribution. */
    function BrandMark({ tr }) {
      return h('a', {
        className: 'dsor-brand',
        href: BRAND_URL,
        target: '_blank',
        rel: 'noreferrer',
        title: tr('brand.title'),
      },
        h('img', { className: 'dsor-brand-logo', src: BRAND_LOGO, alt: 'Lidogen 360', width: 15, height: 15 }),
        h('span', null, tr('brand.text')))
    }

    /**
     * Rankings view: the OpenRouter usage leaderboard and the Artificial
     * Analysis coding benchmark. Data comes from the host cache (`/rankings`),
     * so the browser never talks to openrouter.ai directly.
     */
    function RankingsView({ tr }) {
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(true)
      const [syncing, setSyncing] = useState(false)
      const [error, setError] = useState(null)
      const [tab, setTab] = useState('usage')
      const alive = useRef(true)

      const load = useCallback(async (refresh) => {
        try {
          const next = await getJson('/rankings' + (refresh ? '?refresh=1' : ''))
          if (!alive.current) return
          setData(next)
          setError(next && next.error ? next.error : null)
        } catch (caught) {
          if (!alive.current) return
          setError(caught instanceof Error ? caught.message : String(caught))
        } finally {
          if (!alive.current) return
          setLoading(false)
        }
      }, [])

      useEffect(() => {
        alive.current = true
        ensureStyle()
        void load(false)
        return () => {
          alive.current = false
        }
      }, [load])

      const refresh = async () => {
        if (syncing) return
        setSyncing(true)
        await load(true)
        if (alive.current) setSyncing(false)
      }

      const usageRows = data && data.usage && Array.isArray(data.usage.models) ? data.usage.models : []
      const benchmarkModels = data && data.benchmarks && Array.isArray(data.benchmarks.models) ? data.benchmarks.models : []
      const codingRows = benchmarkModels.filter((row) => Number.isFinite(row.coding))

      const tabs = h('div', { className: 'dsor-chips' },
        [['usage', tr('ranking.usage')], ['coding', tr('ranking.coding')]].map(([value, label]) => h('button', {
          key: value, type: 'button', className: 'dsor-chip', 'data-on': tab === value ? '1' : '0',
          onClick: () => setTab(value),
        }, label)))

      const head = h('div', { className: 'dsor-rank-head' },
        tabs,
        data && data.at ? h('span', { className: 'dsor-price-label' }, tr('ranking.updated', { ago: relativeTime(data.at, tr) })) : null,
        h('button', {
          type: 'button', className: 'dsor-iconbtn', title: tr('ranking.refresh'), onClick: refresh,
          disabled: syncing,
        }, syncing ? h('span', { className: 'dsor-spin' }) : '⟳'))

      const notice = error
        ? h('div', { className: 'dsor-toast bad', style: { margin: '0 12px 6px' } },
          tr('ranking.error', { message: error }) + (data && data.stale ? ' · ' + tr('ranking.stale') : ''))
        : null

      const usageRow = (row, index) => h('div', { className: 'dsor-rank-row', key: row.slug },
        h('span', { className: 'dsor-rank-n' }, index + 1),
        h('div', { className: 'dsor-rank-main' },
          h('div', { className: 'dsor-rank-name', title: row.name }, row.name || row.slug),
          h('div', { className: 'dsor-rank-sub' }, `${row.slug}${row.share ? ' · ' + fmtPercent(row.share) : ''}`)),
        h('div', { className: 'dsor-rank-metrics', title: tr('ranking.tokensHint') },
          h('b', null, fmtTokens(row.tokens)),
          row.change === null || row.change === undefined
            ? h('small', null, tr('ranking.tokens'))
            : h('span', {
              className: 'dsor-delta ' + (row.change >= 0 ? 'up' : 'down'),
              title: tr('ranking.changeHint'),
            }, `${row.change >= 0 ? '+' : ''}${Math.round(row.change * 100)}%`)))

      const codingRow = (row, index) => h('div', { className: 'dsor-rank-row', key: row.slug },
        h('span', { className: 'dsor-rank-n' }, index + 1),
        h('div', { className: 'dsor-rank-main' },
          h('div', { className: 'dsor-rank-name', title: row.name }, row.name || row.slug),
          h('div', { className: 'dsor-rank-sub' }, row.slug)),
        h('div', { className: 'dsor-rank-metrics', title: tr('ranking.scoresHint') },
          h('b', null, row.coding),
          h('small', null, Number.isFinite(row.intelligence) ? `${tr('ranking.intelligence')} ${row.intelligence}` : '')))

      const rows = tab === 'usage' ? usageRows : codingRows
      const body = loading
        ? h('div', { className: 'dsor-empty' }, tr('ranking.loading'))
        : rows.length === 0
          ? h('div', { className: 'dsor-empty' }, tr('ranking.empty'))
          : h('div', { className: 'dsor-rank-list' },
            rows.map((row, index) => (tab === 'usage' ? usageRow(row, index) : codingRow(row, index))))

      return h('div', { className: 'dsor-rankings' },
        head,
        notice,
        body,
        h('div', { className: 'dsor-rank-foot' },
          h('a', {
            href: 'https://openrouter.ai/rankings',
            target: '_blank',
            rel: 'noreferrer',
            style: { color: 'var(--dsw-alias-link, #4d8dff)' },
          }, tr('ranking.open'))))
    }


    /* ------------------------------------------------------------------ */
    /* Generation view: images, video jobs and speech via OpenRouter APIs. */
    /* ------------------------------------------------------------------ */

    function GenField({ label, children }) {
      return h('label', { className: 'dsor-gen-field' }, h('span', null, label), children)
    }

    function fmtBytes(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      if (number >= 1e6) return `${(number / 1e6).toFixed(1)} МБ`
      if (number >= 1e3) return `${(number / 1e3).toFixed(1)} КБ`
      return `${number} Б`
    }

    /** Rough video price from a model's per-second SKUs (display only). */
    function videoEstimate(model, resolution, duration) {
      const skus = model && model.pricing_skus ? model.pricing_skus : {}
      const perSecond = Object.keys(skus)
        .filter((key) => /duration_seconds|per_video_output_second|per_second/i.test(key))
        .map((key) => ({ key, price: Number(skus[key]) }))
        .filter((item) => Number.isFinite(item.price) && item.price > 0)
      if (!perSecond.length) return null
      const matching = perSecond.filter((item) => resolution && item.key.includes(resolution))
      const pool = matching.length ? matching : perSecond
      pool.sort((a, b) => a.price - b.price)
      return Number((pool[0].price * (Number(duration) || 0)).toFixed(2))
    }

    /** Cheapest per-second video price for the picked resolution (display only). */
    function modelPriceHint(model, resolution, tr) {
      const skus = model && model.pricing_skus ? model.pricing_skus : {}
      const perSecond = Object.keys(skus)
        .filter((key) => /duration_seconds|per_video_output_second|per_second/i.test(key))
        .map((key) => ({ key, price: Number(skus[key]) }))
        .filter((item) => Number.isFinite(item.price) && item.price > 0)
      if (!perSecond.length) return null
      const matching = perSecond.filter((item) => resolution && item.key.includes(resolution))
      const pool = matching.length ? matching : perSecond
      pool.sort((a, b) => a.price - b.price)
      return tr('gen.pricePerSecond', { price: `$${pool[0].price.toFixed(2)}` })
    }

    function GenerationView({ tr }) {
      const [kind, setKind] = useState('image')
      const [models, setModels] = useState({})
      const [modelId, setModelId] = useState('')
      const [modelQuery, setModelQuery] = useState('')
      const [freeOnly, setFreeOnly] = useState(false)
      const [prompt, setPrompt] = useState('')
      const [aspect, setAspect] = useState('16:9')
      const [resolution, setResolution] = useState('2K')
      const [quality, setQuality] = useState('high')
      const [duration, setDuration] = useState(8)
      const [variants, setVariants] = useState(1)
      const [withAudio, setWithAudio] = useState(true)
      const [voice, setVoice] = useState('')
      const [format, setFormat] = useState('mp3')
      const [speed, setSpeed] = useState(1)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [result, setResult] = useState(null)
      const [job, setJob] = useState(null)
      const [videoFile, setVideoFile] = useState(null)
      const [recent, setRecent] = useState([])
      const alive = useRef(true)

      const kindModels = models[kind] || []
      const selected = kindModels.find((model) => model.id === modelId) || null
      const estimate = kind === 'video' ? videoEstimate(selected, resolution, duration) : null
      const modelNeedle = modelQuery.trim().toLowerCase()
      const filteredModels = kindModels.filter((model) => {
        if (freeOnly && model.is_free !== true) return false
        if (!modelNeedle) return true
        return `${model.id} ${model.name}`.toLowerCase().includes(modelNeedle)
      })

      const refreshRecent = () => {
        getJson('/generated')
          .then((data) => {
            if (alive.current && data && Array.isArray(data.files)) setRecent(data.files)
          })
          .catch(() => {})
      }

      useEffect(() => {
        alive.current = true
        refreshRecent()
        return () => {
          alive.current = false
        }
      }, [])

      useEffect(() => {
        let cancelled = false
        setError(null)
        getJson('/generation/models?kind=' + kind)
          .then((data) => {
            if (cancelled || !alive.current) return
            if (data && data.ok) setModels((current) => ({ ...current, [kind]: data.models || [] }))
            else setError(data && data.error ? data.error : 'models')
          })
          .catch((caught) => {
            if (!cancelled && alive.current) setError(caught instanceof Error ? caught.message : String(caught))
          })
        return () => {
          cancelled = true
        }
      }, [kind])

      useEffect(() => {
        if (!modelId && kindModels.length) setModelId(kindModels[0].id)
      }, [kindModels, modelId])

      useEffect(() => {
        if (!job || !job.id) return undefined
        if (job.status === 'completed' || job.status === 'failed') return undefined
        const id = job.id
        let cancelled = false
        const tick = async () => {
          try {
            const next = await getJson('/generate/video/status?id=' + encodeURIComponent(id))
            if (cancelled || !alive.current || !next || !next.ok) return
            setJob(next.job)
            if (next.job && next.job.status === 'completed') {
              const file = await getJson('/generate/video/content?id=' + encodeURIComponent(id))
              if (!cancelled && alive.current && file && file.ok) {
                setVideoFile(file.file)
                refreshRecent()
              }
            }
          } catch {
            /* keep polling until the job resolves or the view unmounts */
          }
        }
        const timer = setInterval(tick, 3000)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [job && job.id, job && job.status])

      const switchKind = (value) => {
        setKind(value)
        setModelId('')
        setModelQuery('')
        setResult(null)
        setJob(null)
        setVideoFile(null)
        setError(null)
        setResolution(value === 'image' ? '2K' : '720p')
      }

      const submit = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        setResult(null)
        setJob(null)
        setVideoFile(null)
        try {
          if (kind === 'image') {
            const count = Math.max(1, Math.min(4, Number(variants) || 1))
            const files = []
            let cost = 0
            for (let index = 0; index < count; index += 1) {
              const data = await postJson('/generate/image', { model: modelId, prompt, aspectRatio: aspect, resolution, quality })
              if (!data || !data.ok) {
                setError(data && data.error ? data.error : 'image')
                return
              }
              files.push(...(data.files || []))
              cost += Number(data.cost) || 0
            }
            setResult({ ok: true, kind: 'image', files, cost: cost || null })
            refreshRecent()
          } else if (kind === 'video') {
            const data = await postJson('/generate/video', { model: modelId, prompt, aspectRatio: aspect, resolution, duration, generateAudio: withAudio })
            if (data && data.ok) {
              setJob(data.job)
              refreshRecent()
            } else setError(data && data.error ? data.error : 'video')
          } else {
            const data = await postJson('/generate/speech', { model: modelId, input: prompt, voice, format, speed })
            if (data && data.ok) {
              setResult(data)
              refreshRecent()
            } else setError(data && data.error ? data.error : 'speech')
          }
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught))
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      const kinds = h('div', { className: 'dsor-gen-kinds' },
        ['image', 'video', 'speech'].map((value) => h('button', {
          key: value, type: 'button', className: 'dsor-chip', 'data-on': kind === value ? '1' : '0',
          onClick: () => switchKind(value),
        }, tr('gen.' + value))))

      const modelField = h(GenField, { label: `${tr('gen.model')}${selected ? ': ' + selected.name : ''}` },
        kindModels.length === 0
          ? h('div', { className: 'dsor-gen-hint' }, tr('gen.modelLoading'))
          : h('div', null,
            h('label', { className: 'dsor-gen-field dsor-gen-check' },
              h('input', {
                type: 'checkbox', checked: freeOnly,
                onChange: (event) => setFreeOnly(event.target.checked),
              }),
              h('span', null, tr('gen.freeOnly'))),
            h('input', {
              className: 'dsor-gen-input',
              value: modelQuery,
              placeholder: tr('gen.searchModels'),
              onChange: (event) => setModelQuery(event.target.value),
            }),
            h('div', { className: 'dsor-gen-models' },
              filteredModels.length === 0
                ? h('div', { className: 'dsor-gen-hint', style: { padding: '3px 6px' } },
                  freeOnly ? tr('gen.freeNone') : tr('gen.noModelsFound'))
                : filteredModels.slice(0, 200).map((model) => h('button', {
                  key: model.id,
                  type: 'button',
                  className: 'dsor-gen-model',
                  'data-on': model.id === modelId ? '1' : '0',
                  title: model.id,
                  onClick: () => {
                    setModelId(model.id)
                    if (kind === 'video' && model.resolutions && model.resolutions.length) setResolution(model.resolutions[0])
                  },
                },
                  h('span', { className: 'n' },
                    h('b', null, model.name),
                    h('small', null, model.id)),
                  model.is_free === true ? h('span', { className: 'dsor-badge ok' }, tr('gen.freeBadge')) : null,
                  kind === 'video' ? h('span', { className: 'p' }, modelPriceHint(model, resolution, tr) || '') : null))),
            h('div', { className: 'dsor-gen-models-count' },
              tr('gen.modelsCount', { n: filteredModels.length, total: kindModels.length }))))

      const templateCount = kind === 'image' ? 4 : 3
      const templates = Array.from({ length: templateCount }, (_, index) => tr(`gen.tpl.${kind}.${index}`))
        .filter((text) => text && !text.startsWith('gen.tpl.'))
      const templateBar = h('div', { className: 'dsor-templates' },
        templates.map((text) => h('button', {
          key: text, type: 'button', className: 'dsor-chip', onClick: () => setPrompt(text),
        }, text)))

      const promptField = h(GenField, { label: kind === 'speech' ? tr('gen.promptSpeech') : tr('gen.prompt') },
        templateBar,
        h('textarea', {
          className: 'dsor-gen-input dsor-gen-textarea',
          value: prompt,
          onChange: (event) => setPrompt(event.target.value),
        }))

      const params = kind === 'image'
        ? h('div', { className: 'dsor-gen-params' },
          h(GenField, { label: tr('gen.aspect') },
            h('input', { className: 'dsor-gen-input', value: aspect, onChange: (event) => setAspect(event.target.value) })),
          h(GenField, { label: tr('gen.resolution') },
            h('select', { className: 'dsor-gen-select', value: resolution, onChange: (event) => setResolution(event.target.value) },
              ['1K', '2K', '4K'].map((value) => h('option', { key: value, value }, value)))),
          h(GenField, { label: tr('gen.quality') },
            h('select', { className: 'dsor-gen-select', value: quality, onChange: (event) => setQuality(event.target.value) },
              ['low', 'medium', 'high'].map((value) => h('option', { key: value, value }, value)))),
          h(GenField, { label: tr('gen.variants') },
            h('input', {
              className: 'dsor-gen-input', type: 'number', min: 1, max: 4, value: variants,
              onChange: (event) => setVariants(Number(event.target.value) || 1),
            })))
        : kind === 'video'
          ? h(React.Fragment, null,
            h('div', { className: 'dsor-gen-params' },
              h(GenField, { label: tr('gen.aspect') },
                h('input', { className: 'dsor-gen-input', value: aspect, onChange: (event) => setAspect(event.target.value) })),
              h(GenField, { label: tr('gen.resolution') },
                h('select', { className: 'dsor-gen-select', value: resolution, onChange: (event) => setResolution(event.target.value) },
                  (selected && selected.resolutions && selected.resolutions.length ? selected.resolutions : ['480p', '720p', '1080p', '4K'])
                    .map((value) => h('option', { key: value, value }, value)))),
              h(GenField, { label: tr('gen.duration') },
                h('input', {
                  className: 'dsor-gen-input', type: 'number', min: 1, max: 60, value: duration,
                  onChange: (event) => setDuration(Number(event.target.value) || 0),
                })),
              h('label', { className: 'dsor-gen-field dsor-gen-check' },
                h('input', { type: 'checkbox', checked: withAudio, onChange: (event) => setWithAudio(event.target.checked) }),
                h('span', null, tr('gen.audio')))),
            estimate !== null
              ? h('div', { className: 'dsor-gen-hint' }, tr('gen.estimate', { cost: `$${estimate.toFixed(2)}`, duration }))
              : null)
          : h('div', { className: 'dsor-gen-params' },
            h(GenField, { label: tr('gen.voice') },
              h('input', { className: 'dsor-gen-input', value: voice, placeholder: 'en_paul_neutral', onChange: (event) => setVoice(event.target.value) })),
            h(GenField, { label: tr('gen.format') },
              h('select', { className: 'dsor-gen-select', value: format, onChange: (event) => setFormat(event.target.value) },
                ['mp3', 'pcm', 'wav'].map((value) => h('option', { key: value, value }, value)))),
            h(GenField, { label: tr('gen.speed') },
              h('input', {
                className: 'dsor-gen-input', type: 'number', min: 0.25, max: 4, step: 0.25, value: speed,
                onChange: (event) => setSpeed(Number(event.target.value) || 1),
              })))

      const resultBlock = result && Array.isArray(result.files) && result.files.length
        ? h('div', { className: 'dsor-gen-result' },
          result.kind === 'image'
            ? h('div', { className: 'dsor-gen-images' },
              result.files.map((file) => h('a', { key: file.name, href: file.url, target: '_blank', rel: 'noreferrer' },
                h('img', { src: file.url, alt: file.name }))))
            : result.kind === 'speech'
              ? h('div', null,
                h('audio', { className: 'dsor-gen-media', controls: true, src: result.files[0].url }),
                h('div', { className: 'dsor-gen-hint' },
                  h('a', { className: 'dsor-linkbtn', href: result.files[0].url, download: result.files[0].name }, tr('gen.download'))))
              : null,
          result.cost ? h('div', { className: 'dsor-gen-hint' }, tr('gen.cost', { cost: `$${Number(result.cost).toFixed(2)}` })) : null)
        : null

      const videoBlock = job
        ? h('div', { className: 'dsor-gen-result' },
          job.status === 'completed' && videoFile
            ? h('video', { className: 'dsor-gen-media', controls: true, src: videoFile.url })
            : h('div', { className: 'dsor-gen-hint' },
              tr('gen.videoStatus', { status: job.status })
              + (job.cost ? ' · ' + tr('gen.cost', { cost: `$${Number(job.cost).toFixed(2)}` }) : '')),
          job.status === 'completed' && videoFile
            ? h('div', { className: 'dsor-gen-hint' },
              h('a', { className: 'dsor-linkbtn', href: videoFile.url, download: videoFile.name }, tr('gen.download')))
            : null)
        : null

      const deleteRecent = async (file) => {
        try {
          const response = await fetch(API + '/generated/' + encodeURIComponent(file.name), {
            method: 'DELETE',
            headers: { accept: 'application/json' },
          })
          if (response.ok) refreshRecent()
        } catch {
          /* keep the card when the delete failed */
        }
      }

      const galleryCard = (file) => h('div', { className: 'dsor-gcard', key: file.name },
        h('a', { className: 'dsor-gthumb', href: file.url, target: '_blank', rel: 'noreferrer' },
          String(file.mediaType || '').startsWith('image/')
            ? h('img', { src: file.url, alt: file.name, loading: 'lazy' })
            : String(file.mediaType || '').startsWith('video/')
              ? h('video', { src: file.url, muted: true, preload: 'metadata' })
              : h('span', { className: 'dsor-gicon' }, '🔊')),
        h('div', { className: 'dsor-gmeta' },
          h('b', null, file.kind || 'file'),
          h('small', { title: file.prompt || file.name }, file.prompt ? file.prompt.slice(0, 56) : file.name),
          h('small', null, `${fmtBytes(file.bytes)}${file.cost ? ' · $' + Number(file.cost).toFixed(2) : ''}`)),
        h('div', { className: 'dsor-gactions' },
          file.prompt
            ? h('button', {
              type: 'button', className: 'dsor-linkbtn',
              onClick: () => {
                if (file.kind) setKind(file.kind)
                setPrompt(file.prompt)
                if (file.model) setModelId(file.model)
              },
            }, tr('gen.repeat'))
            : null,
          h('button', { type: 'button', className: 'dsor-linkbtn', onClick: () => deleteRecent(file) }, tr('gen.delete'))))

      const recentBlock = h('div', { className: 'dsor-gallery' },
        h('div', { className: 'dsor-ghead' },
          h('b', null, tr('gen.gallery')),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'dsor-linkbtn', onClick: refreshRecent }, tr('gen.galleryRefresh'))),
        recent.length === 0
          ? h('div', { className: 'dsor-empty' }, tr('gen.galleryEmpty'))
          : h('div', { className: 'dsor-ggrid' }, recent.slice(0, 12).map(galleryCard)))

      return h('div', { className: 'dsor-gen' },
        h('div', { className: 'dsor-gen-form' },
          kinds,
          modelField,
          promptField,
          params,
          error ? h('div', { className: 'dsor-toast bad', style: { margin: '2px 0' } }, tr('gen.error', { message: error })) : null,
          h('div', { className: 'dsor-gen-actions' },
            h('button', {
              type: 'button', className: 'dsor-free-btn', onClick: submit,
              disabled: busy || !modelId || !prompt.trim(),
            },
              busy ? h('span', { className: 'dsor-spin' }) : h('span', null, '✨'),
              busy ? tr('gen.busy') : tr('gen.generate')))),
        resultBlock || videoBlock || h('div', { className: 'dsor-empty' }, tr('gen.empty')),
        recentBlock)
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
      const tr = useMemo(() => makeTranslator(props && props.t), [props ? props.t : null])
      const useSession = props && props.useSession
      const sessionId = typeof useSession === 'function'
        ? useSession((state) => state && state.sessionId)
        : undefined
      const [catalog, setCatalog] = useState(catalogCache)
      const [open, setOpen] = useState(false)
      const [position, setPosition] = useState(null)
      const [query, setQuery] = useState('')
      const [filter, setFilter] = useState('all')
      const [modality, setModality] = useState('')
      const [syncing, setSyncing] = useState(false)
      const [auto, setAuto] = useState(null)
      const [using, setUsing] = useState(null)
      const [notice, setNotice] = useState(null)
      const anchorRef = useRef(null)
      const panelRef = useRef(null)
      const modalityCounts = useMemo(
        () => countModalities(catalog && Array.isArray(catalog.models) ? catalog.models : []),
        [catalog])

      const place = () => {
        const anchor = anchorRef.current
        const rect = anchor && anchor.getBoundingClientRect()
        if (!rect) return
        const width = Math.min(420, Math.max(300, window.innerWidth - 24))
        // The panel grows leftwards from the button, but it must never slide
        // under the left sidebar: the composer's own container is the left
        // boundary. Without this clamp the left column (title, balance, search)
        // ends up hidden behind the sidebar.
        let boundLeft = 8
        let node = anchor.parentElement
        for (let depth = 0; depth < 6 && node; depth += 1) {
          const box = node.getBoundingClientRect()
          if (box.width > 0 && box.left > boundLeft && box.left < rect.left) boundLeft = box.left
          node = node.parentElement
        }
        const maxLeft = Math.max(8, window.innerWidth - width - 8)
        const left = Math.max(8, Math.min(Math.max(rect.right - width, boundLeft), maxLeft))
        setPosition({
          width,
          left,
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
            invalidateBalance()
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
            const message = (result && result.error) || tr('toast.useFailed')
            setNotice({
              ok: false,
              text: message,
              action: /не подходит для чата/.test(String(message)) ? { label: tr('chat.openGeneration'), onClick: openGeneration } : null,
            })
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setNotice({
            ok: false,
            text: message,
            action: /не подходит для чата/.test(message) ? { label: tr('chat.openGeneration'), onClick: openGeneration } : null,
          })
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

      /** Open the plugin tab and switch it to the Generation view. */
      const openGeneration = () => {
        try {
          if (props && typeof props.openPanel === 'function') props.openPanel()
        } catch {
          /* minimal composition without the sidebar */
        }
        requestGenerationView()
        setOpen(false)
      }

      const visible = useMemo(() => {
        let list = catalog && Array.isArray(catalog.models) ? catalog.models : []
        const needle = query.trim().toLowerCase()
        if (filter === 'free') list = list.filter((model) => model.is_free)
        if (filter === 'discount') list = list.filter((model) => model.discount)
        if (modality) list = list.filter((model) => modelSupports(model, modality))
        if (needle) list = list.filter((model) => `${model.id} ${model.name} ${model.author}`.toLowerCase().includes(needle))
        const score = (model) => (model.discount ? model.discount.pct * 1000 : 0)
          + (model.is_free ? 500 : 0)
          + Math.min(400, (model.context_length || 0) / 5000)
        return [...list].sort((a, b) => score(b) - score(a)).slice(0, 80)
      }, [catalog, query, filter, modality])

      const totals = (catalog && catalog.status && catalog.status.totals) || null

      const pill = h('button', {
        type: 'button',
        className: 'dsor-pill',
        'data-open': open ? '1' : '0',
        title: tr('title'),
        onClick: () => setOpen((value) => !value),
      }, h('img', { className: 'dsor-pill-logo', src: PRODUCT_LOGO, alt: '', width: 16, height: 16 }), h('span', null, 'explorer'))

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
          auto && auto.running ? h('span', { className: 'dsor-spin' }) : h('img', { className: 'dsor-free-btn-logo', src: PRODUCT_LOGO_LIME, alt: '', width: 16, height: 16 }),
          auto && auto.running ? tr('auto.running') : tr('auto.run')),
        h(BalanceLine, { tr }),
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
        chips,
        h(ModalityFilter, { modality, counts: modalityCounts, onSelect: setModality, tr }))

      const body = h('div', { className: 'dsor-panel-body' },
        !catalog
          ? h('div', { className: 'dsor-empty' }, tr('empty.loading'))
          : visible.length === 0
            ? h('div', { className: 'dsor-empty' }, tr('empty.notfound'))
            : visible.map((model) => h(MenuModelRow, {
              key: model.id, model, tr, using, onPick: applyModel,
            })))

      const foot = h('div', { className: 'dsor-foot' },
        h('button', { type: 'button', className: 'dsor-linkbtn', onClick: openTab }, tr('menu.openTab')),
        h('span', { style: { flex: 1 } }),
        h('span', { className: 'dsor-price-label' },
          catalog && catalog.status && catalog.status.synced_at ? tr('updated', { ago: relativeTime(catalog.status.synced_at, tr) }) : ''))

      const panel = open && position
        ? h('div', {
          className: 'dsor-panel',
          ref: panelRef,
          style: { width: `${position.width}px`, left: `${position.left}px`, bottom: `${position.bottom}px` },
        }, head, notice
          ? h('div', { className: 'dsor-toast ' + (notice.ok ? 'ok' : 'bad') },
            notice.text,
            notice.action ? h('button', {
              type: 'button', className: 'dsor-linkbtn', style: { marginLeft: '8px' },
              onClick: notice.action.onClick,
            }, notice.action.label) : null)
          : null, actions, filters, body, foot)
        : null

      return h('span', { className: 'dsor-anchor', ref: anchorRef }, pill, panel)

    }

    /* Balance of the OpenRouter key: fetched host-side (`/balance`), so the key
     * never reaches the browser. The top-up button is a plain link to the site. */
    let balanceCache = null
    let balancePromise = null
    const balanceListeners = new Set()

    function invalidateBalance() {
      balanceCache = null
      for (const listener of balanceListeners) {
        try {
          listener()
        } catch {
          /* one broken listener must not break the others */
        }
      }
    }

    function loadBalance(refresh) {
      if (refresh) balanceCache = null
      if (balanceCache) return Promise.resolve(balanceCache)
      if (!balancePromise) {
        balancePromise = getJson('/balance' + (refresh ? '?refresh=1' : ''))
          .then((value) => {
            balanceCache = value
            recordBalanceSnapshot(value)
            return value
          })
          .finally(() => {
            balancePromise = null
          })
      }
      return balancePromise
    }

    const BALANCE_HISTORY_KEY = 'dsor:balance-history'

    /** Remember balance usage samples so the line can forecast "days left". */
    function recordBalanceSnapshot(value) {
      if (!value || !value.ok || !Number.isFinite(Number(value.total_usage))) return
      try {
        const list = JSON.parse(window.localStorage.getItem(BALANCE_HISTORY_KEY) || '[]')
        const samples = Array.isArray(list) ? list : []
        const now = Date.now()
        const last = samples[samples.length - 1]
        if (last && now - Number(last.at) < 10 * 60_000) return
        samples.push({ at: now, usage: Number(value.total_usage) })
        while (samples.length > 60) samples.shift()
        window.localStorage.setItem(BALANCE_HISTORY_KEY, JSON.stringify(samples))
      } catch {
        /* storage is optional */
      }
    }

    /** Whole days left at the recent burn rate; null when there is too little data. */
    function forecastDays(balance) {
      if (!balance || !balance.ok) return null
      const remaining = Number(balance.remaining)
      if (!Number.isFinite(remaining) || remaining <= 0) return 0
      try {
        const list = JSON.parse(window.localStorage.getItem(BALANCE_HISTORY_KEY) || '[]')
        const samples = (Array.isArray(list) ? list : []).filter((row) => Number.isFinite(Number(row.at)) && Number.isFinite(Number(row.usage)))
        if (samples.length < 2) return null
        const first = samples[0]
        const last = samples[samples.length - 1]
        const days = (Number(last.at) - Number(first.at)) / 86_400_000
        if (!(days >= 0.25)) return null
        const spent = Number(last.usage) - Number(first.usage)
        if (!(spent > 0.01)) return null
        const perDay = spent / days
        if (!(perDay > 0.001)) return null
        return Math.max(0, Math.floor(remaining / perDay))
      } catch {
        return null
      }
    }

    function useBalance() {
      const [value, setValue] = useState(balanceCache)
      useEffect(() => {
        let alive = true
        const update = () => {
          loadBalance()
            .then((next) => {
              if (alive) setValue(next)
            })
            .catch((error) => {
              if (alive) setValue({ ok: false, reason: 'error', error: error instanceof Error ? error.message : String(error) })
            })
        }
        update()
        balanceListeners.add(update)
        const timer = setInterval(update, 60000)
        return () => {
          alive = false
          balanceListeners.delete(update)
          clearInterval(timer)
        }
      }, [])
      return value
    }

    function money(value) {
      const number = Number(value)
      return Number.isFinite(number) ? `$${number.toFixed(2)}` : '—'
    }

    /** Sits above the catalog when the key is almost empty. */
    function LowBalanceAlert({ tr }) {
      const balance = useBalance()
      if (!balance || !balance.ok) return null
      if (!(Number(balance.remaining) < 5)) return null
      return h('div', { className: 'dsor-alert warn' }, tr('alert.low'))
    }

    /** One line: remaining balance + a "top up on openrouter.ai" link (no payments here). */
    function BalanceLine({ tr }) {
      const balance = useBalance()
      const ok = !!(balance && balance.ok)
      const value = balance === null ? '…' : ok ? money(balance.remaining) : '—'
      const title = balance && balance.error
        ? balance.error
        : ok
          ? tr('balance.title', { total: money(balance.total_credits), used: money(balance.total_usage) })
          : ''
      const days = forecastDays(balance)
      return h('div', { className: 'dsor-balance', title, 'data-low': ok && Number(balance.remaining) < 5 ? '1' : '0' },
        h('span', null, tr('balance.label')),
        h('b', null, value),
        days !== null ? h('span', { className: 'dsor-balance-forecast', title: tr('balance.daysTitle') }, tr('balance.days', { n: days })) : null,
        h('a', {
          className: 'dsor-linkbtn',
          href: 'https://openrouter.ai/settings/credits',
          target: '_blank',
          rel: 'noreferrer',
          title: tr('balance.openHint'),
        }, tr('balance.topUp')))
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
          state?.running ? h('span', { className: 'dsor-spin' }) : h('img', { className: 'dsor-free-btn-logo', src: PRODUCT_LOGO_LIME, alt: '', width: 16, height: 16 }),
          state?.running ? tr('auto.running') : tr('auto.run')),
        h(BalanceLine, { tr }),
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
      const tr = useMemo(() => makeTranslator(props && props.t), [props ? props.t : null])
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
      const [modality, setModality] = useState('')
      const [preset, setPreset] = useState('all')
      const favoriteIds = useFavorites()
      const [health, setHealth] = useState(healthCache)
      const [checking, setChecking] = useState(false)
      const [help, setHelp] = useState(() => {
        try {
          return window.localStorage.getItem('dsor:help') !== '0.11'
        } catch {
          return false
        }
      })
      const [comparison, setComparison] = useState([])
      const [compareOpen, setCompareOpen] = useState(false)
      const [full, setFull] = useState(false)
      const [ranks, setRanks] = useState(null)
      const [view, setView] = useState(() => {
        try {
          const param = new URLSearchParams(window.location.search).get('dsor')
          return ['catalog', 'rankings', 'generation'].includes(param) ? param : 'catalog'
        } catch {
          return 'catalog'
        }
      })
      useEffect(() => {
        const apply = () => {
          if (consumeGenerationView()) setView('generation')
        }
        generationViewListeners.add(apply)
        apply()
        return () => {
          generationViewListeners.delete(apply)
        }
      }, [])
      const [auto, setAuto] = useState(null)
      const alive = useRef(true)
      const polledRef = useRef('')

      const load = useCallback(async (silent) => {
        if (!silent) setLoading(true)
        try {
          const [modelsResponse, eventsResponse] = await Promise.all([
            getJson('/models'),
            getJson('/events?limit=30'),
          ])
          if (!alive.current) return
          setStatus(modelsResponse.status || null)
          const nextModels = Array.isArray(modelsResponse.models) ? modelsResponse.models : []
          // Poll once a minute: only replace the array when the snapshot really changed,
          // otherwise memoized rows and the DOM stay untouched.
          const signature = `${nextModels.length}|${nextModels[0] ? nextModels[0].id : ''}|${(modelsResponse.status && modelsResponse.status.synced_at) || ''}`
          if (signature !== polledRef.current) {
            polledRef.current = signature
            setModels(nextModels)
          }
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
            invalidateBalance()
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

      const checkHealth = async () => {
        if (checking) return
        setChecking(true)
        try {
          const next = await loadHealth(true)
          if (alive.current) setHealth(next)
        } catch (error) {
          if (alive.current) {
            setHealth({ ok: false, reason: 'error', error: error instanceof Error ? error.message : String(error) })
          }
        } finally {
          if (alive.current) setChecking(false)
        }
      }

      const toggleCompare = (id) => {
        setComparison((current) => {
          if (current.includes(id)) return current.filter((value) => value !== id)
          return [...current, id].slice(-3)
        })
      }

      useEffect(() => {
        if (!compareOpen || ranks) return
        getJson('/rankings')
          .then((data) => {
            if (!data) return
            const usage = Array.isArray(data.usage?.models) ? data.usage.models : []
            const bench = Array.isArray(data.benchmarks?.models) ? data.benchmarks.models : []
            const map = new Map()
            usage.forEach((row, index) => map.set(row.slug, { usage: index + 1, tokens: row.total_tokens }))
            bench.forEach((row) => {
              const hit = map.get(row.slug) || {}
              map.set(row.slug, { ...hit, coding: row.coding, intelligence: row.intelligence })
            })
            setRanks(map)
          })
          .catch(() => setRanks(new Map()))
      }, [compareOpen, ranks])

      const closeHelp = () => {
        try {
          window.localStorage.setItem('dsor:help', '0.10')
        } catch {
          /* private mode: the modal just closes for this session */
        }
        setHelp(false)
      }

      const modalityCounts = useMemo(() => countModalities(models), [models])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return models.filter((model) => {
          if (filter === 'free' && !model.is_free) return false
          if (filter === 'discount' && !model.discount) return false
          if (filter === 'favorites' && !favoriteIds.has(model.id)) return false
          if (modality && !modelSupports(model, modality)) return false
          if (preset === 'cheap') {
            const prompt = Number(model.prompt_usd_per_1m)
            const completion = Number(model.completion_usd_per_1m)
            const cheap = model.is_free || (Number.isFinite(prompt) && prompt <= 0.5 && Number.isFinite(completion) && completion <= 2)
            if (!cheap) return false
          }
          if (preset === 'long' && !(Number(model.context_length) >= 200_000)) return false
          if (preset === 'code' && !/coder|code|devstral|qwen.*coder|kimi.?k2|claude.*(sonnet|opus)|deepseek.*(coder|v3)/i.test(`${model.id} ${model.name}`)) return false
          if (!needle) return true
          return `${model.id} ${model.name} ${model.author}`.toLowerCase().includes(needle)
        })
      }, [models, query, filter, modality, preset, favoriteIds])

      const totals = status?.totals || { models: 0, free: 0, discounts: 0, new_7d: 0 }
      const healthMap = useMemo(() => healthIndex(health), [health])

      const download = (name, text, mime) => {
        try {
          const blob = new Blob([text], { type: mime })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = name
          document.body.appendChild(link)
          link.click()
          link.remove()
          setTimeout(() => URL.revokeObjectURL(url), 1500)
        } catch {
          /* downloads can be blocked by the embedding page */
        }
      }

      const exportJson = () => {
        download('openrouter-models.json', JSON.stringify(filtered, null, 2), 'application/json')
      }

      const exportCsv = () => {
        const header = ['id', 'name', 'author', 'free', 'context', 'prompt_usd_per_1m', 'completion_usd_per_1m', 'input', 'output']
        const rows = filtered.map((model) => {
          const { input, output } = normalizeModalities(model)
          return [
            model.id,
            `"${String(model.name || '').replace(/"/g, '""')}"`,
            model.author || '',
            model.is_free ? 1 : 0,
            model.context_length ?? '',
            model.prompt_usd_per_1m ?? '',
            model.completion_usd_per_1m ?? '',
            input.join('+'),
            output.join('+'),
          ].join(',')
        })
        download('openrouter-models.csv', [header.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8')
      }

      const head = h('div', { className: 'dsor-head' },
        h('div', { className: 'dsor-grow' },
          h('div', { className: 'dsor-title' }, tr('title')),
          h('div', { className: 'dsor-sub' },
            status?.synced_at
              ? tr('status.updated', { ago: relativeTime(status.synced_at, tr), eta: untilText(status.next_sync_at, tr) })
              : tr('status.never'))),
        h('button', {
          type: 'button', className: 'dsor-iconbtn', title: full ? tr('full.close') : tr('full.open'), onClick: () => setFull((value) => !value),
        }, full ? '⤡' : '⤢'),
        h('button', {
          type: 'button', className: 'dsor-iconbtn', title: tr('help.open'), onClick: () => setHelp(true),
        }, '?'),
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
        ['all', 'free', 'discount', 'favorites'].map((value) => {
          const label = value === 'all'
            ? tr('filter.all')
            : value === 'free'
              ? tr('filter.free')
              : value === 'discount'
                ? tr('filter.discount')
                : tr('favorites.filter')
          const count = value === 'all'
            ? models.length
            : value === 'free'
              ? totals.free
              : value === 'discount'
                ? totals.discounts
                : favoriteIds.size
          return h('button', {
            key: value, type: 'button', className: 'dsor-chip', 'data-on': filter === value ? '1' : '0',
            onClick: () => setFilter(value),
          }, `${label} (${count})`)
        }))

      const presetBar = h('div', { className: 'dsor-presets' },
        [['all', tr('preset.all')], ['cheap', tr('preset.cheap')], ['long', tr('preset.long')], ['code', tr('preset.code')]]
          .map(([value, label]) => h('button', {
            key: value, type: 'button', className: 'dsor-chip', 'data-on': preset === value ? '1' : '0',
            onClick: () => setPreset(value),
          }, label)),
        preset !== 'all' ? h('button', { type: 'button', className: 'dsor-linkbtn', onClick: () => setPreset('all') }, tr('preset.reset')) : null)

      const filters = h('div', { className: 'dsor-filters' },
        h('input', {
          className: 'dsor-search', placeholder: tr('search'), value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        chips,
        presetBar,
        h('div', { className: 'dsor-filterline' },
          h(ModalityFilter, { modality, counts: modalityCounts, onSelect: setModality, tr }),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'dsor-chip', title: tr('export.title'), onClick: exportCsv }, tr('export.csv')),
          h('button', { type: 'button', className: 'dsor-chip', title: tr('export.title'), onClick: exportJson }, tr('export.json'))))

      const list = loading
        ? h('div', { className: 'dsor-empty' }, tr('empty.loading'))
        : filtered.length === 0
          ? h('div', { className: 'dsor-empty' }, status?.synced_at ? tr('empty.notfound') : tr('empty.nocatalog'))
          : h('div', { className: 'dsor-list' }, filtered.slice(0, 400).map((model) => h(ModelRow, { key: model.id, model, tr, health: healthMap.get(model.id), selected: comparison.includes(model.id), onCompare: toggleCompare })))

      const compareBar = comparison.length
        ? h('div', { className: 'dsor-cmpbar' },
          comparison.map((id) => {
            const model = models.find((item) => item.id === id)
            return h('button', {
              key: id, type: 'button', className: 'dsor-chip', 'data-on': '1',
              title: tr('compare.remove'),
              onClick: () => toggleCompare(id),
            }, (model ? model.name : id) + ' ×')
          }),
          h('button', { type: 'button', className: 'dsor-linkbtn', disabled: comparison.length < 2, onClick: () => setCompareOpen(true) },
            tr('compare.open', { n: comparison.length })),
          h('button', { type: 'button', className: 'dsor-linkbtn', onClick: () => setComparison([]) }, tr('compare.clear')))
        : null

      const newFreeCount = events.filter((event) => !event.read && (event.type === 'became_free' || (event.type === 'model_added' && event.severity === 'hot'))).length
      const alerts = h(React.Fragment, null,
        h(LowBalanceAlert, { tr }),
        newFreeCount > 0
          ? h('div', { className: 'dsor-alert' },
            h('span', null, tr('alert.newFree', { n: newFreeCount })),
            h('button', { type: 'button', className: 'dsor-linkbtn', onClick: () => setFilter('free') }, tr('alert.freeFilter')))
          : null)

      const compareModels = models.filter((model) => comparison.includes(model.id))
      const compareRows = [
        [tr('compare.context'), (model) => String(contextText(model.context_length))],
        [tr('compare.priceIn'), (model) => model.is_free ? tr('compare.free') : '$' + fmtUsd(model.prompt_usd_per_1m)],
        [tr('compare.priceOut'), (model) => model.is_free ? tr('compare.free') : '$' + fmtUsd(model.completion_usd_per_1m)],
        [tr('compare.input'), (model) => normalizeModalities(model).input.join(', ')],
        [tr('compare.output'), (model) => normalizeModalities(model).output.join(', ')],
        [tr('compare.discount'), (model) => (model.discount ? model.discount.pct + '%' : '—')],
        [tr('filter.free'), (model) => (model.is_free ? '✓' : '—')],
        ['rank', (model) => {
          const row = ranks && ranks.get(model.id)
          if (!row) return '—'
          return (row.usage ? '#' + row.usage : '—') + (Number.isFinite(row.coding) ? ' · ' + row.coding : '')
        }],
      ]
      const compareModal = compareOpen
        ? h('div', { className: 'dsor-help', onClick: () => setCompareOpen(false) },
          h('div', { className: 'dsor-help-card dsor-compare', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'dsor-cmp-head' },
              h('b', null, tr('compare.title')),
              h('span', { style: { flex: 1 } }),
              h('button', { type: 'button', className: 'dsor-iconbtn', onClick: () => setCompareOpen(false) }, '×')),
            h('div', { className: 'dsor-cmp-scroll' },
              compareModels.length === 0
                ? h('div', { className: 'dsor-meta' }, tr('compare.empty'))
                : h('table', { className: 'dsor-cmp-table' },
                  h('thead', null, h('tr', null,
                    h('th', null, tr('compare.param')),
                    compareModels.map((model) => h('th', { key: model.id }, model.name)))),
                  h('tbody', null,
                    compareRows.map(([label, value]) => h('tr', { key: label },
                      h('th', null, label),
                      compareModels.map((model) => h('td', { key: model.id }, value(model)))))))),
            h('div', { className: 'dsor-meta' }, tr('providers.note'))))
        : null

      const views = h('div', { className: 'dsor-views' },
        ['catalog', 'rankings', 'generation'].map((value) => h('button', {
          key: value, type: 'button', className: 'dsor-chip', 'data-on': view === value ? '1' : '0',
          onClick: () => setView(value),
        }, tr('view.' + value))))

      const helpModal = help
        ? h('div', { className: 'dsor-help', onClick: closeHelp },
          h('div', { className: 'dsor-help-card', onClick: (event) => event.stopPropagation() },
            h('b', null, tr('help.title')),
            h('p', { className: 'dsor-help-sub' }, tr('help.subtitle')),
            h('ul', null,
              h('li', null, tr('help.balance')),
              h('li', null, tr('help.filters')),
              h('li', null, tr('help.auto')),
              h('li', null, tr('help.gen')),
              h('li', null, tr('help.health'))),
            h('button', { type: 'button', className: 'dsor-chip', 'data-on': '1', onClick: closeHelp }, tr('help.close'))))
        : null

      return h('div', { className: 'dsor-root' + (full ? ' dsor-full' : '') },
        helpModal,
        compareModal,
        head,
        views,
        error ? h('div', { className: 'dsor-err' }, error) : null,
        view === 'rankings'
          ? h(RankingsView, { tr })
          : view === 'generation'
            ? h(GenerationView, { tr })
            : h(React.Fragment, null,
            h(AutoRoutePanel, { state: auto, onRun: runAutoRoute, disabled: !!status?.in_flight, tr }),
            alerts,
            h('div', { className: 'dsor-health' },
              h('button', {
                type: 'button', className: 'dsor-chip', title: tr('health.title'), onClick: checkHealth, disabled: checking,
              }, checking ? tr('health.checking') : tr('health.check')),
              health && health.summary
                ? h('span', { className: 'dsor-price-label' }, tr('health.summary', health.summary))
                : health && health.ok === false
                  ? h('span', { className: 'dsor-price-label', title: health.error || '' }, tr('health.error'))
                  : h('span', { className: 'dsor-price-label' }, tr('health.never'))),
            kpis,
            filters,
            list,
            compareBar,
            h(Journal, { events, unread, onRead: readEvents, tr })),
        h(BrandMark, { tr }))

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
      }, withBoundary(OpenRouterTab))), 'openrouter-explorer-free: tab body')

      // Price / free / discount badges inside the built-in model selector.
      // A single slot: priority -1 shadows the temporary 1017 badge plugin.
      // A failing label degrades to nothing instead of taking the composer down.
      ctx.effect(() => ctx.slots.inject('conversation.input.model.label', () => ctx.slots.register({
        name: 'conversation.input.model.label',
        priority: -1,
        locale: NS,
      }, withBoundary(ModelPriceLabel, { silent: true }))), 'openrouter-explorer-free: model price labels')

      // The "explorer" pill in the composer, right beside the model selector.
      ctx.effect(() => ctx.slots.inject('conversation.input.right', () => {
        const MenuEntry = withBoundary((props) => h(CatalogMenu, {
          ...props,
          openPanel: () => {
            try {
              const sidebarRight = ctx.get('sidebarRight')
              if (sidebarRight && typeof sidebarRight.openTab === 'function') sidebarRight.openTab(TAB_KIND)
            } catch {
              /* minimal compositions may omit the right sidebar */
            }
          },
        }))
        return ctx.slots.register({ name: 'conversation.input.right', id: 'openrouter-explorer-free-menu', order: 10, locale: NS }, MenuEntry)
      }), 'openrouter-explorer-free: composer menu')
    }

    exports.inject = ['slots', 'sidebarRightTabs']
    exports.apply = apply
    return module.exports
  },
})
