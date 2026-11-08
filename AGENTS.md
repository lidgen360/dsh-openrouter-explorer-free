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

Источник — `version` в `package.json` (сейчас `0.5.1`); синхронизировать с `CHANGELOG.md`.

<!-- tokenguard:guard -->
## Экономия контекста (tokenguard)

- Если в запросе есть маркер `[tokenguard-drift]` — **первым блоком ответа** выведи
  `⚠️ tokenguard: смена темы (N) — создать новый чат?`, затем **спроси пользователя через
  интерактивный вопрос** (Да/Нет): «Создать новый чат с переносом контекста?».
- Если пользователь ответил **Да**: обнови конспект (`tokenguard chats digest <session>` и
  `tokenguard chats compact <session> --keep-last 8 --out docs/CHAT-COMPACT.md`) и создай новый чат
  автоматически: `node bin/tokenguard-dsh-new-chat.js --prompt "Прочитай docs/CHAT-COMPACT.md ..."`
  (Safari AppleScript: нажимает «Новая сессия», вставляет перенос и отправляет — ничего вручную).
- Без маркера, перед продолжением длинного чата (≥10 сообщений): `tokenguard chats drift --json`.
- Маркер вкладывает хук DSH (`bin/tokenguard-dsh-hook.js` через `dsh-hooks-claude-code`) — агент
  обязан его отработать, а не пропустить.
- Лимиты бюджета не используются: не запускай и не предлагай `tokenguard budget`.
<!-- /tokenguard:guard -->
