/**
 * Test: 28.10.2026, по репорту — "выбил десятки+девятки в блэкджеке на тесте, 'Десятки' не
 * засчиталась даже после перезагрузки".
 *
 * Расследование через SSH/DB (uid 382448269, прод): `cards_combos` хранился в БД как JSON-
 * МАССИВ `[null,null,...,1,...,1]` (100 элементов), непустые значения ровно на числовых
 * позициях 88 и 99 — а НЕ как ожидаемый объект `{"tt":1,"99":2}`. Корень: PHP `json_encode()`
 * пустого ассоциативного массива всегда даёт `"[]"`, не `"{}"` (PHP не различает пустой
 * объект/список внутри). Как только `cards_combos`/`poker_combos` хоть раз уходил на клиент
 * пустым через `users.get()`/`patch`, клиент получал JS-МАССИВ вместо объекта —
 * `achievements.js.onDvorGame()` затем делал `c[data.combo] = ...` на этом массиве (вешает
 * нечисловое свойство), а `JSON.stringify()` массива ИГНОРИРУЕТ нечисловые свойства целиком —
 * запись терялась молча, КАЖДЫЙ раз. При этом `crd_88`/`crd_99` у uid 382448269 оказались
 * ложно засчитаны — PHP совпадает числовую строку-ключ статпути ('88'/'99') с ЧИСЛОВЫМ
 * ИНДЕКСОМ списочного массива, где как раз лежали значения на этих позициях (остаток
 * не связанных с реальными победами данных).
 *
 * Проверено на сервере: 142 аккаунта на проде / 110 на тесте имеют `cards_combos` в виде
 * массива (у подавляющего большинства — просто `"[]"`, т.е. их следующая честная победа
 * молча терялась бы без этого фикса).
 *
 * Фикс — защита в ДВУХ местах:
 * 1. Клиент (`achievements.js.onDvorGame()`) — `if(Array.isArray(c)) c = {};` перед мутацией
 *    cards_combos/poker_combos, самоисцеляет повреждённое поле при следующей честной победе.
 * 2. Сервер (`achievementengine.php.buildState()`) — `_dropIfList()` сбрасывает испорченный
 *    list-массив в `[]` ПЕРЕД сравнением статпутей, не полагаясь только на клиентское
 *    самоисцеление (у 42 аккаунтов на проде/28 на тесте уже лежат НЕПУСТЫЕ испорченные
 *    массивы — без серверной защиты они могли бы словить ложный `achievements.sync()`
 *    РАНЬШЕ, чем клиент успеет самоисцелиться следующей честной игрой).
 *
 * Run: node tests/cards-poker-combos-array-vs-object-corruption-fix.test.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { findPhpBin, runPhp } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nСохранение комбинаций на сервере');
for (const game of ['blackjack', 'poker']) {
    const src = readSrc('server/core/controllers/' + game + '.php');
    assert(src.includes('if(array_is_list($combos)) $combos = [];'), game + ' отбрасывает повреждённый список');
    assert(src.includes('json_encode($combos, JSON_FORCE_OBJECT)'), game + ' сохраняет комбинации объектом');
}
const achSrc = readSrc('_client/src/game/achievements.js');
assert(!/udata\['(?:cards|poker)_combos'\]\s*=/.test(achSrc), 'браузер не сохраняет комбинации');

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('\n⚠️  PHP не найден локально — серверные тесты (achievementengine.php) пропущены, см. tests/_php_bin.js.');
} else {
    console.log('\nTest 3 (реальное исполнение PHP): AchievementEngine.buildState()/_dropIfList() + сквозной checkAll()');
    const fixture = path.join(__dirname, '_php_fixtures', 'achievementengine-list-array-corruption-fix.php');
    let stdout;
    try {
        stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
    } catch (e) {
        console.error('  ❌ PHP-скрипт упал (фатальная ошибка):');
        console.error(e.stderr || e.message);
        failed++;
        stdout = '';
    }
    stdout.trim().split('\n').forEach(line => {
        if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
        else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
        else if (line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
        else if (line.trim()) console.log('  ', line);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
