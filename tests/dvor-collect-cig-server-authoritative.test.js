/**
 * Test: 26.09.2026 — перенос сбора сигарет во дворе (клик по 4 "облачкам" на экране Двора) на
 * сервер, по прямому указанию пользователя. Закрывает дыру, задокументированную регресс-
 * маркером в tests/dead-code-audit-dvor-fla-roulette-removed-cig-cloud-risk.test.js
 * («Находка 1», 26.09.2026): и cigarettes, и dvor_daily_sigs были обычными client-writable
 * полями whitelist users.php без единой серверной проверки — читер мог обнулить
 * dvor_daily_sigs консолью браузера и собирать 4×30 сигарет неограниченное число раз в день,
 * либо просто подделать cigarettes напрямую.
 *
 * 27.09.2026 (по прямому указанию — жалоба "облачка не отображаются у некоторых игроков"):
 * модель хранения сменена с "1 раз в календарные сутки на облачко"
 * ({date:'YYYY-MM-DD', collected:[bool×4]}) на индивидуальный кулдаун 30 минут на КАЖДОЕ из 4
 * облачков ({lastMs:[int|null×4]}) — старая модель, вероятно, и была причиной репорта: игрок,
 * уже собравший облачко сегодня, не видел его до полуночи по серверным часам. Диагностика
 * подтвердила, что присланные "новые" арт-файлы (сбор сиг 1..4.png) байт-в-байт идентичны
 * (MD5) уже развёрнутым на проде cloud_sig_1..4.png — замена картинки не требовалась, файлы
 * менять не пришлось.
 *
 * Новый эндпоинт dvor.collectCig (server/core/controllers/dvor.php) принимает idx (0-3),
 * валидирует диапазон, читает/пишет dvor_daily_sigs как server-only session-поле (в обход
 * whitelist, через Gameops::loadUser()/saveUser()), сравнивает серверное время (мс) с
 * lastMs[idx] — если прошло меньше SIG_COOLDOWN_MS (30 минут), отклоняет fail(52); иначе
 * начисляет +30 сигарет через Gameops::add(), обновляет lastMs[idx] и возвращает patch,
 * включающий и cigarettes, и сам dvor_daily_sigs (чтобы клиентский периодический
 * _refreshCigSprites() в dvor.js видел свежий кулдаун без перезагрузки страницы).
 *
 * Run: node tests/dvor-collect-cig-server-authoritative.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersPhp    = readSrc('server/core/controllers/users.php');
const registryPhp = readSrc('server/core/models/registry.php');
const dvorPhp      = readSrc('server/core/controllers/dvor.php');
const dvorJs       = readSrc('_client/src/game/dvor.js');

console.log('\nTest 1: dvor_daily_sigs убрано из client-writable whitelist $allowed в users.php');
{
    const allowedRaw = usersPhp.slice(usersPhp.indexOf('$allowed = ['), usersPhp.indexOf('\n            ];'));
    // Комментарии рядом (в т.ч. этой же правки) намеренно упоминают 'dvor_daily_sigs' в кавычках
    // как текст пояснения — наивный includes() ловил бы и их. Отбрасываем строки-комментарии
    // ("//...") перед проверкой, чтобы искать только реальные элементы массива.
    const allowedBlock = allowedRaw.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert(!allowedBlock.includes("'dvor_daily_sigs'"), "'dvor_daily_sigs' отсутствует в $allowed как реальный элемент массива (иначе users.save может его подделать)");
    assert(allowedBlock.includes("'dvor_games_data'"), "'dvor_games_data' остаётся в whitelist (уровень казино-игр — не в фокусе этой миграции)");
}

console.log('\nTest 2: класс Dvor зарегистрирован в registry.php — иначе validateClass() молча отклонит любой вызов');
{
    const classesLine = registryPhp.slice(registryPhp.indexOf("'classes'=>array("), registryPhp.indexOf('),', registryPhp.indexOf("'classes'=>array(")));
    assert(/'dvor'/.test(classesLine), "'dvor' присутствует в массиве classes");
}

console.log('\nTest 3: dvor.php — Class Dvor с конструктором на паттерне Gameops, permits содержит collectCig');
{
    assert(/Class Dvor \{/.test(dvorPhp), 'Class Dvor определён');
    assert(/\$this->ops = new Gameops\(\$registry\);/.test(dvorPhp), 'конструктор создаёт $this->ops = new Gameops($registry)');
    assert(/\$this->permits = \['collectCig'\];/.test(dvorPhp), "permits содержит 'collectCig'");
}

console.log('\nTest 4: collectCig() валидирует диапазон idx (0-3), иначе fail(54)');
{
    const start = dvorPhp.indexOf('function collectCig(){');
    const body  = dvorPhp.slice(start); // collectCig — единственная/последняя функция файла, до конца безопасно
    assert(/\$idx = intval\(\$this->registry\['user_params'\]\['idx'\] \?\? -1\);/.test(body), 'idx читается из user_params');
    assert(/if\(\$idx < 0 \|\| \$idx > 3\) return \$this->ops->fail\(54\);/.test(body), 'диапазон 0-3 валидируется, иначе fail(54)');
}

console.log('\nTest 5: collectCig() — кулдаун 30 минут НА КАЖДОЕ облачко (не общий дневной сброс), серверное время (мс), отклоняет fail(52) пока кулдаун не истёк');
{
    assert(/const SIG_COOLDOWN_MS = 30 \* 60 \* 1000;/.test(dvorPhp), 'SIG_COOLDOWN_MS = 30*60*1000 (30 минут) определена как константа класса');
    assert(/\$nowMs = intval\(round\(microtime\(true\) \* 1000\)\);/.test(dvorPhp), 'используется серверное время в мс (microtime), не клиентские часы');
    assert(/if\(!isset\(\$state\['lastMs'\]\) \|\| !is_array\(\$state\['lastMs'\]\)\)\{/.test(dvorPhp),
        '_loadSigState() приводит структуру к {lastMs:[...]} — НЕ к старому {date,collected}');
    assert(!/\$state\['date'\]/.test(dvorPhp), 'старое поле date больше не используется — сброс не привязан к календарным суткам');
    assert(!/\$state\['collected'\]/.test(dvorPhp), 'старое поле collected больше не используется');
    assert(/if\(\$lastMs > 0 && \(\$nowMs - \$lastMs\) < self::SIG_COOLDOWN_MS\)\{[\s\S]{0,300}?return \$this->ops->fail\(52\);/.test(dvorPhp),
        'idx в пределах 30-минутного кулдауна отклоняется fail(52)');
}

console.log('\nTest 6: collectCig() начисляет +30 сигарет через Gameops::add(), сохраняет lastMs[idx]=nowMs через saveUser(), patch включает dvor_daily_sigs');
{
    assert(/\$this->ops->add\(\$user, 'cigarettes', 30\);/.test(dvorPhp), 'Gameops::add($user, \'cigarettes\', 30) вызывается — сумма награды не изменена');
    assert(/\$state\['lastMs'\]\[\$idx\] = \$nowMs;/.test(dvorPhp), 'lastMs[idx] обновляется на текущее серверное время при успешном сборе');
    assert(/\$user\['dvor_daily_sigs'\] = json_encode\(\$state\);/.test(dvorPhp), 'обновлённое состояние сериализуется обратно в поле');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(dvorPhp), 'saveUser() вызывается, ошибка сохранения — fail(99)');
    assert(/\$this->ops->ok\(\['patch' => \$this->ops->patchCurrencies\(\$user, \['cigarettes', 'dvor_daily_sigs'\]\)\]\);/.test(dvorPhp),
        "ответ содержит patch с cigarettes И dvor_daily_sigs (чтобы клиентский _refreshCigSprites() видел свежий кулдаун без перезагрузки users.get())");
}

console.log('\nTest 7: клиент dvor.js._collectCig() вызывает TS.php(\'dvor.collectCig\', ...) и не пишет udata[\'cigarettes\'] напрямую');
{
    const start = dvorJs.indexOf('_collectCig(idx, spr){');
    const end   = dvorJs.indexOf('\n    _showFloatingText', start);
    const body  = dvorJs.slice(start, end < 0 ? dvorJs.length : end);
    assert(/TS\.php\('dvor\.collectCig', \{idx\}, /.test(body), "TS.php('dvor.collectCig', {idx}, ...) вызывается");
    assert(!/udata\['cigarettes'\] = \(parseInt\(udata\['cigarettes'\]/.test(body),
        "клиент больше НЕ пишет udata['cigarettes'] напрямую до ответа сервера");
    assert(/applyPatch\(e\.patch\)/.test(body), 'applyPatch(e.patch) применяется в колбэке');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(body),
        'achievements._checkAll() вызывается (после applyPatch — в колбэке)');
}

console.log('\nTest 8: import applyPatch присутствует в dvor.js');
{
    assert(/import \{ applyPatch \}\s*from '\.\.\/modules\/patch\.js';/.test(dvorJs), "import { applyPatch } from '../modules/patch.js' добавлен");
}

console.log('\nTest 9: resetSession() (users.php) содержит dvor_daily_sigs — полный сброс аккаунта обязан чистить и это server-only поле');
{
    const start = usersPhp.indexOf('function resetSession(){');
    const end   = usersPhp.indexOf('$result = $this->registry', start);
    const body  = usersPhp.slice(start, end);
    assert(/'dvor_daily_sigs'\s*=>\s*null,/.test(body), "'dvor_daily_sigs' => null присутствует в resetSession()");
}

console.log('\nTest 10: sanity — колонка dvor_daily_sigs уже существовала (была в whitelist до этой правки) — миграция не требуется');
{
    // Сама dvor_daily_sigs была client-writable ДО этой миграции (см. _defaultResetUdata() —
    // тот же 1:1 копируемый список дефолтов, что и dev_panel.js._resetAccount()) — значит
    // колонка в БД реально существует и активно использовалась, TEXT-тип годится под JSON.
    assert(/'dvor_daily_sigs'=>'\{\}'/.test(usersPhp), "_defaultResetUdata() содержит дефолт dvor_daily_sigs='{}' — колонка существует в БД");
    // 27.09.2026: значение-дефолт '{}' (пустой объект) остаётся совместимым с новым форматом
    // {lastMs:[...]}: Gameops::j() декодирует '{}' в [] (пустой массив), _loadSigState() видит
    // отсутствие lastMs и сама подставляет [null,null,null,null] — свежий аккаунт получает
    // "все 4 облачка доступны сразу", как и ожидается, без отдельной миграции дефолта.
}

console.log('\nTest 11: клиент dvor.js — SIG_COLLECT_COOLDOWN_MS = 30 минут (держать в синхроне с server/core/controllers/dvor.php::SIG_COOLDOWN_MS)');
{
    assert(/const SIG_COLLECT_COOLDOWN_MS = 30 \* 60 \* 1000;/.test(dvorJs),
        'SIG_COLLECT_COOLDOWN_MS = 30*60*1000 объявлена на уровне модуля (по аналогии с HABAR_COLLECT_COOLDOWN_MS в habar.js)');
}

console.log('\nTest 12: _getSigState() читает НОВЫЙ формат {lastMs:[...]} и сравнивает с Date.now() — старый {date,collected} больше не используется');
{
    const start = dvorJs.indexOf('_getSigState(){');
    const end   = dvorJs.indexOf('\n    }', start);
    const body  = dvorJs.slice(start, end < 0 ? dvorJs.length : end);
    assert(/const d = helper\.safeParseJSON\(udata\['dvor_daily_sigs'\], \{\}\);/.test(body),
        '_getSigState() по-прежнему читает dvor_daily_sigs через safeParseJSON (не голый JSON.parse)');
    assert(/const lastMs = Array\.isArray\(d\.lastMs\) \? d\.lastMs : \[\];/.test(body), 'читает d.lastMs (новый формат)');
    assert(/const now = Date\.now\(\);/.test(body), 'сравнение идёт с текущим временем клиента (UI-подсказка, не источник правды)');
    assert(!/d\.date === this\._today\(\)/.test(body), 'старое сравнение с календарной датой (this._today()) удалено');
    assert(!/d\.collected/.test(body), 'старое поле d.collected больше не читается');
}

console.log('\nTest 13: облачко должно САМО становиться доступным через 30 минут без перезахода в казино — периодический _refreshCigSprites() в constructor()');
{
    const start = dvorJs.indexOf('constructor(mc){');
    const end   = dvorJs.indexOf('\n    }', start);
    const body  = dvorJs.slice(start, end < 0 ? dvorJs.length : end);
    assert(/setInterval\(\(\) => this\._refreshCigSprites\(\), 30000\);/.test(body),
        'setInterval(..., 30000) на _refreshCigSprites() зарегистрирован в конструкторе Dvor (по аналогии с interface.js updateEnergy() setInterval(...,1000))');
}

console.log('\nTest 14: sanity — _saveSigState() (client-writable запись старого формата) удалена как мёртвый/несовместимый со схемой код');
{
    assert(!/_saveSigState/.test(dvorJs), '_saveSigState() отсутствует в dvor.js (была неиспользуемым мёртвым кодом, писала несовместимый со схемой {lastMs:[...]} формат)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
