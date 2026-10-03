/**
 * Test: 26.09.2026 — исследовательский аудит "мёртвый vs живой код" по прямому запросу
 * пользователя (два подозрительных места прямой записи валюты на клиенте в game/dvor.js).
 *
 * НАХОДКА 1 (dvor.js._collectCig(), сбор облачков сигарет во дворе, +30 сигарет × 4/день):
 * на момент этого аудита (26.09.2026, до обеда) была ЖИВОЙ, НЕ мигрированной на сервер —
 * cigarettes и dvor_daily_sigs были обычными client-writable полями whitelist users.php без
 * единой серверной проверки лимита/суммы. Тест ниже фиксировал сам факт находки как
 * регресс-маркер.
 *
 * ОБНОВЛЕНО 26.09.2026 (тем же днём, по прямому указанию пользователя — "перенеси на сервер"):
 * находка закрыта. Новый контроллер server/core/controllers/dvor.php.collectCig() — idx
 * валидируется, dvor_daily_sigs стало server-only session-полем (убрано из whitelist
 * users.php), сервер сам сравнивает свою дату (date('Y-m-d')) с сохранённой и решает, можно ли
 * собрать (fail(52), если уже собрано сегодня), +30 сигарет начисляется через Gameops::add().
 * Клиент (dvor.js._collectCig()) теперь только визуальный фидбек + TS.php('dvor.collectCig')
 * + applyPatch(e.patch) — полная проверка см. tests/dvor-collect-cig-server-authoritative.
 * test.js. Test 4 ниже обновлён — теперь проверяет НОВОЕ (исправленное) состояние вместо
 * фиксации старой дыры, чтобы не оставлять в сюите тест, красный по замыслу.
 *
 * НАХОДКА 2 (dvor.js._give(), универсальный блок начисления награды, case 'stew'/'cig'/
 * 'coins'/...): сам _give() ЖИВОЙ — используется легитимно из dvor-roulette-screen.js
 * (компенсация 50 спичек при проигранной гонке за связку ключей после ответа сервера
 * roulette.claimKeyring). НО один из его вызывающих — старая FLA-панель рулетки
 * (proto._playRoulette()/_resolveRoulette() в dvor-roulette.js) — оказалась МЁРТВОЙ:
 *   - недостижима через UI (единственная привязка была this.win.roulette_panel.butt_red/
 *     butt_spin в dvor.js._bindGamePanels(), а this.win открывается только в ветке
 *     Dvor._openGame(), которая для 'roulette' ВСЕГДА возвращает раньше через
 *     _openRouletteScreen() — тот же вывод, что уже задокументирован для poker_panel/
 *     cards_panel);
 *   - не вызывается программно нигде (в отличие от dice_panel.butt_roll, нужного bot.js) —
 *     grep по _client/src не нашёл ни одного вызова _playRoulette() кроме самой недостижимой
 *     привязки;
 *   - дублирует уже готовый и реально используемый server-authoritative путь
 *     (_spinRoulette() → roulette.spin → applyPatch(res.patch)).
 * Удалена целиком (вместе с привязкой кнопок в dvor.js._bindGamePanels()) — тот же паттерн,
 * что и полное удаление dvor-cards.js (см. tests/security-audit-weapons-shmot-bp-tasks-nick.
 * test.js, пункт 3): мёртвый, но вызываемый из консоли (dvor._playRoulette()) генератор
 * наград, обходящий сервер целиком (client-side RNG + client-side списание blue_points).
 *
 * Run: node tests/dead-code-audit-dvor-fla-roulette-removed-cig-cloud-risk.test.js
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

const dvorJs         = readSrc('_client/src/game/dvor.js');
const dvorRouletteJs = readSrc('_client/src/game/dvor/dvor-roulette.js');
const usersPhp       = readSrc('server/core/controllers/users.php');

console.log('\nTest 1: старая FLA-рулетка (_playRoulette/_resolveRoulette) удалена из dvor-roulette.js');
{
    assert(!/proto\._playRoulette\s*=\s*function/.test(dvorRouletteJs), 'proto._playRoulette() больше не определён');
    assert(!/proto\._resolveRoulette\s*=\s*function/.test(dvorRouletteJs), 'proto._resolveRoulette() больше не определён');
    assert(/мёртвый, но вызываемый из консоли \(dvor\._playRoulette\(\)\) эксплойт/.test(dvorRouletteJs),
        'оставлен объясняющий комментарий с датой и причиной удаления');
    // Живой server-authoritative путь остаётся нетронутым
    assert(/proto\._spinRoulette\s*=\s*function/.test(dvorRouletteJs), '_spinRoulette() (сервер roulette.spin) остаётся — это единственный живой путь крутки рулетки');
    assert(/TS\.php\('roulette\.spin', \{\}, \(res\) => \{/.test(dvorRouletteJs), '_spinRoulette по-прежнему уходит на сервер');
    assert(/applyPatch\(res\.patch\);/.test(dvorRouletteJs), '_spinRoulette по-прежнему применяет applyPatch(res.patch)');
}

console.log('\nTest 2: dvor.js._bindGamePanels() больше не привязывает roulette_panel.butt_red/butt_spin к _playRoulette()');
{
    assert(!/rp\.butt_red\.on\('pointerdown',\s*\(\)=>this\._playRoulette\(\)\)/.test(dvorJs), 'butt_red больше не привязан к _playRoulette()');
    assert(!/rp\.butt_spin\.on\('pointerdown',\s*\(\)=>this\._playRoulette\(\)\)/.test(dvorJs), 'butt_spin больше не привязан к _playRoulette()');
    assert(!/const rp = this\.win\.roulette_panel;/.test(dvorJs), 'ссылка на this.win.roulette_panel в _bindGamePanels() убрана вместе с привязкой');
    // dice_panel.butt_roll остаётся — нужен bot.js (авто-бот), функция мигрирована на сервер, не удалена
    assert(/const dp = this\.win\.dice_panel;/.test(dvorJs) && /dp\.butt_roll\.on\('pointerdown',\s*\(\)=>this\._playDice\(\)\)/.test(dvorJs),
        'dice_panel.butt_roll -> _playDice() остаётся (используется bot.js, функция сама мигрирована на сервер)');
}

console.log('\nTest 3: универсальный _give() в dvor.js остаётся — используется живым путём rulетки (компенсация 50 спичек)');
{
    assert(/_give\(type, amount\)\{/.test(dvorJs), '_give() определён и не удалялся (используется легитимными вызывающими)');
    assert(/case 'stew':/.test(dvorJs) && /case 'coins':/.test(dvorJs), 'switch-блок начисления валюты на месте');
}

console.log('\nТест 4 (обновлено 26.09.2026 — находка закрыта): _collectCig() теперь server-authoritative, а не client-authoritative');
{
    assert(/_collectCig\(idx, spr\)\{/.test(dvorJs), '_collectCig() существует (живая фича)');
    assert(!/udata\['cigarettes'\] = \(parseInt\(udata\['cigarettes'\]\|\|0\)\+30\)\.toString\(\);/.test(dvorJs),
        'клиент БОЛЬШЕ НЕ пишет +30 сигарет напрямую в udata — начисление теперь только через ответ сервера');
    assert(/TS\.php\('dvor\.collectCig', \{idx\}, /.test(dvorJs), '_collectCig() уходит на сервер (dvor.collectCig)');
    // 29.09.2026: 'cigarettes' больше НЕ в client-writable $allowed (см.
    // tests/currency-whitelist-removed-devgrant-endpoint.test.js) — вся валюта переехала на
    // Gameops-контроллеры + узкий dev-permit users.devGrantCurrency(). Проверяем только, что
    // сама валюта как понятие никуда не делась из файла (сервер её по-прежнему знает и считает).
    assert(/'cigarettes'/.test(usersPhp), "'cigarettes' как валюта по-прежнему известна серверу (теперь server-authoritative, не client-writable whitelist)");
    const allowedRaw = usersPhp.slice(usersPhp.indexOf('$allowed = ['), usersPhp.indexOf('\n            ];'));
    const allowedBlock = allowedRaw.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert(!allowedBlock.includes("'dvor_daily_sigs'"),
        "'dvor_daily_sigs' убрано из $allowed — server-only поле, см. server/core/controllers/dvor.php.collectCig()");
    assert(fs.existsSync(path.join(root, 'server/core/controllers/dvor.php')), 'server/core/controllers/dvor.php существует — контроллер сбора сигарет добавлен');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
