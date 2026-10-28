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

console.log('\nTest 1 (vm, реальное исполнение): achievements.js.onDvorGame() — массив cards_combos/poker_combos превращается в {} ПЕРЕД мутацией');
{
    const achSrc = readSrc('_client/src/game/achievements.js');
    let src = achSrc.replace(/^import .*$\n?/gm, '');
    src = src.replace('export default class Achievements', 'class Achievements');
    src += '\nmodule.exports = Achievements;\n';

    const sandboxUdata = {};
    function flushPlayerSave(reason, onDone){ if(typeof onDone === 'function') onDone(); return true; }
    function applyPatch(patch){ Object.assign(sandboxUdata, patch); }
    function collapseNewlyEarnedForPopup(arr){ return arr; }
    function attachAchievementPopup(proto){ proto._openAchievementPopup = function(){}; }
    const TS = { php(){} };
    const helperStub = {
        safeParseJSON(value, fallback){
            if(value == null) return fallback;
            if(typeof value === 'object') return value;
            try{ return JSON.parse(value); } catch(e){ return fallback; }
        }
    };
    const sandbox = {
        console, window: { TS }, TS, helper: helperStub, udata: sandboxUdata,
        flushPlayerSave, applyPatch, collapseNewlyEarnedForPopup, attachAchievementPopup,
        module: { exports: {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const Achievements = sandbox.module.exports;
    const inst = new Achievements();

    // Симулируем живой баг: cards_combos уже испорчен в список (та же форма, что uid 382448269).
    const corrupted = new Array(100).fill(null);
    corrupted[88] = 1;
    sandboxUdata['cards_combos'] = JSON.stringify(corrupted);
    inst.onDvorGame('cards', { combo: 'tt' });

    const result = JSON.parse(sandboxUdata['cards_combos']);
    assert(!Array.isArray(result), 'cards_combos после onDvorGame() — ОБЪЕКТ, не массив (раньше оставался бы массивом навсегда)');
    assert(result.tt === 1, 'новая победа "tt" реально записана (раньше JSON.stringify() молча отбросил бы это свойство на массиве)');

    // poker_combos — та же защита.
    const corruptedPoker = new Array(50).fill(null);
    corruptedPoker[12] = 3;
    sandboxUdata['poker_combos'] = JSON.stringify(corruptedPoker);
    inst.onDvorGame('poker', { combo: 'rf' });
    const resultPoker = JSON.parse(sandboxUdata['poker_combos']);
    assert(!Array.isArray(resultPoker), 'poker_combos после onDvorGame() — ОБЪЕКТ, не массив');
    assert(resultPoker.rf === 1, 'новая победа "rf" реально записана в poker_combos');
}

console.log('\nTest 2 (regex-гвард): Array.isArray-проверки реально присутствуют в коде для обоих полей');
{
    const achSrc = readSrc('_client/src/game/achievements.js');
    const matches = achSrc.match(/if\(Array\.isArray\(c\)\) c = \{\};/g) || [];
    assert(matches.length === 2, `ровно 2 проверки Array.isArray (cards_combos + poker_combos), найдено ${matches.length}`);
}

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
