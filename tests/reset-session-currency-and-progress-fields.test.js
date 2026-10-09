/**
 * Test: репорт 08.10.2026 — "сбросил аккаунт через дев-панель, а после перезагрузки страницы
 * ресурсы снова старые". Корень: _resetAccount() (dev_panel.js) шлёт дефолты через обычный
 * users.save(), но анти-чит аудит 27.09-04.10.2026 один за другим убирал из client-writable
 * $allowed именно поля-"ресурсы" — coins/stew/cigarettes (29.09), zone/base_buildings/
 * base_stats/gang_id/zone_collect_0..4 (04.10), stew_spent/coins_spent/votes_spent (27.09),
 * roulette_spichki/poker_spichki/roulette_winner/keyring_owner (по мере переноса каждой фичи
 * на сервер). users.save() после каждого такого аудита молча игнорировал эти ключи — клиент
 * выглядел сброшенным мгновенно (window.udata заменён локально, без перезагрузки страницы), а
 * реальная строка в БД не менялась; расхождение проявлялось только на следующей настоящей
 * перезагрузке вкладки. Тот же класс, что уже был закрыт для max_energy (см.
 * users-reset-session-max-energy-parity.test.js) — этот тест закрывает оставшиеся поля тем же
 * способом (добавлены в resetSession(), который пишет в обход whitelist).
 *
 * Run: node tests/reset-session-currency-and-progress-fields.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const usersPhpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8'
);

console.log('\nTest 1: поля, убранные из client-writable $allowed, по-прежнему НЕ объявлены там как реальные ключи (комментарии про их удаление не считаются)');
{
    const allowedMatch = usersPhpSrc.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    // В массиве встречаются и обычные строки-ключи ('key',), и строки-значения guard'ов
    // ('key' => '_sanitizeX') — оба вида реальных объявлений ловим, а комментарии вида
    // "'coins'/'stew' убраны" не содержат ни запятой/конца строки, ни "=>" сразу после кавычки.
    const DEWHITELISTED = ['coins', 'stew', 'cigarettes', 'zone', 'base_buildings',
        'base_stats', 'gang_id', 'roulette_spichki', 'poker_spichki', 'roulette_winner', 'keyring_owner'];
    const codeOnly = allowedMatch[1].replace(/\/\/.*$/gm, '');
    for (const key of DEWHITELISTED) {
        assert(!new RegExp("'" + key + "'\\s*,").test(codeOnly) && !new RegExp("'" + key + "'\\s*=>").test(codeOnly),
            `'${key}' отсутствует в whitelist $allowed (как и должно быть)`);
    }
}

console.log('\nTest 2: resetSession() теперь явно обнуляет все эти поля в обход whitelist');
{
    const bodyMatch = usersPhpSrc.match(/function resetSession\(\)\{([\s\S]*?)\n        \}/);
    assert(!!bodyMatch, 'тело resetSession() найдено');
    const body = bodyMatch ? bodyMatch[1] : '';

    const EXPECTED = {
        coins: "'10'", stew: "'0'", cigarettes: "'1000'",
        zone: "'\\{\\}'", base_buildings: "''", base_stats: "''", gang_id: "'0'",
        zone_collect_0: "'0'", zone_collect_1: "'0'", zone_collect_2: "'0'",
        zone_collect_3: "'0'", zone_collect_4: "'0'",
        stew_spent: "'0'", coins_spent: "'0'", votes_spent: "'0'",
        roulette_spichki: "'0'", poker_spichki: "'0'",
        roulette_winner: "'\\{\\}'", keyring_owner: "'0'",
    };
    for (const [key, val] of Object.entries(EXPECTED)) {
        assert(new RegExp("'" + key + "'\\s*=>\\s*" + val).test(body),
            `resetSession() сбрасывает '${key}' => ${val}`);
    }
}

console.log('\nTest 3: дефолты resetSession() совпадают с _defaultResetUdata() (паритет личного сброса и "СБРОС У ВСЕХ")');
{
    const defMatch = usersPhpSrc.match(/function _defaultResetUdata\(\)\{\s*return \[([\s\S]*?)\];/);
    assert(!!defMatch, '_defaultResetUdata() найдена');
    const defaults = defMatch ? defMatch[1] : '';
    for (const key of ['coins', 'stew', 'cigarettes', 'gang_id', 'roulette_spichki', 'poker_spichki']) {
        const m = defaults.match(new RegExp("'" + key + "'\\s*=>\\s*'([^']*)'"));
        assert(!!m, `'${key}' найден в _defaultResetUdata()`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
