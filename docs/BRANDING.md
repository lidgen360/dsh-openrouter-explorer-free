# Бренд-ссылка Lidogen 360

Единый способ маркировать наши приложения ссылкой на **https://lidogenerator.top**.

## Правило

В каждом приложении — один ненавязчивый след бренда:

1. **Логотип** `assets/logo.svg` (Lidogen 360, 1000×1000) в размере 14–16 px.
2. **Текст** `lidogenerator.top`.
3. **Ссылка** на сайт с UTM-метками, всегда в новой вкладке:
   `target="_blank" rel="noreferrer"`.

Логотип тёмный (чёрный/красный), поэтому на тёмной теме он кладётся в белую
круглую подложку (`background:#fff; border-radius:50%; padding:1px`). На светлой
теме — без подложки.

## UTM-схема

`https://lidogenerator.top/?utm_source=<app>&utm_medium=<surface>&utm_campaign=brand`

| app | surface | где |
|---|---|---|
| `dsh-openrouter-explorer-free` | `app` | футер вкладки плагина |
| `dsh-openrouter-explorer-free` | `readme` | README пакета |
| `tokenguard` | `cli` | футер `tokenguard --help` |
| `tokenguard` | `readme` | README |
| `lidogenerator-admin` | `admin` | сайдбар админки |

## Где уже стоит

- **Плагин OpenRouter Explorer Free**: `lib/client.js` → `BrandMark` в футере вкладки
  (Каталог / Рейтинги / Генерация); логотип раздаётся роутом
  `GET /openrouter-explorer-free/brand/logo.svg` из `assets/logo.svg`.
- README плагина (блок «Сделано в Lidogen 360»).
- tokenguard: футер `--help` и README.
- Админка Lidogenerator: ссылка под версией в сайдбаре.

## Новое приложение — чек-лист

- [ ] скопировать `assets/logo.svg` (этот файл — единственный источник);
- [ ] добавить ссылку в футер/подвал/о программе с UTM;
- [ ] на тёмной теме — белая подложка под логотип;
- [ ] `rel="noreferrer"`, новая вкладка, без автопереходов;
- [ ] не дублировать ссылку на каждом экране — одного места на приложение достаточно.
