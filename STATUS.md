# STATUS — OpenRouter Explorer Free

Обновлено: 2026-11-11. Итог: **ГОТОВО** — репозиторий публичный, релиз `v0.11.2` с tarball, установка с нуля проверена.

## Что это

Плагин DeepSeek Harness: вкладка «Модели OpenRouter» — каталог, рейтинги, скидки, «едем на халяву», баланс ключа, генерация медиа. Ключ остаётся на host-части.

## Живые адреса

| Что | Адрес |
|---|---|
| Лендинг | https://explorer.lidogenerator.top/ |
| Репозиторий | https://github.com/lidgen360/dsh-openrouter-explorer-free |
| Релиз | https://github.com/lidgen360/dsh-openrouter-explorer-free/releases/tag/v0.11.2 |

## Версии

| Компонент | Версия | Где |
|---|---|---|
| Плагин | 0.11.2 (CHANGELOG 11.11) | `package.json`, тег `v0.11.2` |
| Тесты | 74 (11 файлов в `tests/`) | `npm test` |
| GitHub | `lidgen360/dsh-openrouter-explorer-free`, публичный | `origin` |
| npm | не опубликован (ставится из релизного tarball) | — |

## Готово

- [x] Плагин 0.11.2: 74 теста, CHANGELOG, `npm run check`
- [x] Лендинг живой
- [x] Карточка продукта на главном сайте (`products/openrouter-explorer-free.html`)
- [x] Разбор крашей Safari/WebKit (`docs/CRASH-SAFARI.md`)
- [x] **Репозиторий**: создан в организации `lidgen360`, `origin` исправлен, `main` запушен
- [x] **Релиз**: тег `v0.11.2` + tarball плагина в ассетах
- [x] **Установка с нуля**: `scripts/install-smoke.sh` — tarball в чистый `DSH_HOME`, хост стартует, HTTP-API плагина отвечает

## Не готово

- [ ] **Ссылка на установку** на лендинге/карточке продукта (задача Lead)

## Техдолг (P1)

- [ ] Лендинг `openrouter-explorer-site` — без git, только `index.html` + assets
- [ ] Аналитика на лендинге
- [ ] Регламент обновления лендинга при релизе плагина (сейчас ручная сверка)
- [ ] `openrouter-explorer.lidogenerator.top` — не резолвится; оставить или сделать редирект
- [ ] Публикация в npm (сейчас только GitHub Releases)

## Риски

- Плагин ставится только из GitHub-релиза; npm-пакета нет.
- История содержит один старый коммит с локальным путём в `AGENTS.md` (исправлен в текущем дереве, история не переписывалась).

## Следующее действие

1. Поставить ссылку на релиз в лендинге и карточке продукта.
2. При следующем изменении: bump `version`, `CHANGELOG`, тег и релиз с новым tarball.
