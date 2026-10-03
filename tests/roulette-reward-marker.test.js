/**
 * Test: красная точка-маркер награды в рулетке (rewardMarker) — история и текущее состояние.
 *
 * История:
 *  1) Изначально маркер был ребёнком wheelSpr (колеса) и позиционировался формулой
 *     150*cos(angle)/150*sin(angle) — при вращении колеса он крутился ВМЕСТЕ с ним,
 *     из-за чего после каждого спина оказывался в другом месте экрана, а не на стрелке.
 *     Стрелка (arrowSpr) сама не крутится — крутится только колесо ПОД ней.
 *  2) Промежуточный фикс (смещение +6/+44) не решал проблему в корне — он лишь сдвигал
 *     точку ВНУТРИ вращающейся системы координат колеса, она всё равно продолжала
 *     крутиться вместе с колесом при каждом новом спине.
 *  3) Фикс: rewardMarker стал ребёнком win (как и сама стрелка), с ФИКСИРОВАННОЙ позицией
 *     на месте стрелки (693,323) — никакой привязки к углу/повороту колеса. Флаг _uDraggable
 *     сделал его видимым для универсального редактора позиций (_uFindTopmost по умолчанию
 *     ищет только Sprite/Text, не Graphics).
 *  4) 26.09.2026 (по прямому указанию, батч "cup-row-layout-and-reward-marker-removed"):
 *     rewardMarker УБРАН ЦЕЛИКОМ из dvor-roulette-screen.js — это был отладочный
 *     калибровочный маркер (красная точка d=12 поверх стрелки после каждого спина),
 *     не нужный в проде. См. tests/roulette-cup-row-layout-and-reward-marker-removed.test.js —
 *     тот тест теперь фиксирует его отсутствие. Этот файл обновлён, чтобы не противоречить
 *     тому фиксу: маркера в dvor-roulette-screen.js больше нет, проверяем это здесь тоже.
 *     Генерический механизм `_uDraggable` в universal_pos_editor.js остался — используется
 *     другими объектами (например winnerPhotoSpr), поэтому Test 2 по-прежнему актуален.
 *
 * Run: node tests/roulette-reward-marker.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const screenSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8'
);
const editorSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);

// ── Test 1: rewardMarker убран целиком (26.09.2026) — ни создания, ни ссылок ──
console.log('\nTest 1: rewardMarker удалён из dvor-roulette-screen.js целиком (батч 26.09.2026)');
{
    assert(!/rewardMarker/.test(screenSrc), 'ни создания, ни использования rewardMarker в файле больше нет');
    assert(!/this\._roulRewardMarker/.test(screenSrc), 'ссылка this._roulRewardMarker больше нигде не хранится/не читается');
    assert(!/wheelSpr\.addChild\(rewardMarker\);/.test(screenSrc),
        'не добавляется в wheelSpr (старый баг — крутился бы вместе с колесом)');
}

// ── Test 2: универсальный редактор учитывает _uDraggable в хит-тесте ─────────
console.log('\nTest 2: _uFindTopmost считает _uDraggable===true целью наравне со Sprite/Text');
{
    assert(/child instanceof PIXI\.Sprite \|\| child instanceof PIXI\.Text \|\| child\._uDraggable === true/.test(editorSrc),
        'условие типа объекта расширено до Sprite || Text || _uDraggable===true');
}

// ── Test 3: _animRouletteWheel не трогает никакой маркер (убран) и не считает по углу сектора ──
console.log('\nTest 3: _animRouletteWheel не ссылается на rewardMarker и не двигает точку по кругу');
{
    const m = screenSrc.match(/proto\._animRouletteWheel = function\(targetIdx, onComplete\)\{([\s\S]*?)\n\s{8}\}/);
    assert(!!m, '_animRouletteWheel найден');
    if (m) {
        const body = m[1];
        assert(!/_roulRewardMarker/.test(body), 'больше не ссылается на удалённый this._roulRewardMarker');
        assert(!/150 \* Math\.cos\(angle\)/.test(body) && !/150 \* Math\.sin\(angle\)/.test(body),
            'больше НЕТ вычисления позиции по радиусу/углу сектора (старый баг вращения маркера вместе с колесом)');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
