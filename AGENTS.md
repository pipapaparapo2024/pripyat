# Stalker VK Mini-App — правила для AI-агентов (Claude Code, Codex и др.)

## ⚠️ ПРАВИЛО №0: ВСЕГДА ГОВОРИТЬ НА РУССКОМ ЯЗЫКЕ

Весь текст, который видит пользователь — ответы в чате, названия и описания задач
(TaskCreate/TaskUpdate), сообщения коммитов, пояснения — **только на русском языке**, без
исключений. Английский допустим только там, где это код/технические идентификаторы: сам код,
имена переменных/функций, комментарии в коде (можно оставлять английские термины), пути файлов.
Название и описание задачи в TaskCreate — тоже пользователь-видимый текст, писать по-русски.

## ⚠️ ПРАВИЛО №1: ПЕРЕД ЛЮБЫМИ ПРАВКАМИ ЧИТАТЬ ПОЛНОЕ ТЗ

**PDF:** `C:\Users\HONOR\Desktop\vk_game\projects_2026\stalker\Припять.pdf` (37 страниц, 67 изображений)  
**Google Docs:** https://docs.google.com/document/d/1BBQ0yOwZiRE-X7ccD-kFKO9IltRAVjXV/edit

### Шаг 1 — Извлечь текст ТЗ:
```python
import fitz
doc = fitz.open(r"C:\Users\HONOR\Desktop\vk_game\projects_2026\stalker\Припять.pdf")
text = ""
for i, page in enumerate(doc):
    text += f"\n=== PAGE {i+1} ===\n" + page.get_text()
with open(r"C:\Users\HONOR\AppData\Local\Temp\tz_ru.txt", "w", encoding="utf-8") as f:
    f.write(text)
```
Читать `C:\Users\HONOR\AppData\Local\Temp\tz_ru.txt` через Read tool (все 37 страниц).

### Шаг 2 — Извлечь изображения ТЗ при необходимости:
```python
import fitz, os
doc = fitz.open(r"C:\Users\HONOR\Desktop\vk_game\projects_2026\stalker\Припять.pdf")
out_dir = r"C:\Users\HONOR\AppData\Local\Temp\tz_images"
os.makedirs(out_dir, exist_ok=True)
for page_num in range(len(doc)):
    for img_idx, img in enumerate(doc[page_num].get_images(full=True)):
        xref = img[0]
        base_image = doc.extract_image(xref)
        fname = f"p{page_num+1}_img{img_idx+1}.{base_image['ext']}"
        with open(os.path.join(out_dir, fname), "wb") as f:
            f.write(base_image["image"])
```
Читать нужные изображения через Read tool — они JPEG, Read поддерживает просмотр.

**Распределение изображений по страницам:**
- Стр. 1-13: UI мокапы и скрины референса (тюряга-бот) — важны для понимания дизайна
- Стр. 26: 15 изображений — карточки коллекций/заначек
- Стр. 27: База игрока (последнее изображение)

---

## Папка с ассетами (изображения, звуки)

**Источник ассетов:** `C:\Users\HONOR\Desktop\vk_game`  
Здесь хранятся все исходные PNG/JPG/MP3 файлы (например `popap_nagrada.png`, карточки, фоны).  
Когда нужно взять новое изображение — искать сначала здесь.  
Целевая папка деплоя ассетов: `_client/development/images/` (затем FTP upload с URL-кодированием кириллицы).

---

## ⚠️ ПРАВИЛО №2: НЕ ДОБАВЛЯТЬ НОВЫЕ FLA БЕЗ ЯВНОГО УКАЗАНИЯ

FLA → компилируются в `.min.js`. Все изменения только в `_client/src/*.js`.

## ⚠️ ПРАВИЛО №3: НЕ ТРОГАТЬ БАЗУ ДАННЫХ (не очищать, не DROP/TRUNCATE)

---

## Текущая версия

Не хранить здесь — всегда читать из файла:
```bash
grep -o 'v=[0-9]*' _client/development/index.html
```
При деплое: найти текущее значение → поднять на 1 → записать.

---

## Стек

- **Tolmasoft Engine 5.3.0** — PixiJS 6.5.10 + PIXI.animate
- **Webpack 5**: `_client/src/` → `_client/development/libs/index.js`
- **Деплой**: `bash upload.sh <local> <remote_path>` — SFTP (root) на 155.212.211.202 (pripyat-game.ru), base `/var/www/stalker`
- **Сервер**: PHP на `pripyat-game.ru/server/...` (БЕЗ `/stalker/` в публичном URL — это только часть пути на диске), роутер `universal.php`
- **VK mini-app**: `vk.com/app54574178_438953352`

### SSH-доступ к серверу (админ-задачи — firewall, nginx, диагностика; НЕ для обычного деплоя)

