# AGENTS.md — OpenRouter Explorer Free (`dsh-openrouter-explorer-free`)

Плагин DeepSeek Harness: каталог моделей OpenRouter, цены $/1M, бесплатные модели, скидки,
автообновление раз в 24 часа, автороут «Едем на халяву», меню в композере и вкладка в правой панели.

## Правила проекта

- **Никаких API-ключей в репозитории.** Ключ берётся только из DSH credentials / env
  (`OPENROUTER_API_KEY`), в конфигах — исключительно ссылка `apiKeyEnv`.
- Пакет/репозиторий/строка профиля: `dsh-openrouter-explorer-free`; UI: **OpenRouter Explorer Free**;
  HTTP-префикс: `/openrouter-explorer-free`. Старое имя `dsh-openrouter-models` — только в истории changelog.
- Плагин не меняет выбранную модель/сессию по умолчанию: только явные действия пользователя
  («Едем на халяву», клик по строке меню) переключают сессию.
- Host-часть универсальна: `webServer` — опциональная инъекция, поэтому плагин грузится и в
  `headless`, `sdk`, `acp`. Не добавляй обязательную зависимость от Web-стека.
- Мультиязычность обязательна: новые строки UI — через `MESSAGES` (`ru` + `en`, fallback `en`) в `lib/client.js`.
- Состояние: `~/.dsh/openrouter-explorer-free/state.json`, журнал 90 дней (`journalDays`), запись под
  межпроцессным локом. Не возвращай кэш состояния в памяти — несколько профилей делят один `DSH_HOME`.

## Команды

```sh
node --test tests/              # 34 теста: каталог, сервис, провайдер, журнал, состояние
node scripts/test-profiles.mjs  # матрица профилей: web, headless, sdk, acp (4/4)
node --check index.js && node --check lib/client.js
```

## Версия

Источник — `version` в `package.json` (сейчас `0.5.0`); синхронизировать с `CHANGELOG.md`.

<!-- tokenguard:guard -->
## Экономия контекста (tokenguard)

- Перед продолжением длинного чата или при явной смене темы: `tokenguard chats drift`.
- Если смена темы найдена — предложи пользователю новый чат и перенеси состояние:
  `tokenguard chats compact <session> --keep-last 8` (или `tokenguard chats digest <session>`).
- Проверить бюджет: `tokenguard budget status`.
<!-- /tokenguard:guard -->
