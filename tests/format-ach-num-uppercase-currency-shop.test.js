/**
 * Test: 28.10.2026, по прямому указанию — "в магазине покупки если цифра выходит за 1000,
 * пиши не 1000 а 1К, аналогично миллиону — 1КК".
 *
 * formatAchNum(n) (_client/src/modules/achievement-tiers.js) уже был единым источником
 * сокращения крупных чисел ("к"/"кк", строчные) для описаний достижений и прогресс-баров
 * тиров (svod-achievements.js) — повторно использован здесь, а не продублирован отдельной
 * функцией, через новый необязательный параметр upper (по умолчанию false, не трогает уже
 * задействованные места со строчными "к"/"кк", например лайфтайм-награды топа 2048).
 *
 * Run: node tests/format-ach-num-uppercase-currency-shop.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel) { return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: formatAchNum(n, true) реально считает заглавные "К"/"КК" (выполнено через vm, не regex)');
{
    const src = readSrc('_client/src/modules/achievement-tiers.js');
    const formatFnMatch = src.match(/export function formatAchNum\(n, upper = false\)\{[\s\S]*?\n\}/);
    assert(!!formatFnMatch, 'formatAchNum(n, upper = false) найдена');
    if (formatFnMatch) {
        const ctx = { module: { exports: {} } };
        vm.createContext(ctx);
        vm.runInContext(formatFnMatch[0].replace('export function', 'function') + '\nmodule.exports = formatAchNum;', ctx);
        const formatAchNum = ctx.module.exports;

        assert(formatAchNum(1600, true) === '1.6К', 'formatAchNum(1600, true) === "1.6К" (дробь, заглавная К)');
        assert(formatAchNum(1000, true) === '1К', 'formatAchNum(1000, true) === "1К" (круглое число без .0)');
        assert(formatAchNum(300000, true) === '300К', 'formatAchNum(300000, true) === "300К" (не миллион — всё ещё К)');
        assert(formatAchNum(1000000, true) === '1КК', 'formatAchNum(1000000, true) === "1КК"');
        assert(formatAchNum(2500000, true) === '2.5КК', 'formatAchNum(2500000, true) === "2.5КК"');
        assert(formatAchNum(500, true) === '500', 'formatAchNum(500, true) === "500" (меньше 1000 — без сокращения)');

        // upper=false (по умолчанию) НЕ меняет уже задействованное строчное поведение —
        // регрессия сломала бы 2048-топ (lifetime rewards) и svod-achievements прогресс-бары.
        assert(formatAchNum(1600) === '1.6к', 'formatAchNum(1600) без upper остаётся строчным "1.6к" (обратная совместимость)');
        assert(formatAchNum(1000000) === '1кк', 'formatAchNum(1000000) без upper остаётся строчным "1кк"');
    }
}

console.log('\nTest 2: interface-currency-purchase.js — countTxt использует formatAchNum(count, true), склонение считается от реального count');
{
    const src = readSrc('_client/src/game/interface/interface-currency-purchase.js');
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(src),
        'formatAchNum импортирован из achievement-tiers.js');
    assert(/const countTxt = new PIXI\.Text\(formatAchNum\(count, true\) \+ ' ' \+ def\.unitWord\(count\), TXT_STYLE_COUNT\);/.test(src),
        'countTxt сокращает ЧИСЛО через formatAchNum(count, true), но unitWord(count) по-прежнему склоняется от реального count');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.error(`❌ ${failed} test(s) failed, ${passed} passed`); process.exit(1); }
