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
 * ⚠️ 20.10.2026 (ОТМЕНЕНО, по прямому указанию + скриншот — "вкладка Двор становится ПОЛНОСТЬЮ
 * ПРОЗРАЧНОЙ, не видно задний фон, нужно чтобы затемнялась"): alpha=0 оказался тем самым багом,
 * про который предупреждали старые комментарии ("фон Двора при этом затемнён" — комментарии в
 * коде так и остались написаны про затемнение все эти месяцы, хотя число было 0). Первая правка
 * в ответ — alpha=0.35 — тоже прожила недолго: пользователь уточнил, что alpha меняет
 * прозрачность самого Двора (он бледнеет), а не настоящее затемнение, и попросил именно чёрный
 * полупрозрачный слой ПОВЕРХ Двора. Финал — this._showDvorDarken()/_hideDvorDarken() в dvor.js
 * (Двор остаётся alpha=1, темнее выглядит отдельный Graphics-слой). Источник истины —
 * tests/oct20-batch4-dvor-darken-fix-and-ryukzak-key-card.test.js. Этот файл оставлен как
 * история развилки 24.09→20.10, ассерты ниже обновлены под текущее поведение.
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
    console.log(`\nTest: ${name} — Двор затемняется через общий _showDvorDarken()/_hideDvorDarken() (dvor.js), не через свою alpha`);
    const src = fs.readFileSync(path.join(root, rel), 'utf-8');
    assert(/this\._showDvorDarken\(\);/.test(src), `${name}: открытие вызывает this._showDvorDarken()`);
    assert(/this\._hideDvorDarken\(\);/.test(src), `${name}: закрытие вызывает this._hideDvorDarken()`);
    assert(!/this\._dvorWrap\.alpha\s*=/.test(src), `${name}: регресс-гвард — файл больше не трогает _dvorWrap.alpha напрямую (ни 0, ни 0.35, ни 1)`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
