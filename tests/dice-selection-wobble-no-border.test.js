/**
 * Test: батч 25.09.2026 (по прямому указанию — "убери жёлтую рамку у выбранного кубика,
 * сделай так, чтобы кубик менялся при нажатии") — уточнено вопросом: вместо статичной жёлтой
 * рамки-обводки выбранный кубик получает лёгкое бесконечное покачивание (gsap, ±0.12 рад
 * туда-обратно), снятое при снятии выделения/переброске/резолве.
 *
 * Run: node tests/dice-selection-wobble-no-border.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const screenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const gameSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');

console.log('\n1) Жёлтая рамка-обводка убрана целиком из dvor-dice-screen.js');
{
    assert(!/lineStyle\(3, 0xffff00\)/.test(screenSrc), 'lineStyle(3, 0xffff00) (жёлтая обводка) больше не создаётся');
    assert(!/_diceDiceBorders\.push/.test(screenSrc), 'массив бордеров больше не заполняется спрайтами');
}

console.log('\n2) Ни один из 6 старых мест переключения рамки не остался нетронутым');
{
    assert(!/_diceDiceBorders\[.*?\]\.visible/.test(gameSrc), 'ни одного обращения к _diceDiceBorders[i].visible не осталось в dvor-dice-game.js');
}

console.log('\n3) _diceSelectAnim/_diceDeselectAnim определены и используются во всех точках жизненного цикла выбора');
{
    assert(/proto\._diceSelectAnim = function\(idx\)\{/.test(gameSrc), '_diceSelectAnim определён');
    assert(/proto\._diceDeselectAnim = function\(idx\)\{/.test(gameSrc), '_diceDeselectAnim определён');

    const toggleStart = gameSrc.indexOf('proto._toggleDiceSwap = function');
    const toggleEnd   = gameSrc.indexOf('\n    };', toggleStart);
    const toggleBody  = gameSrc.slice(toggleStart, toggleEnd);
    assert(/this\._diceDeselectAnim\(i\);/.test(toggleBody), '_toggleDiceSwap: снятие выделения со всех кубиков через _diceDeselectAnim');
    // 26.09.2026: повторный клик по уже выбранному кубику больше не снимает выбор — сразу
    // перебрасывает его (см. dice-die-click-twice-rerolls.test.js), поэтому ветка ниже
    // всегда select, без else-deselect (та ветка теперь недостижима — до неё не доходит).
    assert(/this\._diceSelected\[idx\] = true;\s*\n\s*this\._diceSelectAnim\(idx\);/.test(toggleBody),
        '_toggleDiceSwap: выбор кубика запускает анимацию покачивания (_diceSelectAnim)');

    assert((gameSrc.match(/this\._diceDeselectAnim\(/g) || []).length >= 5,
        'снятие анимации вызывается во всех сценариях — бросок/переброска (успех и ошибка)/резолв (не только в toggle)');
}

console.log('\n4) _diceSelectAnim реально запускает бесконечный gsap-тween покачивания, killTweensOf перед стартом');
{
    const start = gameSrc.indexOf('proto._diceSelectAnim = function');
    const end   = gameSrc.indexOf('\n    };', start);
    const body  = gameSrc.slice(start, end);
    assert(/gsap\.killTweensOf\(spr\)/.test(body), 'убивает предыдущий tween перед стартом нового (не копит дубликаты при повторных кликах)');
    assert(/repeat:\s*-1/.test(body), 'бесконечный повтор (repeat:-1) — покачивание длится, пока кубик выбран');
    assert(/yoyo:\s*true/.test(body), 'yoyo:true — покачивание туда-обратно, а не однонаправленный поворот');
}

console.log('\n5) _diceDeselectAnim реально останавливает tween и возвращает поворот в 0');
{
    const start = gameSrc.indexOf('proto._diceDeselectAnim = function');
    const end   = gameSrc.indexOf('\n    };', start);
    const body  = gameSrc.slice(start, end);
    assert(/\.kill\(\)/.test(body), 'останавливает сохранённый tween через .kill()');
    assert(/spr\.rotation = 0;/.test(body), 'поворот кубика возвращается в 0 (не остаётся перекошенным после снятия выбора)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