02.10.2026: заведён отдельный SSH-ключ для `root@155.212.211.202`, чтобы не держать пароль в
чате/командах. Alias в `~/.ssh/config` (на машине пользователя, НЕ в репозитории) —
`Host stalker-vps`, ключ `~/.ssh/id_ed25519_stalker` (без passphrase). Подключение: `ssh stalker-vps`.
Приватный ключ лежит вне папки проекта (`C:\Users\HONOR\.ssh\`), в git никогда не попадёт — коммитить
нечего. Парольный вход при этом не отключён, продолжает работать как раньше (пароль — см.
`SECRETS_LOCAL.md`/`upload.sh`, оба в `.gitignore`, не коммитятся).

### ⚠️ БД — актуальные данные (сервер сменился 14.09.2026, проверено и исправлено вживую)

Это **НОВЫЙ** сервер (155.212.211.202) — MySQL локальный, на нём же:
- host: `127.0.0.1`, порт **`3306`**
- база: `stalker`, юзер: `stalker`, пароль: см. `SECRETS_LOCAL.md` (28.09.2026 — вынесен из этого
  файла, т.к. `CLAUDE.md` коммитится в GitHub; `SECRETS_LOCAL.md` в `.gitignore`, никогда не коммитится)
- прописано в `server/core/models/registry.php` (host/user/db) — порт **захардкожен отдельно в каждом файле**, который открывает своё `new mysqli(...)` (это так исторически, не только в registry), поэтому если добавляешь новый файл с прямым подключением к БД — **порт 3306**, не 6033.

**СТАРЫЕ (нерабочие на этом сервере) значения — если увидишь их где-то в коде, это баг:**
`host=192.168.0.172`, `порт=6033`, `user=db=stalker_test` — это от ПРЕЖНЕГО хостинга (виден в старых записях `php_errors.log`: путь `/www/wwwroot/xuliki.top/...`). 14.09.2026 из-за этих значений в `registry.php` реальные игроки получали 504/500 (БД была недостижима) — потрачено много времени на диагностику через SSH, прежде чем нашли рабочие port/host/user эмпирически.

**После правки PHP-файлов с прямым подключением к БД (registry.php, database.php, controllers/*.php с raw mysqli) — ОБЯЗАТЕЛЬНО `systemctl restart php8.5-fpm` на сервере после заливки**, иначе PHP opcache держит старую версию файла в памяти и правки не применяются, пока воркер сам не перезапустится.

FTP (креды в `SECRETS_LOCAL.md`, IP 45.159.208.173) — это тоже от старого хостинга, деплой сейчас идёт через SFTP напрямую (см. выше), FTP не используется.

### ⚠️ Архитектура сервера: серверно-авторитетная экономика (миграция 17–18.09.2026)

С 17-18.09.2026 бо́льшая часть игровой экономики (RNG, расчёт наград, анти-чит проверки)
переехала с клиента на сервер. Это не разовая правка одного файла — единый паттерн,
применённый почти ко всем контроллерам сразу. **Перед правкой любого server/core/controllers/*.php
сначала проверять, использует ли он этот паттерн** (grep `Gameops` внутри файла), иначе легко
продублировать логику, которая уже валидируется сервером.

**Ключевые классы** (`server/core/models/`):
- `gameops.php` — общий хелпер, инжектируется в конструктор контроллера как `$this->ops = new Gameops($registry)`.
  Методы: `loadUser($fields)` / `saveUser($update)` — читают/пишут ПОЛНУЮ строку игрока (не только whitelist users.php);
  `i($user,$key,$default)` / `j($user,$key,$default)` — типизированные геттеры (int / JSON-массив, `j()` учитывает,
  что `Database::trueJSON()` уже сам раскодировал JSON-поля — повторный `json_decode()` на уже-массиве кидает
  PHP 8 TypeError без трейса в error_log, если не проверить `is_array()` до декода);
  `deduct()`/`add()` — списание/начисление валюты с проверкой баланса;
  `catalog($name)` — грузит `server/json/$name.json` через Jsonloader;
  `ok($extra)`/`fail($code)` — стандартные ответы; `patchCurrencies($user,$keys=null)` — собирает подмножество
  изменившихся полей для отправки клиенту как `patch` (см. ниже).
- `jsonloader.php` — тривиальный `get($name,$decode,$type)`/`set()` для файлов `server/json/[$type/]$name.json`.

**Паттерн контроллера**: `__construct` создаёт `$this->ops = new Gameops($registry)` и
`$this->permits = [...]`; приватный `_catalog()` возвращает `$this->ops->catalog('имя_config')`.
Применён в: `base.php`, `bosses.php`, `gangs.php`, `poker.php`, `shmot.php`, `blackjack.php`,
`dice.php`, `bp.php`, `hapuga.php`, `roulette.php`, `habar.php`, `skills.php`, `top.php`,
`users.php`, `tasks.php` (целиком новый контроллер), `vassilich.php`, `yashik.php`, `weapons.php`,
`zone.php`. Исключение — `event.php` (старый паттерн, без Gameops, не трогали).

**JSON-каталоги** (`server/json/*_config.json`) — единый источник баланса для конкретной игры,
раньше эти числа были захардкожены в клиентском JS: `blackjack_config.json`, `bosses_config.json`
(`bosses[]`, `diff_mult[]`, `daily_kill_limit`, `gang_bonus`, `ryukzak_pts[]`), `dice_config.json`
(`table[]`, `jackpot`, `pity_min/max`, `free_cooldown_ms`, `swaps_by_level[]`), `poker_config.json`,
`skills_config.json`, `weapons_config.json`, `yashik_config.json`, `zone_config.json`. Если нужно
поменять баланс (награды/шансы/лимиты) для этих игр — редактировать JSON-каталог, а не искать
числа в JS.

**Скрытые от клиента служебные поля** — намеренно НЕ добавлены в whitelist `$allowed` в
`users.php`, чтобы клиент не мог подделать их через `users.save`: `dice_session`, `poker_session`,
`blackjack_session`, `skills_levels`, `roulette_cups`, `zadaniya_session`, `boss_fight_session`
(24.09.2026 — кэш личного HP + курсор урона друзей боя с боссом, см. bosses.php._syncFightSession();
критично, что живёт ОТДЕЛЬНО от `bosses_data`, который УЖЕ в whitelist — класть мутируемый HP
туда же было бы прямой дырой, curHp:0 одним users.save). Читает/пишет их только сам сервер через
`Gameops::loadUser()/saveUser()` (полная строка, не whitelist). Если добавляешь новую
server-authoritative игру — новое служебное поле по той же логике НЕ вносить в whitelist.

**`applyPatch(patch)`** (`_client/src/modules/patch.js`) — клиентская сторона: `Object.assign(udata, patch)`,
обновляет `TIMERS.current_energy`/`ENERGY_MAX`, дёргает `iface.updateUp()/updateEnergy()/updateNick()`.
Любой новый server-authoritative эндпоинт, возвращающий `patch`, клиент обязан прогонять через
`applyPatch()` — не мёржить поля вручную.

**Пример полного цикла (боссы)** — эталон для похожих миграций:
`_openBossesFight()` (`shell/overlays/bosses_fight.js`) вызывает `bosses.startFight` (сервер
проверяет зачистку локации, списывает ключи, пишет `bossStartMs`, идемпотентен при повторе) →
`applyPatch(res.patch)`. При HP=0 `_onDefeat()` (`game/bosses/bosses-combat.js`) вызывает
`bosses.claimKill` (сервер проверяет окно `MAX_FIGHT_WINDOW_MS`=9ч+запас на скилл-бонус, дневной
лимит по серверным часам, считает награду по `bosses_config.json`) → `applyPatch(res.patch)`.
**Осознанное ограничение** (задокументировано в коде): урон за удар (оружие/скиллы/криты/патроны)
по-прежнему считает клиент — перенесены только старт боя и начисление награды, не поудpróаный урон.

**Server-only session-поля (НЕ добавлять в whitelist `$allowed` в `users.php` — никогда, даже
"чтобы починить баг"):** `skills_levels`, `dice_session`, `poker_session`, `blackjack_session`,
`yashik_session`, `roulette_cups`, `zadaniya_session`, `boss_fight_session`. Их пишет и читает ТОЛЬКО сам сервер через
`Gameops::loadUser()/saveUser()` (полная строка) — это и есть механизм защиты от читерства для
соответствующих игр. Если полю нужно попасть в whitelist «чтобы клиент увидел значение» — не
делать так: значение уже приходит клиенту через `users.get` (`SELECT *`) или через `patch` в
ответе конкретного эндпоинта, писать его должен только сервер.

**⚠️ Полный сброс аккаунта (dev-панель) должен чистить и эти поля тоже.** Обычный
`users.save()` их физически не касается (см. выше) — для этого есть отдельный permit
`users.resetSession` (`server/core/controllers/users.php`), обнуляющий все 6 полей напрямую в
БД для своего `uid`. `dev_panel.js._resetAccount()` обязан вызывать ОБА — `users.save` (обычный
whitelist) И `users.resetSession` (server-only поля) — иначе "сброшенный" аккаунт молча оставляет
прокачанные скиллы/зависшие игровые сессии. При добавлении НОВОЙ server-only игры с похожим
скрытым полем — сразу добавлять её сюда же (и в список выше), не откладывать.

## ⚠️ ПРАВИЛО №9: НОВАЯ ЭКОНОМИКА/НАГРАДЫ/RNG — ПО УМОЛЧАНИЮ НА СЕРВЕРЕ

С 17-18.09.2026 действует общий архитектурный стандарт (см. раздел выше) — любая НОВАЯ фича,
которая начисляет валюту/опыт/предметы или использует случайность (RNG), проектируется
СРАЗУ как server-authoritative, а не "клиент считает — потом перенесём". Причина: перенос
уже готовой клиентской логики на сервер (как это было проделано для боссов/зариков/покера/
блэкджека/скиллов в этом батче) — дорогая, рискованная работа, которую лучше не повторять.

**Чек-лист при добавлении новой игры/механики с наградой:**
1. Таблица баланса (шансы/суммы/лимиты) — в `server/json/новая_config.json`, не в JS.
2. Контроллер — `$this->ops = new Gameops($registry)` + `$this->permits` + `_catalog()`, по
   образцу любого из уже мигрированных (`dice.php` — хороший небольшой пример).
3. Если у механики есть промежуточное состояние, которое клиент не должен видеть/подделывать
   (текущая раздача, pity-счётчик, флаг "уже использовано сегодня") — держать его в отдельном
   служебном поле (`имя_session` или `имя_levels`) и НЕ добавлять в whitelist `users.php`
   (см. список server-only полей выше и не забыть добавить туда новое).
4. Ответ эндпоинта возвращает `patch` — клиент применяет его через `applyPatch()`
   (`_client/src/modules/patch.js`), не мёржит поля вручную.
5. Если фича попадает в "сброс аккаунта" (dev-панель) — новое server-only поле сразу дописать
   в `users.resetSession()` (`server/core/controllers/users.php`), иначе сброс будет неполным
   (см. предупреждение выше).

Если механика ТОЧНО не про деньги/награды/RNG (чисто визуальная настройка, косметика без
экономического веса) — можно оставить клиент-side, как раньше. Сомневаешься — спроси, не
угадывай молча.

**DB-миграции** (`server/migrate19.php`–`migrate21.php`, запускать вручную через URL с `?key=...`,
после выполнения удалять файл с сервера): migrate19 — `skills_levels` (прокачка скиллов на
сервер, раньше писалась client-writable `skills_data` — можно было накрутить все 20 скиллов
бесплатно), migrate20 — `poker_session` (RNG/раздача покера на сервер), migrate21 —
`blackjack_session` (pity-счётчики AA/KK/QQ и дневной лимит блэкджека на сервер).

### Сборка — известные предупреждения (норма, не анализировать)

```
WARNING: asset size limit — index.js (~288 KiB > 244 KiB)  ← это всегда, игнорировать
```

Ошибки сборки выглядят как `ERROR in ...` — вот их нужно чинить. Предупреждения — нет.

## ⚠️ ПРАВИЛО №4: ДЕПЛОЙ ТОЛЬКО ПО ЯВНОЙ КОМАНДЕ — НИКОГДА САМОСТОЯТЕЛЬНО

**НИКОГДА** не делать деплой (FTP upload, upload.sh, SFTP, curl) самостоятельно.
Не деплоить автоматически после правок, даже если правки полностью завершены.
Готовые правки сообщать словами «готово к деплою», и ждать команды.

**02.10.2026 (по прямому указанию) — ДВЕ РАЗНЫЕ команды, не путать:**

| Слово пользователя | Куда | Что значит |
|---|---|---|
| **«деплой»** | `test-pripyat-game.ru` (`/var/www/stalker-test`, БД `stalker_test`) | рабочая, итеративная проверка изменений — НЕ трогает прод и реальных игроков |
| **«супер деплой»** | `pripyat-game.ru` (`/var/www/stalker`, БД `stalker`) | финальное решение — прод, реальные игроки |

Рабочий процесс: **все обычные правки сначала идут на тест** («деплой» → test), и только когда
пользователь явно подтвердил «супер деплой» — изменения едут на прод. Не предлагать «супер
деплой» самостоятельно, даже если тест прошёл успешно — это отдельное решение пользователя.

**Шаги для «деплой» (→ тест):**
1. Прогнать тесты (`run_tests.js` + весь `tests/*.test.js`) → собрать (`npm run build`).
2. Залить на сервер по SFTP с третьим аргументом `test` (см. `upload.sh`) — JS/HTML в оба пути
   (`/client/ver0_41/development/...` и `/client/ver0_41/...`), изменённые PHP-файлы,
   `systemctl restart php8.5-fpm`.
3. **Git НЕ трогать** — тестовый деплой не коммитится и не пушится, это черновая проверка.

**Шаги для «супер деплой» (→ прод) — ОБА шага, не только сервер:**
1. Прогнать тесты → собрать → залить по SFTP **без** `test` (т.е. на прод, см. `upload.sh`).
2. **Плюс закоммитить и запушить в GitHub** (`https://github.com/pipapaparapo2024/pripyat`,
   ветка `main`) — тот же набор изменённых файлов, с внятным commit-сообщением. Репозиторий
   уже настроен (`gh` авторизован на этой машине), `_client/development/`/`node_modules`/
   скрипты с паролями — в `.gitignore`, коммитить не нужно.

Порядок шагов внутри каждой команды неважен, но оба шага «супер деплоя» — часть одной команды,
не два отдельных запроса.

**Технически:** `upload.sh <local> <remote_path> [test]` — без третьего аргумента грузит на
прод (`/var/www/stalker`), с `test` — на тестовый сайт (`/var/www/stalker-test`). Тестовый сайт
использует отдельную БД `stalker_test` (клон структуры/данных `stalker` от 02.10.2026, дальше
расходится самостоятельно) — изменения там не задевают реальных игроков.

## ⚠️ ПРАВИЛО №8: ПОДРОБНОЕ ЛОГИРОВАНИЕ В КОДЕ

При любой отладке/новом функционале добавлять **детальные console.log/console.error** с указанием:
- Что именно происходит в данный момент (этап загрузки, рендера и т.д.)
- Конкретные значения переменных/данных
- Ссылку на файл и функцию в формате `[ИмяФайла.функция]`
- Что пошло не так и почему (не только факт ошибки, но и контекст)

Пример правильного лога:
```js
console.log('[spine-boss._spineBossLoad] atlas загружен, страниц:', atlas.pages.length, 'регионов:', atlas.regions.length);
console.error('[spine-boss._spineBossLoad] ошибка парсинга JSON:', e.message, '| причина: несовместимость IK-констрейнтов');
```

Это правило постоянное — не убирать логи без явного указания пользователя.

---

## Workflow после правок

1. Правки в `_client/src/`
2. `cd _client && npm run build` (Bash, не PowerShell)
3. Поднять версию в `_client/development/index.html`: `index.js?v=NNN` → `v=NNN+1`
4. FTP upload — **ОБЯЗАТЕЛЬНО В ОБА МЕСТА** (иначе VK видит старую версию):

```bash
# Из директории: C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat

# JS — оба места:
bash upload.sh "_client/development/libs/index.js" "/client/ver0_41/development/libs/index.js"
bash upload.sh "_client/development/libs/index.js" "/client/ver0_41/libs/index.js"

# HTML — оба места:
bash upload.sh "_client/development/index.html" "/client/ver0_41/development/index.html"
bash upload.sh "_client/development/index.html" "/client/ver0_41/index.html"
```

5. При новых полях udata → добавить в whitelist `users.php` + ALTER TABLE миграция

### Детали шага 5 — новые поля udata

**Whitelist** в `server/users.php` — найти массив `$allowed` и добавить ключ:
```php
$allowed = ['coins', 'cigarettes', ..., 'новое_поле'];
```

**Миграция** — выполнить SQL на сервере:
```sql
ALTER TABLE users ADD COLUMN новое_поле VARCHAR(64) DEFAULT '0';
```

Тип выбирать по данным: `VARCHAR(64)` для чисел/строк, `TEXT` для JSON-данных (dvor_games_data, dvor_daily и т.п.).

---

## ⚠️ ПРАВИЛО №6: НЕ ЗАПУСКАТЬ ПРОЕКТ ЛОКАЛЬНО САМОСТОЯТЕЛЬНО

Никогда не запускать локальный dev-сервер или сборку без явной просьбы пользователя.
Исключение: `npm run build` — только после завершения всех правок, перед деплоем.

**24.09.2026 (повторное указание, для однозначности): это правило распространяется и на
инструмент Browser (Claude Browser / Claude in Chrome) — никогда самостоятельно не открывать
`vk.ru/games/app...` или задеплоенную версию игры в браузере "чтобы проверить" правку, даже
если общая инструкция агента для UI-задач по умолчанию требует открыть браузер и проверить
фичу вживую — для ЭТОГО проекта это правило явно её отменяет.** Игра требует реальной VK-сессии
и реального игрового прогресса — её тестирует только сам пользователь (в VK или через админку),
а мне он присылает скриншоты/консольные логи. Подтверждать правки — сборкой (`npm run build`)
и синтаксис-чеком, не собственным открытием игры.

---

## ⚠️ ПРАВИЛО №7: ЧИСТАЯ АРХИТЕКТУРА — НЕБОЛЬШИЕ ФАЙЛЫ, МОДУЛЬНОСТЬ

**Максимальный размер файла: ~400–500 строк.** При обнаружении god-файла (>600 строк) — предлагать план разбиения, но не рефакторить без явной просьбы.

**Текущее состояние (авг 2025):**
- `game/dvor.js` — ✅ разбит на модули (425 строк базовый класс)
- `game/zone.js` — ✅ разбит: `zone/zone-popup.js` (попап локации), `zone/zone-biz.js` (попап бизнеса)
- `game/interface.js` — 586 строк, допустимо
- `game/dvor/dvor-poker.js` — 639 строк (чуть выше лимита, OK пока не растёт)
- `game/bosses.js` — 530 строк, допустимо

**Паттерн разбиения:** использовать `attachX(proto)` — как уже сделано в `yashik.js`, `ryukzak.js`:
```js
// dvor-dice.js
export function attachDice(proto){ proto._buildDiceScreen = function(){ ... }; }
// dvor.js
import { attachDice } from './dvor/dvor-dice.js';
attachDice(Dvor.prototype);
```

**Общие принципы:**
- Один файл = одна ответственность (одна игра / один экран / один модуль)
- Не добавлять новые большие функции в уже раздутые файлы — создавать новый файл
- Новые оверлеи/экраны → всегда в `shell/overlays/имя_экрана.js`

---

## Карта глобальных объектов (window.*)

Все объекты создаются в `_client/src/modules/module_control.js`:

| Глобал | Класс | Файл | Ключевые методы |
|---|---|---|---|
| `iface` | Interface | `game/interface.js` | `updateUp()`, `_openSidorovichError()`, `_openBuyPatronPopup()` |
| `home` | Home | `game/home.js` | `openScreen(mc)`, `closeScreen()` |
| `notify` | Notifications | `game/notifications.js` | `showResult({text}, 0)` |
| `dvor` | Dvor | `game/dvor.js` | `open()`, `close()` |
| `bank` | Bank | `game/bank.js` | `successDonat()`, `init(tab)` |
| `zone` | Zone | `game/zone.js` | — |
| `bosses` | Bosses | `game/bosses.js` | — |
| `weapons` | Weapons | `game/weapons.js` | — |
| `shmot` | Shmot | `game/shmot.js` | `giveRandom(n)` |
| `skills` | Skills | `game/skills.js` | — |
| `achievements` | Achievements | `game/achievements.js` | `onDvorGame(type, data)`, `onDvorLevel(game, lvl)` |
| `battlepass` | Battlepass | `game/battlepass.js` | `addXp(n)` |
| `habar` | Habar | `game/habar.js` | — |
| `svod` | Svod | `game/svod.js` | — |
| `top` | Top | `game/top.js` | — |
| `gangs` | Gangs | `game/gangs.js` | — |
| `vassilich` | Vassilich | `game/vassilich.js` | — |
| `hapuga` | Hapuga | `game/hapuga.js` | — |
| `bot` | Bot | `game/bot.js` | — |
| `base` | Base | `game/base.js` | — |
| `notify` | Notifications | `game/notifications.js` | — |

**Слои рендеринга:**
- `root.layer1_mc` — основной HUD (iface.up, iface.down, bank)
- `root.layer2_mc` — оверлеи и попапы поверх всего

---

## Карта файлов проекта

```
_client/src/
├── index.js                        — точка входа, глобалы window.*
├── modules/
│   ├── module_control.js           — создаёт все window.* объекты
│   ├── mobile-viewport.js          — доступная область экрана (safe-area), тач-детект, события пересчёта размера канваса
│   └── universal_helper.js         — helper утилиты (в т.ч. touchPad — зона нажатия под палец)
└── game/
    ├── interface.js                — HUD, updateUp, попапы ошибок
    ├── home.js                     — openScreen/closeScreen
    ├── base.js                     — база игрока
    ├── zone.js                     — локации, энергия (base-class, ✅ разбит)
    │   └── zone/
    │       ├── zone-popup.js       — _openLocationPopup, _updateLocPopup
    │       └── zone-biz.js         — _preloadLocationAssets, _openBizPopup
    ├── bosses.js                   — боссы
    ├── weapons.js                  — оружие
    ├── bank.js                     — VK-донат, successDonat
    ├── dvor.js                     — казино базовый класс + импорты модулей
    ├── dvor/
    │   ├── dvor-poker.js           — покер FLA + новый экран
    │   ├── dvor-roulette.js        — рулетка FLA + новый экран
    │   ├── dvor-dice.js            — зарики FLA + новый экран
    │   ├── dvor-blackjack.js       — блэкджек экран
    │   └── dvor-cards.js           — карты (СОРВИ КУШ)
    ├── achievements.js             — достижения
    ├── battlepass.js               — боевой пропуск
    ├── skills.js                   — навыки
    ├── shmot.js                    — шмотки
    ├── habar.js                    — заначки
    ├── svod.js                     — свод
    ├── top.js                      — топ игроков
    ├── gangs.js                    — группировки
    ├── notifications.js            — уведомления (notify.showResult)
    ├── preloader.js                — загрузчик
    └── shell/
        ├── overlays/
        │   ├── yashik.js           — ящик (покупка патрон, _openSidorovichError)
        │   ├── ryukzak.js          — рюкзак
        │   ├── sidorovich.js       — сидорович (магазин)
        │   ├── zone_screen.js      — экран локации
        │   └── bosses_select.js    — выбор босса
        ├── popups/
        │   ├── confirm.js          — попап подтверждения
        │   ├── currency.js         — попап валюты
        │   ├── energy_buy.js       — покупка энергии
        │   ├── level_up.js         — левел-ап
        │   ├── nick.js             — ник
        │   ├── reward.js           — награда
        │   └── sound.js            — звук
        └── ui_kit.js               — общие UI-компоненты

overlays/ (доп. к списку выше, добавлены 17-18.09.2026):
    ├── player_profile.js       — попап профиля игрока (просмотр чужого/своего профиля)
    ├── shmot_pos_editor.js     — редактор позиций для карточек шмоток
    └── universal_pos_editor.js — общий редактор позиций (x/y/scale элементов, Shift+клик по наложенным)

game/svod/ (заменил монолитный game/svod.js):
    ├── svod-achievements.js    — вкладка достижений свода
    ├── svod-leaderboard.js     — вкладка топа/рейтинга
    ├── svod-news.js            — вкладка новостей
    └── svod-scroll.js          — общий скролл-контейнер вкладок свода
```

---

## Константы UI (не читать файлы ради этого)

**Canvas:** 1280 × 720 px

**HUD-зоны:**
- Top HUD: y = 0–58
- Игровая зона: y = 58–604
- Bottom HUD: y = 604–720

**Стандартная кнопка выхода (все экраны):**
```js
exitBtn.scale.set(0.5);
if(window.isMobile) helper.touchPad(exitBtn);   // 27.09.2026: обязательно, см. «Адаптив» ниже
exitBtn.x = 1240; exitBtn.y = 83;
```

**Стандартный фон экрана:**
```js
bg.width = 1280; bg.height = 690; bg.y = 15;
```

**Стандартные стили текста:**
```js
// Заголовок/ценность (золото)
{ fontFamily:'Southbank LT', fontSize:22, fill:'#ffcc44', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1 }

// Обычный белый
{ fontFamily:'Southbank LT', fontSize:20, fill:'#ffffff', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1 }

// Результат (жёлтый, крупнее)
{ fontFamily:'Southbank LT', fontSize:22, fill:'#ffdd44', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2 }

// Поинты/ресурс (красный — dice_points)
{ fontFamily:'Southbank LT', fontSize:22, fill:'#ff2222', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1 }

// Поинты (синий — blue_points)
{ fontFamily:'Southbank LT', fontSize:20, fill:'#7fb8ff', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1 }
```

---

## Адаптив под мобильные и иные устройства (состояние на 27.09.2026)

**Как игра вписывается в экран.** Логический размер сцены — всегда 1280×720 (`PIXI.animate.Scene`
в `index.js`), физически канвас letterbox-вписывается в экран с сохранением пропорций, плюс
`renderer.resolution` пересчитывается под `devicePixelRatio` (фикс 18.09.2026 — без него всё
замывалось; вместе с ним ОБЯЗАТЕЛЬНО синхронизировать `plugins.interaction.resolution`, иначе
клики уезжают). **Под любой РАЗМЕР экрана игра адаптируется уже сейчас** — открытый вопрос
только в СООТНОШЕНИИ СТОРОН (см. «Не сделано» ниже).

**`modules/mobile-viewport.js` — единственный источник размеров.** Не читать
`window.innerWidth/innerHeight` напрямую в новом коде: `viewportMetrics()` отдаёт `{w, h, left,
top, insets, portrait}` — те же числа МИНУС безопасная зона экрана (вырез камеры, «бровь»,
системная полоса жестов). Подписка на изменения — только `onViewportChange(cb)`: внутри уже
собраны `resize` + `orientationchange` + `visualViewport`, дебаунс по кадру и повторные
пересчёты через 120/350/700 мс (iOS отдаёт актуальные метрики ПОЗЖЕ самого события поворота).
`window.isMobile` выставляет `installMobileViewport()` — UA + `maxTouchPoints` + `pointer:coarse`
(старая проверка только по UA пропускала iPad на iPadOS 13+ и планшеты на Windows).
Экранная клавиатура сознательно НЕ считается изменением вьюпорта (иначе игра прыгает в
масштабе на каждый ввод текста) — размеры берутся из `window.*`, `visualViewport` только сигнал.

**`helper.touchPad(obj, minLogical = 72)` — зона нажатия под палец.** Расширяет `hitArea`, не
трогая картинку/scale/позицию. Нужно любому мелкому элементу: стандартная кнопка выхода (файл
62×58 при scale 0.5 = 31×29 логических пикселя) физически выходит 9–20 CSS-пикселей при
рекомендованном минимуме ~44. Применено ко всем 26 кнопкам выхода. Вызывать ПОСЛЕ установки
scale и текстуры; минимум задаётся в ЛОГИЧЕСКИХ пикселях сцены (hitArea не пересчитывается при
resize, поэтому привязать её к текущему масштабу экрана нельзя).

**Что уже нельзя сломать в `index.html`** (правки 27.09.2026, действуют до загрузки бандла):
`user-scalable=no,maximum-scale=1.0` (иначе двойной тап/pinch масштабируют страницу, а канвас
нет — игрок видит обрезанный кусок и не может вернуть масштаб), `body{position:fixed}` (iOS
игнорирует `overflow:hidden` при оттягивании пальцем), `overscroll-behavior:none`
(pull-to-refresh перезагружал приложение), `canvas#stage{touch-action:none}` (иначе браузер
ждёт ~300 мс «не двойной ли тап» перед КАЖДЫМ нажатием), `-webkit-tap-highlight-color` и
`-webkit-touch-callout` (подсветка выделения и меню «сохранить изображение» по долгому тапу).

**Память текстур — главный риск краша на телефоне.** Ранний прелоад (`game-boot.js`,
`_allGamePngs`) грузит ~400 PNG. Смотреть не на вес файла, а на РАСПАКОВАННЫЙ размер
(ширина × высота × 4 байта) и сравнивать его с размером НА ЭКРАНЕ: 27.09.2026 нашлись 30
файлов `cp_art_*.png` 1402×1122, которые рисуются принудительными 160×107 (180 МБ RGBA / 71 МБ
загрузки ради картинок 160×107), и 7 файлов «ключ *.png» 1086×1448 при показе 65×87. Уменьшены
до 480×384 и 272×362 соответственно (суммарно −198 МБ RGBA, −69 МБ загрузки), оригиналы —
`_originals_before_downscale_27_09_2026/`. **При уменьшении файла обязательно проверить, как он
масштабируется в коде:** заданы явные `width/height` (как cp_art) — правок не нужно; задан
`scale` (как `REWARD_KEY_SCALE` в `bosses_prefight.js`) — scale надо умножить на тот же
коэффициент, иначе картинка станет мелкой. По этой же причине НЕ уменьшены иконки шмоток
(58 файлов, 83 МБ RGBA): в `shmot.js` у предметов есть вручную снятые `cellScale`/`manScale`,
их пришлось бы пересчитать все.

**Не сделано (осознанно, ждёт решения):**
1. ~~Ориентация экрана~~ — **28.09.2026 сделан вариант A (экран «поверните устройство»), 03.10.2026
   заменён на настоящий форс-ландшафт (по прямому указанию — "пусть игра сама разворачивает
   экран, а не через кнопку поворота").** На портретном мобильном (`window.isMobile && vp.portrait`
   из `modules/mobile-viewport.js`) канвас больше не прячется — вместо этого поворачивается через
   CSS `transform:rotate(90deg)` вокруг своего центра, подогнанный под доступное пространство с
   учётом поворота (`modules/forced-landscape.js: applyRotatedCanvasStyle()`), подключено в
   `index.js.resize()`. 18.09.2026/28.09.2026 CSS-поворот канваса сознательно НЕ использовался:
   PIXI `InteractionManager` считает координаты нажатий через `getBoundingClientRect()` + линейный
   scale по осям X/Y, ничего не зная о повороте — под `rotate()` экранные X/Y перестают совпадать
   по смыслу с локальными X/Y канваса, вся кликабельность уезжает. 03.10.2026 эта проблема решена
   не отказом от поворота, а собственной реализацией `mapPositionToPoint`
   (`modules/forced-landscape.js: mapPositionToPointRotated()`), которая аналитически ОБРАЩАЕТ
   именно поворот (не линейно масштабирует) — устанавливается в `scene.renderer.plugins.
   interaction.mapPositionToPoint` вместо штатной реализации PIXI, пока канвас повёрнут, и
   возвращается обратно, когда нет. Направление поворота — константа `ROTATE_DEG` в том же файле
   (90 по умолчанию, при необходимости сменить физическое направление поворота телефона под игрока
   — поменять на -90, формулы сами учтут). Старый оверлей «поверните устройство»
   (`modules/rotate-overlay.js`) оставлен в репозитории неиспользуемым (на случай отката), но
   `index.js` его больше не вызывает. Вёрстка самой игры (1280×720) не менялась — при РЕАЛЬНОМ
   повороте физического устройства в ландшафт канвас показывается и вписывается как раньше
   (без форс-поворота, обычный letterbox).
2. ~~Свайп-прокрутка~~ — **сделано 28.09.2026 во всех трёх списках игры**: Сводка
   (`svod-scroll.js`, обе вкладки), магазин шмоток (`shmot_shop.js`), выбор боссов
   (`bosses_select.js`). Других прокручиваемых списков в игре нет (в `dvor-roulette-screen.js`
   слово `wheel` — это спрайт колеса рулетки, а не колесо мыши).
3. **Hover-состояния** (`pointerover/pointerout`, 128 мест) на тач-устройствах не имеют смысла и
   могут «залипать» — сейчас это только изменение alpha/подсказки, не блокер.

**`helper.onTap(obj, fn, threshold = 10)` — тап вместо `pointerdown` ВНУТРИ списков.** По всему
проекту клик это `pointerdown`, то есть действие срабатывает в момент КАСАНИЯ. Мышью незаметно,
пальцем фатально: свайп по списку всегда начинается с карточки, и она нажималась раньше, чем
игрок успевал сдвинуть палец — поэтому свайп-прокрутку нельзя было добавить в принципе. `onTap`
ждёт `pointerup` и срабатывает, только если палец не уехал дальше 10 логических пикселей.
Переводить на него ВСЁ подряд не нужно: кнопкам вне списков (выход, вкладки, стрелки скролла)
реакция на касание ощущается быстрее, и бага у них нет — они осознанно остались на `pointerdown`.

**Рецепт свайпа — если появится новый прокручиваемый список** (сделано 28.09.2026 в трёх):
1. Перевести обработчики элементов ВНУТРИ прокручиваемой области на `helper.onTap`. Без этого
   свайп невозможен в принципе — элемент срабатывает в момент касания.
2. Поймать старт протяжки. Два варианта, выбор зависит от того, есть ли на экране полноэкранный
   интерактивный blocker: если есть (`shmot_shop.js`, `bosses_select.js`) — вешать `pointerdown`
   прямо на `win` (событие и так доходит всплытием) и проверять `win.toLocal(e.data.global)` на
   попадание в прямоугольник списка; если нет (`svod-scroll.js`, скролл живёт в панели-контейнере)
   — добавить невидимый `PIXI.Graphics` через `addChildAt(surface, 0)`, то есть НИЖЕ содержимого,
   чтобы ловить протяжки в пустых местах и не перехватывать нажатия по карточкам.
3. `pointermove`/`pointerup`/`pointerupoutside` — ВСЕГДА на `root`, а не на самом объекте: палец
   во время протяжки почти всегда уезжает за его пределы.
4. Исключить бегунок и стрелки: `if(e.target === thumb) return;` — их нажатия всплывают туда же,
   и без проверки список поедет вдвое быстрее пальца (две прокрутки разом).
5. Снимать слушатели `root` при закрытии экрана — иначе они переживут его и будут дёргать скролл
   мёртвого списка при каждом движении пальца в любом месте игры. Функцию снятия хранить в
   ЛОКАЛЬНОЙ переменной, не на `this`, если экран может строить несколько скроллов сразу
   (в Сводке две вкладки строят два скролла на одном объекте — поле на `this` затёрлось бы).
6. Всё — под `if(window.isMobile)`: на десктопе остаётся колесо, drag мышью конфликтовал бы с
   привычным поведением и с перетаскиванием бегунка.

**Не уменьшать иконки шмоток** (`images/shmot/`, 58 файлов, 83 МБ RGBA) — проверено 28.09.2026 и
сознательно отклонено. У всех 62 записей каталога в `shmot.js` есть `cellScale` и `manScale`,
снятые вручную редактором позиций, и 10 регресс-тестов пиннят их точные значения
(`manScale:0.225` и т.п.). Уменьшение файлов потребовало бы пересчёта обеих констант у каждого
предмета и переписывания этих тестов — то есть уничтожило бы и ручную калибровку, и смысл
проверок, ради экономии, которую дешевле получить через WebP.

**WebP + кэш — главный рычаг по трафику, инструменты готовы, на сервер НЕ применено.**
`tools/make_webp.py` кладёт `файл.png.webp` рядом с каждым реально используемым PNG (782 файла,
171 МБ → 30 МБ, −82%); имена в коде не меняются вообще. `tools/nginx_images.conf` — блок для
nginx: подмена по заголовку `Accept` (не поддерживает WebP — отдаётся прежний PNG) плюс годовой
кэш вместо нынешнего `Cache-Control: no-cache` (сейчас браузер делает условный запрос на каждый
из 400+ файлов прелоада при КАЖДОМ запуске игры). Долгий кэш безопасен: `asset-version.js`
подставляет `?asset_v=<версия бандла>` ко всем URL картинок. Проверка после применения —
`bash tools/check_images_headers.sh`. Откат — убрать location-блок, файлы можно не трогать.

**Неиспользуемые картинки** — `UNUSED_IMAGES_28_09_2026.md`: 1762 PNG (197 МБ) не упоминаются
нигде в коде, из них 1580 (169 МБ) — это `images/layers/`, авторская нарезка слоёв для Adobe
Animate (встречается только в `img/all_layers.fla` и `import_to_animate.jsfl`), которой не место
в деплой-каталоге. Важно: на скорость у игроков это НЕ влияет — раз файлы никто не запрашивает,
в трафик они не попадают; выигрыш только в размере сервера и скорости синхронизации ассетов.

---

## Паттерн нового PIXI-экрана (оверлей)

Каждый новый экран строится строго по этому шаблону:

```js
_openXxxScreen(){
    if(!this._xxxWin) this._buildXxxScreen();
    root.layer2_mc.addChild(this._xxxWin);
    if(this._dvorWrap) this._dvorWrap.interactiveChildren = false;
    // обновить UI
    if(window.iface){
        if(iface.up)   root.layer2_mc.addChild(iface.up);
        if(iface.down) root.layer2_mc.addChild(iface.down);
    }
}

_buildXxxScreen(){
    const win = new PIXI.Container();
    win.interactive = true;

    // 1. Полноэкранный blocker (перехватывает клики за экраном)
    const blocker = new PIXI.Graphics();
    blocker.beginFill(0x000000, 0.001);
    blocker.drawRect(0, 0, 1280, 720);
    blocker.endFill();
    blocker.interactive = true;
    win.addChild(blocker);

    // 2. Фон
    const bg = new PIXI.Sprite(PIXI.Texture.from('./images/имя фона.png'));
    bg.width = 1280; bg.height = 690; bg.y = 15;
    win.addChild(bg);

    // 3. Кнопка выхода (стандартная позиция)
    const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
    exitBtn.scale.set(0.5);
    if(window.isMobile) helper.touchPad(exitBtn);   // зона нажатия под палец (см. «Адаптив»)
    exitBtn.x = 1240; exitBtn.y = 83;
    exitBtn.interactive = true; exitBtn.buttonMode = true;
    exitBtn.on('pointerover', ()=>{ exitBtn.alpha = 0.75; });
    exitBtn.on('pointerout',  ()=>{ exitBtn.alpha = 1; });
    exitBtn.on('pointerdown', ()=>this._closeXxxScreen());
    win.addChild(exitBtn);

    // 4. Контент...

    this._xxxWin = win;
}

_closeXxxScreen(){
    if(this._xxxWin && this._xxxWin.parent) this._xxxWin.parent.removeChild(this._xxxWin);
    if(this._dvorWrap){ this._dvorWrap.visible = true; this._dvorWrap.interactiveChildren = true; }
}
```

**Ключевые правила:**
- Blocker всегда первый child — иначе клики проходят сквозь экран
- HUD (`iface.up` / `iface.down`) добавлять поверх ПОСЛЕ `addChild(win)`
- Хранить ссылку в `this._xxxWin` — проверять `if(!this._xxxWin)` перед повторным открытием

---

## ⚠️ Коллизии имён файлов-ассетов (18.09.2026)

Перед копированием/загрузкой НОВОГО файла в `_client/development/images/` — сначала проверять
(`ls`/Glob), не существует ли уже файл с точно таким же именем. Это особенно важно для
универсальных/generic имён вида `иконка.png`, `шмотка.png`, `фон.png`, `1.png` — такие имена
получают исходники "из коробки" (экспорт из Photoshop даёт «Слой 10.png» и т.п.), и с ними
легко случайно переиспользовать чужое имя для другого предмета/экрана, из-за чего один ассет
тихо подменяет другой в совершенно другом, неожиданном месте игры.

**Правило:** всегда переименовывать входящие ассеты в НАМЕСПЕЙСИРОВАННОЕ имя с префиксом
фичи/экрана перед копированием в проект — например `боевка попап шмотка.png`, а не просто
`шмотка.png`; `сет ссср панама.png`, а не просто `панама.png`. Так коллизия физически
исключена, и по имени сразу видно, к какой фиче относится файл (см. пример — все ассеты
попапа результата боя названы `боевка попап *.png`). Если после проверки коллизия всё-таки
обнаружена — НЕ перезаписывать молча существующий файл, сообщить пользователю и предложить
альтернативное имя.

## ⚠️ ПРАВИЛО №10: ПИСАТЬ ТЕСТЫ НА КАЖДОЕ ИЗМЕНЕНИЕ, ПРОГОНЯТЬ — ТОЛЬКО ПЕРЕД ДЕПЛОЕМ

На каждое поведенческое изменение кода (не чисто позиционную правку x/y/scale — там тесты не
обязательны) — писать новый файл в `tests/*.test.js` либо расширять существующий подходящий
файл. Не пропускать этот шаг, даже если правка кажется мелкой или пользователь явно не попросил
тесты в этом конкретном сообщении — по умолчанию тесты пишутся всегда, раз в проекте так

**Исключение (27.09.2026, по прямому указанию — тривиальные числовые константы):** для чистой
замены значения числовой константы (лимит/размер страницы/размер пула — вроде
`ROWS_LIMIT_DEFAULT`, `ROWS_POOL`, `CARD_POOL`) НЕ нужен новый выделенный файл теста. Достаточно
обновить существующий assert, если он захардкожен на старое значение (проверить через grep по
самому числу/имени константы) — новый файл писать, только если такого assert’а ещё не было и
поведение прежде вообще не покрыто тестом. Если правка меняет не просто число, а логику вокруг
(например, от какого условия зависит лимит) — это уже не подпадает под исключение, действует
общее правило выше.
заведено с самого начала.

**23.09.2026 (по прямому указанию — расход токенов): прогонять тесты НЕ после каждой отдельной
правки.** Раньше после каждого файла тестов сразу шёл `node tests/<file>.test.js`, а после
каждой партии правок — полный `for f in tests/*.test.js; do node "$f"; done` (256+ файлов) —
дорого по токенам при частых правках за одну сессию. Новый порядок: писать/обновлять тесты по
ходу дела, но САМ прогон (и свежего файла, и всего `tests/`, и `node run_tests.js`) — один раз,
непосредственно **перед деплоем** (по команде «деплой»), чтобы поймать всё разом, а не после
каждого шага.

**23.09.2026 (повторное указание тем же днём — правило выше не соблюдалось, ассистент несколько
раз подряд прогонял `node run_tests.js`/индивидуальные файлы посередине запроса, не дожидаясь
«деплой»).** Это правило — не рекомендация, а жёсткое ограничение: НИ `node tests/<file>.test.js`
для только что написанного/изменённого теста, НИ тем более `node run_tests.js`/цикл по всем
`tests/*.test.js` не запускаются, пока пользователь буквально не написал слово «деплой» в чате.
Между «написать код» и «дождаться деплоя» тестовый прогон не нужен вообще — доверять написанному
тесту до момента общего прогона. Если очень нужно проверить синтаксис нового файла — можно
`node --check`, но не полный запуск теста.

### Тестовые образцы по стилю (чтобы не искать "похожий тест" перебором по tests/)

При написании нового теста — сначала сверить с этой таблицей, какой стиль подходит, вместо
поиска по каталогу (в `tests/` 468+ файлов, поиск "на глаз" дорог).

| Стиль | Пример файла | Когда применять |
|---|---|---|
| Простой regex/текстовый assert по содержимому PHP/JS-файла (константа, whitelist, SQL-условие) | `tests/hide-uid-from-leaderboards.test.js` | правка константы/условия, которое можно проверить как текст файла |
| Докблок с полным контекстом инцидента (репорт → корень → фикс) + Gameops-паттерн | `tests/casino-bag-tatu-shmot-server-authoritative.test.js` | миграция логики на сервер, нужно объяснить "было/стало" |
| Brace-scanner — ловит баг по СТРУКТУРЕ скобок/области видимости, а не по тексту | `tests/boss-result-shmot-hover-scope-crash-fix.test.js` | var-scope баги (`let`/`const` объявлен в одном блоке `if`/`for`, использован вне него) |
| Реальный запуск кода через `vm` + моки `PIXI`/`window` (проверяет поведение, не просто наличие строки) | `tests/boss-rating-audio-regressions.test.js` | нужно проверить, что функция реально делает при заданном состоянии, текстовый grep не поймает баг |

## ⚠️ ПРАВИЛО №5: ЗАГРУЗКА ИЗОБРАЖЕНИЙ С РУССКИМИ ИМЕНАМИ

Файлы с кириллицей в имени **нельзя** загружать напрямую — имя исказится на сервере и браузер не найдёт файл.

Использовать URL-кодирование через python3. Пароль root — см. `SECRETS_LOCAL.md` (28.09.2026:
вынесен из этого файла, т.к. `CLAUDE.md` коммитится в GitHub) — подставить вместо `$SSH_PASS`:

```bash
# Из директории: C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat

ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "имя файла.png")
curl --insecure -u "root:$SSH_PASS" -T "_client/development/images/имя файла.png" "sftp://155.212.211.202/var/www/stalker/client/ver0_41/images/$ENCODED"
```

Для нескольких файлов — цикл:

```bash
for f in "файл1.png" "файл2.png"; do
  ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$f")
  curl --insecure -u "root:$SSH_PASS" -T "_client/development/images/$f" "sftp://155.212.211.202/var/www/stalker/client/ver0_41/images/$ENCODED" -s && echo "OK: $f"
done
```

### ⚠️ Картинки — ТОЛЬКО в `/var/www/stalker/client/ver0_41/images/`, без `/development/`

18.09.2026: обнаружен баг, копившийся несколько дней — несколько новых карточек локаций Зоны
(`кордон.png`, `свалка.png`, `Агропром.png`) и файл рамки (`рамка уважение.png`) были обновлены
только в `_client/development/images/` (локальная папка-источник) и НИКОГДА не долетели до
`/var/www/stalker/client/ver0_41/images/` — а именно оттуда живая игра (`m.vk.ru/games/app...`)
реально грузит текстуры, не из `/development/images/`. Итог — игрок видел старые/битые картинки
несколько дней, хотя "по коду всё было готово".

**Правила, чтобы не повторилось:**
1. `_client/development/images/` — только источник для копирования, НЕ цель деплоя сама по себе.
   Единственный путь, который видит реальный игрок — `/var/www/stalker/client/ver0_41/images/`
   (без `/development/`). Не заливать картинки в `/development/images/` "на всякий случай" —
   это создаёт иллюзию, что ассет обновлён, хотя прод всё ещё отдаёт старый файл.
2. После каждой заливки картинки — **обязательно проверять размер (или MD5) локального и
   серверного файла** (`os.path.getsize` / `sftp.stat().st_size` через paramiko, см. пример
   ниже), не полагаться только на "успешно загружено" от curl/upload.sh.
3. Если меняешь несколько файлов одной "партии" (например, все 5 карточек локаций разом) —
   сверять ВСЕ файлы партии целиком, а не только те, о которых пользователь прямо спросил:
   баг выше нашёлся именно потому, что 2 файла из 5 (долина/янтарь) залили, а 3 — забыли.
4. Проверка существования файла на сервере через `sftp.listdir()`/`ls` с кириллицей в имени
   может падать с `UnicodeDecodeError` или молча портить символы (не только при заливке —
   ПРАВИЛО №5 выше уже предупреждает про заливку, но то же самое верно и для ЧТЕНИЯ листинга).
   Надёжный способ проверить один конкретный файл — `sftp.stat(exact_unicode_path)` или
   `test -f` через SSH с именем, переданным через `base64` (обходит проблемы кодировки канала).

```python
# Пример: заливка с проверкой размера (предпочтительный способ вместо curl для батча файлов)
# Пароль root — см. SECRETS_LOCAL.md (не коммитится, в отличие от этого файла)
import paramiko, os
transport = paramiko.Transport(("155.212.211.202", 22))
transport.connect(username="root", password=SSH_PASS)
sftp = paramiko.SFTPClient.from_transport(transport)
for fname in ["кордон.png", "свалка.png"]:
    local = f"_client/development/images/{fname}"
    remote = f"/var/www/stalker/client/ver0_41/images/{fname}"
    sftp.put(local, remote)
    ok = sftp.stat(remote).st_size == os.path.getsize(local)
    print(fname, "OK" if ok else "SIZE MISMATCH!")
sftp.close(); transport.close()
```

ASCII-имена (латиница) — можно через upload.sh напрямую.

### ⚠️ Топология сервера — проверено вживую (23.09.2026)

При сомнении "а вдруг сервер реально берёт файлы из другой папки" — не гадать, проверять так:

```bash
cat /etc/nginx/sites-enabled/stalker   # активный конфиг (sites-enabled/stalker.bak — НЕ активен, это старая копия)
```

Подтверждено на 23.09.2026:
- `root /var/www/stalker;` — **без rewrite** (`try_files $uri $uri/ =404;`), т.е. URL маппится на диск
  1-в-1: `pripyat-game.ru/client/ver0_41/images/shmot/файл.png` ⇔
  `/var/www/stalker/client/ver0_41/images/shmot/файл.png`. Это подтверждает правило выше
  ("Картинки — ТОЛЬКО в `.../images/`, без `/development/`") независимым способом (не только
  по прошлому инциденту, но и по факту конфигурации веб-сервера).
- PNG/JPG и т.п. отдаются с `Cache-Control: no-cache, no-store, must-revalidate` — обновлённый
  файл виден игроку сразу, без ожидания протухания CDN/браузерного кэша.
- **`/var/www/stalker/shmot/`** (НЕ `client/ver0_41/...`, отдельная папка прямо в корне) —
  существует, но **пустая** (0 файлов, не менялась с 23 августа) — мёртвый остаток, ничего
  оттуда не раздаётся. Не путать с `client/ver0_41/images/shmot/` при поиске/диагностике.
- `/var/www/stalker/index.html` (в корне, título "Припять: Тест") и `/var/www/stalker/stalker/`
  (вложенная копия `server/` с `adm_tmp.php`/`adm2.php`/`adm_add_bullets.php`) — тоже существуют
  на диске, оба вне активного `root` конфига (`root` = `/var/www/stalker`, значит формально
  ДОСТУПНЫ по `pripyat-game.ru/index.html` и `pripyat-game.ru/stalker/...`), но не используются
  штатным деплоем (`upload.sh`/CLAUDE.md workflow целится только в `client/ver0_41/...`) — судя
  по всему, старые/тестовые остатки, не трогать и не путать с рабочими путями.

Быстрая проверка "что реально видит игрок" для одного файла (без скачивания):
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://pripyat-game.ru/client/ver0_41/images/shmot/ИМЯФАЙЛА.png"
```

---

## Поля udata (полный список)

| Ключ | Тип DB | Назначение |
|---|---|---|
| `coins` | VARCHAR(64) | Рубли |
| `cigarettes` | VARCHAR(64) | Сигареты |
| `stew` | VARCHAR(64) | Тушёнка (донат) |
| `stew_spent` | VARCHAR(64) | Потрачено тушёнки (статистика) |
| `exp` | VARCHAR(64) | Опыт персонажа |
| `energy` | VARCHAR(64) | Текущая энергия |
| `max_energy` | VARCHAR(64) | Макс. энергия (базово 50) |
| `respect` | VARCHAR(64) | Авторитет |
| `ammo_auto` | VARCHAR(64) | Патроны к автомату |
| `ammo_gun` | VARCHAR(64) | Патроны к стволу |
| `ammo_machete` | VARCHAR(64) | Заряды мачете |
| `poker_chips` | VARCHAR(64) | Фишки покера |
| `poker_spichki` | VARCHAR(64) | Спички покера |
| `roulette_spichki` | VARCHAR(64) | Спички рулетки |
| `blue_points` | VARCHAR(64) | Синие поинты (рулетка) |
| `dice_points` | VARCHAR(64) | Поинты зариков (донат item24-29) |
| `roulette_winner` | VARCHAR(255) | JSON последнего победителя рулетки |
| `habar_counts` | VARCHAR(64) | Количество заначек |
| `dvor_games` | VARCHAR(64) | Счётчик всех игр в казино |
| `dvor_games_data` | TEXT | JSON: exp/pity/jack по каждой игре |
| `dvor_daily` | TEXT | JSON: дневные лимиты (покер/карты/кости) |
| `dvor_daily_sigs` | TEXT | JSON: собранные сигареты во дворе |
| `nickname` | VARCHAR(64) | Ник игрока |

---

## Схема VK item-номеров (донат)

```
item0  – item7   → Тушёнка  (stew)      — 8 пакетов
item8  – item15  → Монеты   (coins)     — 8 пакетов
item16 – item23  → Сигареты (cigarettes)— 8 пакетов
item24 – item29  → Поинты зариков (dice_points)   — 6 пакетов: 10/25/55/115/250/550
item30 – item35  → Синие поинты рулетки (blue_points) — 6 пакетов: 10/25/55/115/250/550
item100 – item107 → Энергия (energy)   — 8 пакетов: 50/110/180/400/850/1300/2000/3500
```

Следующий свободный диапазон: **item36–item99** (для будущих донат-товаров).

Обработка в `bank.js` → метод `successDonat()`. При добавлении нового диапазона — дописать туда `if(itemNum >= X && itemNum <= Y){ ... }`.

---

## Spine-анимации боссов

**Две папки — не путать:**
| Папка | Путь локально | Путь на сервере | Назначение |
|---|---|---|---|
| Боссы | `_client/development/images/spine/` | `/client/ver0_41/development/images/spine/` и `/client/ver0_41/images/spine/` | Анимации боссов (spine-boss.js) |
| Прелоадер | `_client/development/spine/` | `/client/ver0_41/development/spine/` | Анимация загрузчика (preloader FLA) |

**Код:** `spine-boss.js` → `SPINE_DIR = './images/spine/'` — именно эта папка.

**Три файла на одного босса:**
- `имя.json` — анимационные данные (кости, слоты, тайминги)
- `имя.atlas` — координаты регионов текстуры; **строка 1** = имя `.webp`-файла
- `имяX.webp` — текстура (имя совпадает со строкой 1 атласа)

**Правило `tex`:** НЕ добавлять `tex:` в конфиг `BOSS_SPINE`. Имя текстуры читается автоматически из `atlas.pages[0].name` — это строка 1 `.atlas`-файла. Пример: если в атласе написано `okhotnik1.webp`, код сам загрузит этот файл.

**Добавление анимации нового босса:**
1. Получить от художника: `.json`, `.atlas`, `.webp`
2. Скопировать в `_client/development/images/spine/`
3. В `spine-boss.js::BOSS_SPINE` добавить (без `tex:`):
   ```js
   { atlas: 'имя.atlas', json: 'имя.json', x: 640, y: 650, scale: 0.40, anim: 'animation' }
   ```
4. Деплой — загрузить 3 файла в **ОБА** пути:
   ```bash
   bash upload.sh "_client/development/images/spine/имя.json"   "/client/ver0_41/development/images/spine/имя.json"
   bash upload.sh "_client/development/images/spine/имя.atlas"  "/client/ver0_41/development/images/spine/имя.atlas"
   bash upload.sh "_client/development/images/spine/имяX.webp"  "/client/ver0_41/development/images/spine/имяX.webp"
   # И то же самое без /development/:
   bash upload.sh "_client/development/images/spine/имя.json"   "/client/ver0_41/images/spine/имя.json"
   # ... и т.д.
   ```

---

## Известные баги / TODO

- **Попап ошибки при выходе из Двора** (server error popup): нужно заменить на `popap_nagrada.png` из `C:\Users\HONOR\Desktop\vk_game`. Файл-обработчик ошибок — искать в `dvor.js` или `interface.js` по `_openSidorovichError` / `ServerError` / `error`.

---

## Краткая выжимка ТЗ (для быстрой сверки)

**Валюты:** Рубли (`coins`), Сигареты (`cigarettes`), Тушёнка (`stew`, донат/премиум)  
**Энергия:** лимит 50, регенерация 1 ед/5 мин  
**Старт:** 1к сигарет, 10 рублей, 0 тушёнки, 0 опыта, уровень 1  
**Уровни:** 0→1 = 40 опыта, каждый следующий +40 к порогу (накопительно)

**Локации (5):** Рубеж→Отстойник→Глухая Лощина→Промзона→Очаг  
6 точек × 5 ячеек, энергия за ячейку по ТЗ стр.15-16, награды: сигареты + опыт

**Боссы (8):** Охотник(1к)→Счастливчик(10к)→Ястреб(50к)→Меченный(100к)→Крыс(500к)→Баркут(2кк)→Борода(3кк)→Жгут(30кк)  
Ключевая система, награды: сигареты

**Оружие:** нож(5)/цепь(12)/бита(20) бесплатно; мачете(40)/ствол(50)/автомат(200) за тушёнку  
**Бизнес:** 10 уровней за сигареты  
**Бател-пасс:** 500 уровней, обычный/премиум 100г, концепция от "хуликов"

---

## ⚡ Правила скорости и эффективности

### Позиционные правки (x, y, scale, размеры)
- ВСЕ изменения к одному файлу — один Python-скрипт, один вызов
- Если нужно найти текущее значение — один grep для всех неизвестных сразу
- Не делать grep до/после для "проверки" — доверять результату
- Подтвердить одной строкой: "✓ N правок применено"

```python
with open('path/file.js', 'r', encoding='utf-8') as f: src = f.read()
for old, new in [('old1','new1'), ('old2','new2')]:
    if old not in src: print(f'NOT FOUND: {old[:50]}')
    else: src = src.replace(old, new)
with open('path/file.js', 'w', encoding='utf-8') as f: f.write(src)
```

### Несколько файлов одновременно
- Правки в разные файлы — параллельные вызовы, не по очереди
- Копирование + grep + чтение независимых файлов — всё параллельно

### Не читать файл если он уже в контексте
- Если файл читался в этой сессии и не менялся с тех пор — не перечитывать
- После /compact сессии — читать только нужные части (grep/sed -n), не весь файл

### Не спрашивать очевидное
- Позиционные правки применять сразу без уточнений
- "сдвинь вправо на 10" = x += 10, применить немедленно
- Уточнять только если файл неизвестен или правка неоднозначна

### Спрашивать, если что-то непонятно
- Если в промпте (тексте, а не позиционной правке) есть неоднозначность, неизвестный термин,
  противоречие с ранее сказанным, или неясно, к какому именно объекту/файлу относится
  запрос — сразу задавать уточняющий вопрос, а не гадать и применять правку наугад
- Это НЕ отменяет правило выше про позиционные правки (x/y/scale по явным числам —
  применять сразу); касается смысловых/поведенческих запросов и неоднозначных ссылок
  на объекты («это исправь», «та штука», непонятное сокращение и т.п.)
- Лучше один короткий вопрос сейчас, чем правка не туда и повторная переделка

### Изображения (копирование + FTP)
- Copy из Desktop + FTP upload — один bash-скрипт, не два отдельных шага
- Несколько картинок — один цикл, не отдельная команда на каждую

### Ответы
- Говорить и отвечать ТОЛЬКО на русском языке — во всех сообщениях, без исключений
- Не пересказывать что сделано построчно
- Не писать "Теперь применяю...", "Далее сделаю..." — просто делать
- Итог: одна строка что сделано, следующий шаг если есть

---

## 🗺️ Словарь элементов (твои названия → переменные в коде)

Используй этот словарь чтобы не искать переменные grep-ом.

### game/dvor.js — Лобби двора
| Что говорит пользователь | Переменная / метод | Примечание |
|---|---|---|
| облака / кучки сигарет (4 шт.) | `this._cigSprites[]` | 4 PIXI.Sprite на карте двора |
| плавающий текст «+30» при сборе | `_showFloatingCig(x, y)` | Container(Text + Sprite), анимируется через rAF |
| плавающий текст другой | `_showFloatingText(x, y, text)` | обычный PIXI.Text |
| кнопка «рулетка» (вкладка) | `this._roulTab` | x, y |
| кнопка «зарики» (вкладка) | `this._diceTab` | x, y |
| кнопка «покер» (вкладка) | `this._pokerTab` | x, y |
| кнопка «блэкджек» (вкладка) | `this._bjTab` | x, y |

### dvor/dvor-roulette-screen.js + dvor-roulette.js — Рулетка
| Что говорит пользователь | Переменная | Позиция / Примечание |
|---|---|---|
| колесо рулетки | `this._roulWheelSpr` | x=541, y=322, w=370, h=363 |
| стрелка-указатель | `this._roulArrowSpr` | x=712, y=323, rotation в rad |
| сумма джекпота | `this._roulJackTxt` | x=846, y=227, жёлтый |
| ник победителя | `this._roulWinnerNameTxt` | x=830, y=293 |
| сумма победителя | `this._roulWinnerAmtTxt` | x=872, y=328, жёлтый |
| синих поинтов (счётчик) | `this._roulPtsTxt` | x=822, y=384, голубой |
| кнопка + / купить поинты | `buyPlusBtn` | x=916, y=376 |
| счётчик спичек «N СПИЧЕК» | `this._roulSpichTxt` | x=791, y=438, голубой |
| кнопка КРУТИТЬ | `this._roulSpinBtn` | x=848, y=507 |
| кнопка открыть кейс | `openBtn` | x=686, y=518 |
| авто-галочка (чекбокс) | `this._roulAutoCheckbox` | x=894, y=547, scale=0.5 |
| галочка (тик авто) | `this._roulAutoTick` | рядом с autoCheckbox |
| текст результата крутки | `this._roulResultTxt` | x=548, y=555, якорь center |
| вертикальная XP-полоска | `this._roulLvlBarFill` | TRACK_X=977, top=125, W=23, H_max=407 |
| уровень (правый верх) | `this._roulLvlTxt` | x=988, y=111 |
| следующий уровень (низ) | `this._roulNextLvlTxt` | x=988, y=552 |
| карточки покупки поинтов | `PKG_COLS` / `PKG_ROWS` (roul-buy) | в dvor-roulette-buy.js |
| список призов колеса | `SLOTS[16]` | idx 0=ключи (не выпадает), idx 13=СУПЕРПРИЗ |

### dvor/dvor-dice-screen.js + dvor-dice.js — Зарики
| Что говорит пользователь | Переменная | Позиция / Примечание |
|---|---|---|
| уровень (слева, XP-бар) | `this._diceLevelTxt` | x=345, y=111, белый |
| следующий уровень (справа) | `this._diceNextLvlTxt` | x=939, y=110, белый |
| горизонтальная XP-полоска | `this._diceExpBarFill` | y=95, x=375, w_max=523, h=28 |
| доступные перебросы | `this._diceAvailTxt` | x=811, y=142, жёлтый |
| поинты зарики (красные) | `this._dicePointsTxt` | x=195, y=434, красный |
| кнопка «купить поинты» | `buyBtn` | x=195, y=526 |
| кубики — спрайты (×4) | `this._diceDiceSprites[]` | DICE_POSITIONS: x=438/544/650/756, y=318 |
| кубики — числа (×4) | `this._diceDiceTexts[]` | поверх спрайтов |
| рамки выбора кубиков (×4) | `this._diceDiceBorders[]` | жёлтые, visible=false по умолчанию |
| хит-зоны кубиков (×4) | `this._diceDiceHits[]` | invisible, toggleDiceSwap(i) |
| текст результата броска | `this._diceResultTxt` | x=625, y=580, белый |
| «бесплатно через» таймер | `this._diceTimerTxt` | x=595, y=461, серый |
| кнопка БРОСИТЬ | `this._diceThrowBtn` | x=604, y=523 |
| кнопка ПЕРЕБРОСИТЬ / ПОДТВЕРДИТЬ | `this._diceConfirmBtn` | x=604, y=523, Graphics (совпадает с БРОСИТЬ — они взаимоисключающие) |
| надпись на кнопке перебросить | `this._diceConfirmLbl` | PIXI.Text внутри confirmBtn |
| карточки покупки поинтов (зарики) | `PKG_COLS` / `PKG_ROWS` | PKG_COLS:{548,689,832}, PKG_ROWS:{324,498} |
| таблица комбинаций | `TABLE[18]` | в dvor-dice-game.js |

### dvor/dvor-blackjack.js — Блэкджек
| Что говорит пользователь | Переменная | Примечание |
|---|---|---|
| уровень | `this._bjLevelTxt` | леввый верх |
| монеты / ставка | `this._bjCoinsTxt` | число монет |
| «Смен: 0/N» | `this._bjSwapsTxt` | счётчик смен карт |
| карты (5 шт.) | `this._bjCardSprites[]` | спрайты карт |
| иконка сигарет | `this._bjCigSpr` | x=598, y=497, scale=0.09 |
| результат | `this._bjResultTxt` | x=613, y=497 |
| кнопка ИГРАТЬ | `this._bjPlayBtn` | y≈544 |
| кнопка ГОТОВО | `this._bjDoneBtn` | Graphics-кнопка |
| ценник / монета на кнопке | `this._bjPriceSpr` | y≈552 |

### dvor/dvor-poker.js — Покер
| Что говорит пользователь | Переменная | Примечание |
|---|---|---|
| фон покера | `bg` | height, y |
| иконки уровней (20/60/100) | `icon` (в цикле levels) | scale |
| уровень покера | `this._pokerLevelTxt` | x |
| XP-полоска покера | `this._pokerExpBarFill` | Graphics |
| карты (5 шт.) | `this._pokerCardSprites[]` | спрайты |
| рамки карт (5 шт.) | `this._pokerCardBorders[]` | выбранные |
| масти / тексты мастей | `this._pokerSuitTexts[]` | |
| кнопки обмена / swap | `this._pokerSwapBtns[]` | scale |
| результат покера | `this._pokerResultTxt` | |
| «Смен: 0/3» | `this._pokerSwapsTxt` | spTxt в коде |
| чипсы | `this._pokerChipsTxt` | |
| спички покера | `this._pokerSpichkiTxt` | |
| попыток / трай | `this._pokerTriesTxt` | |
| кнопка ИГРАТЬ x1 | `this._pokerPlayBtn1` | |
| кнопка ИГРАТЬ x5 | `this._pokerPlayBtn5` | |
| кнопка РАЗДАТЬ | `this._pokerDealBtn` | |
| кнопка открыть сумку | `openBtn` (bag screen) | x, y |
| кнопка рюкзак / bag | `bagBtn` | x, y |

### shell/overlays/bosses_fight.js — Бой с боссами
| Что говорит пользователь | Переменная | Примечание |
|---|---|---|
| весь экран боя | `this._bossFightWin` | PIXI.Container |
| имя босса | `this._bossFightNameTxt` | Text |
| полоска HP | `this._bossFightHpBar` | Graphics, w_max=250 |
| «X / Y» HP | `this._bossFightHpTxt` | Text |
| таймер перезарядки | `this._bossFightTimerTxt` | Text |
| спрайты оружий | `this._bossFightWpnSprs[]` | массив Sprite |
| кнопка Сидорович | `this._bossFightSidBtn` | |
| кнопка Заначка | `this._bossFightHabarBtn` | |
| прогресс навыков | `this._bossFightProgBar` | Graphics, w_max=287 |
| текст прогресса | `this._bossFightProgTxt` | |
| очки навыков | `this._bossFightPtsTxt` | |
| следующий порог | `this._bossFightNewTxt` | |
| попап «нет оружия» | `this._noWpnWin` | отдельный Container |

### shell/overlays/bosses_select.js — Выбор боссов
| Что говорит пользователь | Переменная | Свойства |
|---|---|---|
| кнопка выход (боссы) | `exitBtn` | x, y |
| лимит убийств / X/7 | `dailyTxt` | x, y |
| счётчик убитых | `killedTxt` | x, y |

### shell/overlays/sidorovich.js — Сидорович
| Что говорит пользователь | Переменная | Свойства |
|---|---|---|
| рюкзак / сумка (хит-зона) | `bagHit` | drawRect height |
| выход (сидорович) | `exitBtn` | x, y |

### shell/overlays/zone_screen.js — Зона
| Что говорит пользователь | Переменная | Свойства |
|---|---|---|
| кнопка собрать прибыль | `btnCollect` | x, y, visible |
| таймер до сбора | `timerLbl` | x, y |
| выход (зона) | `exitBtn` | x, y |

### game/interface.js — HUD
| Что говорит пользователь | Переменная | Примечание |
|---|---|---|
| верхняя панель HUD | `iface.up` | |
| нижняя панель HUD | `iface.down` | |
| тушёнка (HUD) | `iface.up.val_stew.tf_txt` | PIXI.Text |
| монеты (HUD) | `iface.up.val_coins.tf_txt` | PIXI.Text |
| сигареты (HUD) | `iface.up.val_cigarettes.tf_txt` | PIXI.Text |

### weapons.js — Оружие
| Что говорит пользователь | Переменная | Свойства |
|---|---|---|
| количество мачете | `stockX`, `stockY` (мачете) | числа в массиве |
| количество пистолета | `stockX`, `stockY` (пистолет) | числа в массиве |
| урон автомата | `dmgX`, `dmgY` | числа в массиве |
| количество автомата | `stockX`, `stockY` (автомат) | числа в массиве |

---

## 🔑 Карта udata (ключи данных игрока)

`udata` — глобальный объект, значения всегда строки. Парсить через `parseInt()` / `JSON.parse()`.

### Валюта и ресурсы
| Ключ | Что хранит |
|---|---|
| `udata['coins']` | монеты (рубли в игре) |
| `udata['cigarettes']` | сигареты |
| `udata['stew']` | тушёнка |
| `udata['energy']` | текущая энергия |
| `udata['max_energy']` | максимум энергии |
| `udata['health']` | здоровье |
| `udata['bullets']` | пули |
| `udata['blue_points']` | синие поинты (для рулетки) |
| `udata['dice_points']` | поинты зарики |
| `udata['poker_chips']` | чипсы покера |
| `udata['poker_spichki']` | спички покера |
| `udata['roulette_spichki']` | спички рулетки |
| `udata['respect']` | уважение |
| `udata['boss_keys']` | ключи от боссов |

### Прогресс персонажа
| Ключ | Что хранит |
|---|---|
| `udata['exp']` | опыт |
| `udata['level']` | уровень персонажа |
| `udata['skill_points']` | очки навыков |
| `udata['skills_data']` | JSON — данные навыков |
| `udata['total_damage']` | суммарный урон по боссам |
| `udata['solo_kills']` | соло-убийства боссов |
| `udata['speed_kills']` | быстрые убийства |
| `udata['days_played']` | дней в игре |
| `udata['create_time']` | timestamp создания аккаунта |

### Имя / профиль
| Ключ | Что хранит |
|---|---|
| `udata['nickname']` | ник игрока (основной, используется в коде) |
| `udata['nick']` | ник (алиас, от VK) |
| `udata['name']` | имя (от VK) |

### Оружие
| Ключ | Что хранит |
|---|---|
| `udata['weapons']` | JSON — массив оружий (unlocked/equipped) |
| `udata['machete_count']` | количество мачете |
| `udata['gun_count']` | количество пистолетов |
| `udata['auto_count']` | количество автоматов |
| `udata['ammo_machete']` | патроны к мачете |
| `udata['ammo_gun']` | патроны к пистолету |
| `udata['ammo_auto']` | патроны к автомату |

### Двор — игры
| Ключ | Что хранит |
|---|---|
| `udata['dvor_daily']` | timestamp ежедневного кулдауна двора |
| `udata['dvor_daily_sigs']` | собранные сигареты за день |
| `udata['dvor_games']` | кол-во игр во дворе всего |
| `udata['dvor_games_data']` | JSON — детали игр двора |
| `udata['roulette_games']` | кол-во прокруток рулетки |
| `udata['roulette_winner']` | JSON — последний победитель джекпота `{name, amount}` |
| `udata['dice_games']` | кол-во бросков зарики |
| `udata['dice_free_ts']` | timestamp бесплатного броска зарики |
| `udata['bj_games']` | кол-во игр в блэкджек |
| `udata['poker_games']` | кол-во игр в покер |
| `udata['poker_combos']` | JSON — комбинации покера |
| `udata['cards_games']` | кол-во карточных игр |
| `udata['cards_combos']` | JSON — комбинации карт |

### Боссы
| Ключ | Что хранит |
|---|---|
| `udata['bosses_data']` | JSON — данные по боссам (прогресс, убийства) |
| `udata['bosses_killed']` | суммарно убитых боссов |
| `udata['zone_fights']` | боёв в зоне |

### Энергия / таймеры
| Ключ | Что хранит |
|---|---|
| `udata['energy_time']` | timestamp восполнения энергии |
| `udata['energy_spent']` | потрачено энергии всего |
| `udata['coins_earned']` | заработано монет всего |
| `udata['stew_spent']` | потрачено тушёнки всего |
| `udata['train_count']` | кол-во тренировок |

### База / имущество
| Ключ | Что хранит |
|---|---|
| `udata['base_buildings']` | JSON — постройки базы |
| `udata['base_location']` | текущая локация базы |
| `udata['base_bg_active']` | активный фон базы |
| `udata['base_bg_owned']` | купленные фоны базы |
| `udata['base_stats']` | JSON — статы базы |
| `udata['inventory']` | JSON — инвентарь |
| `udata['shmot']` | JSON — шмотки (одежда/броня) |
| `udata['tatu']` | татуировки |
| `udata['stash_data']` | JSON — тайник |
| `udata['hata_progress']` | прогресс хаты |

### Торговцы / магазины
| Ключ | Что хранит |
|---|---|
| `udata['habar_bought']` | куплено в хабаре |
| `udata['habar_counts']` | счётчики позиций хабара |
| `udata['hapuga_avail']` | доступные товары хапуги |
| `udata['hapuga_items']` | JSON — позиции хапуги |
| `udata['hapuga_next_ts']` | timestamp следующего сброса хапуги |
| `udata['hapuga_refreshes']` | кол-во сбросов хапуги |
| `udata['hapuga_sold']` | продано в хапуге |
| `udata['vassilich_buys']` | покупки у Василича |

### Боевой пропуск / задания
| Ключ | Что хранит |
|---|---|
| `udata['bp_level']` | уровень боевого пропуска |
| `udata['bp_xp']` | XP боевого пропуска |
| `udata['bp_xp_next']` | порог следующего уровня BP |
| `udata['bp_claimed']` | JSON — полученные награды BP |
| `udata['svod_claimed']` | JSON — полученные награды свода |
| `udata['zadaniya']` | JSON — задания |
| `udata['zadaniya_day']` | JSON — ежедневные задания |
| `udata['achievements']` | JSON — ачивки |
| `udata['achievement_stars']` | звёзды ачивок |
| `udata['ach_score']` | очки ачивок |

### Группировки / прочее
| Ключ | Что хранит |
|---|---|
| `udata['gang_id']` | ID группировки игрока |
| `udata['gang_data']` | JSON — данные группировки |
| `udata['zone']` | JSON — данные зоны |
| `udata['bot_running']` | бот запущен (bool-строка) |
| `udata['bot_settings']` | JSON — настройки бота |

---

## 📁 Карта файлов (кто за что отвечает)

### Точки входа
| Файл | Роль |
|---|---|
| `src/index.js` | точка входа, инициализация VK Bridge и приложения |
| `src/index/load-sequence.js` | последовательность загрузки ресурсов |
| `src/game/game-boot.js` | старт игры, создание сцены PIXI |

### Модули (src/modules/)
| Файл | Роль |
|---|---|
| `modules/server.js` | запросы к серверу: save/load udata |
| `modules/module_control.js` | управление модулями игры |
| `modules/patch.js` | патчи / хотфиксы данных при входе |
| `modules/timers.js` | глобальные таймеры |
| `modules/universal_helper.js` | утилиты (_sa, _setTxt, _rand и т.п.) |

### Интерфейс
| Файл | Роль |
|---|---|
| `game/interface.js` | HUD (верхняя + нижняя панели), updateUp/updateDown |
| `game/interface/interface-panels.js` | построение панелей HUD |

### Двор (game/dvor/)
| Файл | Роль |
|---|---|
| `game/dvor.js` | главный класс Двора: лобби, облака сигарет, вкладки |
| `dvor/dvor-roulette.js` | оркестратор рулетки (open/close/spin/updateUI) |
| `dvor/dvor-roulette-screen.js` | построение экрана + анимация колеса (_animRouletteWheel) |
| `dvor/dvor-roulette-buy.js` | экран покупки поинтов для рулетки |
| `dvor/dvor-roulette-spin.js` | ⚠️ МЁРТВЫЙ КОД — не импортируется нигде |
| `dvor/dvor-dice.js` | оркестратор зарики (open/close/play/updateUI) |
| `dvor/dvor-dice-screen.js` | построение экрана зарики + экран покупки поинтов |
| `dvor/dvor-dice-game.js` | логика броска кубиков (TABLE[18] комбинаций) |
| `dvor/dvor-poker.js` | оркестратор покера |
| `dvor/dvor-poker-screen.js` | построение экрана покера |
| `dvor/dvor-poker-game.js` | логика покерных комбинаций |
| `dvor/dvor-poker-bag.js` | экран рюкзака в покере |
| `dvor/dvor-blackjack.js` | блэкджек: экран + оркестратор |
| `dvor/dvor-blackjack-game.js` | логика блэкджека (hit/stand/bust) |
| `dvor/dvor-cards.js` | утилиты карт: колода, сдача, значения |

### Боссы (game/bosses/ + overlays)
| Файл | Роль |
|---|---|
| `game/bosses.js` | главный класс боссов |
| `game/bosses/bosses-combat.js` | логика боя (урон, HP, таймеры) |
| `overlays/bosses_select.js` | экран выбора босса |
| `overlays/bosses_prefight.js` | экран перед боем (выбор оружия) |
| `overlays/bosses_fight.js` | экран боя с боссом |
| `overlays/bosses_skills.js` | экран навыков боссов |
| `overlays/spine-boss.js` | Spine-анимация модели босса |

### Оверлеи / магазины
| Файл | Роль |
|---|---|
| `overlays/sidorovich.js` | магазин Сидорович |
| `overlays/zone_screen.js` | экран Зоны (таймер, сбор прибыли) |
| `overlays/ryukzak.js` | рюкзак игрока |
| `overlays/shmot_shop.js` | магазин шмоток |
| `overlays/yashik.js` | ящик (лутбокс) |
| `overlays/hata.js` | хата игрока |
| `overlays/dev_panel.js` | панель разработчика (читы/отладка) |

### Попапы (shell/popups/)
| Файл | Роль |
|---|---|
| `popups/reward.js` | попап награды (иконка + количество) |
| `popups/level_up.js` | попап повышения уровня |
| `popups/confirm.js` | попап подтверждения действия |
| `popups/currency.js` | попап покупки валюты |
| `popups/energy_buy.js` | попап покупки энергии |
| `popups/nick.js` | попап ввода никнейма |
| `popups/sound.js` | попап звука |
| `game/shell/ui_kit.js` | общие UI-компоненты |

### Прочие системы
| Файл | Роль |
|---|---|
| `game/achievements.js` | система достижений |
| `game/bank.js` | банк (покупка валюты) |
| `game/base.js` | база игрока |
| `game/battlepass.js` | боевой пропуск |
| `game/bot.js` | бот-режим (авто-фарм) |
| `game/gangs.js` | группировки |
| `game/habar.js` | хабар (барахолка) |
| `game/hapuga.js` | хапуга (рандомный магазин) |
| `game/home.js` | главный экран / хаб |
| `game/notifications.js` | push-уведомления |
| `game/shmot.js` | система шмоток |
| `game/skills.js` | система навыков |
| `game/svod.js` | свод (ежедневные награды) |
| `game/top.js` | топ игроков |
| `game/vassilich.js` | Василич (торговец) |
| `game/weapons.js` | система оружия |
| `game/zadaniya.js` | задания |
| `game/zone.js` + `zone/zone-biz.js` | Зона: логика + бизнес |
| `game/debug-tools.js` | инструменты отладки |
| `game/preloader.js` | прелоадер ресурсов |

### Серверные контроллеры (server/core/controllers/)

Большинство совпадают по имени с клиентским `game/*.js`-модулем того же смысла (например
`top.php` ↔ `top.js`, `shmot.php` ↔ `shmot.js`) — в таблице указано только там, где это
неочевидно, плюс статус миграции на server-authoritative паттерн (`Gameops`, см. правило №9).

| Файл | Роль | Gameops |
|---|---|---|
| `achievements.php` | достижения — generic-движок `AchievementEngine` (`statPath>=threshold`) вместо JS-лямбд | своя схема, мигрировано 23.09 |
| `base.php` | база игрока | ✅ |
| `blackjack.php` | блэкджек | ✅ |
| `bosses.php` | боссы, `startFight`/`claimKill` — **эталонный пример** Gameops-паттерна | ✅ |
| `bp.php` | боевой пропуск | ✅ |
| `dice.php` | зарики | ✅ |
| `dvor.php` | сбор сигарет во дворе (кулдаун 30 мин/облачко) | server-authoritative, вне общего списка 19 |
| `event.php` | сезонные события | ⚠️ старый паттерн, НЕ мигрирован |
| `gangs.php` | группировки | ✅ |
| `habar.php` | хабар/заначки | ✅ |
| `hapuga.php` | хапуга — рандомный магазин | ✅ |
| `hata.php` | хата игрока (покупка/владение) | server-authoritative, вне общего списка 19 |
| `poker.php` | покер, в т.ч. `openBag()` (дроп тату) | ✅ |
| `rewardlinks.php` | наградные ссылки — интеграция с отдельным сайтом-генератором (`vk_game/сайт/`, `/rewards-admin/`) | нет |
| `roulette.php` | рулетка, в т.ч. `openCase()` (дроп тату) | ✅ |
| `ryukzak.php` | рюкзак (розыгрыш оружия) | server-authoritative, вне общего списка 19 |
| `security.php` | проверка VK-подписи (`sign`)/античит | нет |
| `shmot.php` | шмотки — `giveRandom()`, `grantShmotFromSource()` | вызывается из Gameops-контроллеров |
| `skills.php` | навыки | ✅ |
| `tasks.php` | задания (новый контроллер) | ✅ |
| `top.php` | топ игроков — `ROWS_LIMIT_DEFAULT/SCROLLABLE`, `HIDDEN_FROM_TOP_UID` (карта в памяти агента: reference_list_size_constants) | нет (чтение, не экономика) |
| `users.php` | save/load `udata`, whitelist `$allowed` — критичный файл (см. память агента: incident_checkall_flush_wipes_server_credits) | central |
| `vassilich.php` | торговец Василич | ✅ |
| `weapons.php` | оружие | ✅ |
| `yashik.php` | ящик/лутбокс | ✅ |
| `zaruba.php` | PvP-дуэль ("зарубиться" со страницы визита к другу) | server-authoritative, вне общего списка 19 |
| `zone.php` | зона/локации | ✅ |

---

## 🧠 Структура `this._data` (runtime-состояние двора)

Хранится в `udata['dvor_games_data']` как JSON. Загружается в `_loadData()`, сохраняется `_saveData()`.
Содержит pity-систему: счётчик растёт с каждой игрой, при достижении порога гарантированно выпадает редкий приз → счётчик и порог сбрасываются.

```js
this._data = {
    poker: {
        exp: 0               // накопленный XP покера (для уровня)
    },

    cards: {
        exp: 0,              // XP карточных игр
        aa: 0,               // счётчик до выпадения ТТ (Туз+Туз) pity
        aa_t: 90000–110000,  // порог AA (рандом при инициализации)
        kk: 0,               // счётчик до KK
        kk_t: 70000–90000,   // порог KK
        qq: 0,               // счётчик до QQ
        qq_t: 8000–12000     // порог QQ
    },

    dice: {
        exp: 0,              // XP зарики
        pity: 0,             // счётчик pity (до большого выигрыша)
        pity_t: 1700–2300    // порог pity (рандом)
    },

    roulette: {
        exp: 0,              // XP рулетки
        jack: 0,             // кол-во спиней без джекпота
        jack_t: 3000–3500    // порог джекпота (рандом)
        // сумма джекпота = 3000 + jack * 30
    },

    blackjack: {
        exp: 0,              // XP блэкджека
        qq: 0,               // счётчик до выпадения QQ (Дама+Дама)
        qq_t: 50–100,        // порог QQ
        kk: 0,               // счётчик до KK (Король+Король)
        kk_t: 100–200,       // порог KK
        aa: 0,               // счётчик до AA (Туз+Туз)
        aa_t: 200–500        // порог AA
    }
}
```

**Как работает pity:** при каждой игре счётчик (`jack`, `pity`, `qq` и т.д.) инкрементируется. Когда счётчик ≥ порога — выдаётся гарантированный редкий приз, счётчик = 0, порог перегенерируется рандомом. Это скрытая защита от долгой неудачи.

