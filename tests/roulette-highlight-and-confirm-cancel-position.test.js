/**
 * Test: две точечные позиционные правки по замеру через редактор позиций (15.09.2026).
 *
 * 1) Рулетка — клин подсветки "что выиграл игрок" статичен (крутится колесо ПОД
 *    неподвижной стрелкой, а не сам клин) — новая калибровка позиции/поворота, чтобы клин
 *    совпадал с фиксированной точкой стрелки.
 * 2) Попап подтверждения действия (confirm.js) — позиция активного спрайта кнопки "ОТМЕНА".
 *
 * Run: node tests/roulette-highlight-and-confirm-cancel-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const roul    = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8'
);
const confirm = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'confirm.js'), 'utf-8'
);

// 23.09.2026 (по прямому указанию — "убери подсвечивание для игры рулетку"): клин подсветки
// сектора убран из игры целиком — калибровка позиции/масштаба/поворота, которую проверял этот
// тест, больше не существует. См. tests/roulette-sector-highlight-removed.test.js.
console.log('\nTest 1: рулетка — регресс-гвард, клин подсветки не возвращён');
{
    assert(!/this\._roulSectorHighlight =/.test(roul), 'this._roulSectorHighlight больше не создаётся');
}

console.log('\nTest 2: попап подтверждения — позиция активного спрайта кнопки "ОТМЕНА"');
{
    assert(/otmActive\.x = 656; otmActive\.y = 352; otmActive\.visible = false;/.test(confirm),
        'btn_otm_active.png теперь на x:656 y:352 (замерено редактором позиций)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
