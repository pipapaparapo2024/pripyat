/**
 * Test: батч 24.09.2026 (по прямому указанию + скриншот — "на заднем фоне Двор всё равно
 * кнопки справа ещё есть", открыт экран покера с "ТАБЛИЦЕЙ КОМБИНАЦИЙ", позади тускло
 * просвечивают элементы Двора).
 *
 * Разбор показал: dvor-poker.js/dvor-roulette.js/dvor-dice.js/dvor-blackjack.js при открытии
 * своего экрана ставили this._dvorWrap.alpha = 0.35 (клики отключены через
 * interactiveChildren=false, но визуально Двор оставался виден на 35% прозрачности) — не баг,
 * а осознанный старый выбор дизайна. Пользователь подтвердил (AskUserQuestion): сделать Двор
 * полностью невидимым (alpha=0) во всех 4 играх, а не только в покере.
 *
 * Run: node tests/dvor-wrap-fully-hidden-behind-casino-games.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const FILES = [
    ['dvor-poker.js',     '_client/src/game/dvor/dvor-poker.js'],
    ['dvor-roulette.js',  '_client/src/game/dvor/dvor-roulette.js'],
    ['dvor-dice.js',      '_client/src/game/dvor/dvor-dice.js'],
    ['dvor-blackjack.js', '_client/src/game/dvor/dvor-blackjack.js'],
];

for (const [name, rel] of FILES) {
    console.log(`\nTest: ${name} — _dvorWrap полностью скрыт (alpha=0) при открытии, восстанавливается (alpha=1) при закрытии`);
    const src = fs.readFileSync(path.join(root, rel), 'utf-8');
    assert(/if\(this\._dvorWrap\)\{ this\._dvorWrap\.alpha = 0; this\._dvorWrap\.interactiveChildren = false; \}/.test(src),
        `${name}: открытие ставит alpha=0 (не 0.35)`);
    assert(/if\(this\._dvorWrap\)\{ this\._dvorWrap\.alpha = 1; this\._dvorWrap\.interactiveChildren = true; \}/.test(src),
        `${name}: закрытие по-прежнему восстанавливает alpha=1`);
    assert(!/this\._dvorWrap\.alpha = 0\.35/.test(src), `${name}: регресс-гвард — старое значение 0.35 не осталось нигде`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
