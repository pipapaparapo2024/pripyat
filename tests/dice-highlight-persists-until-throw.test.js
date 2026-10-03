/**
 * Test: подсветка выигранной строки в зариках раньше гасла сама через ~3 секунды (gsap-
 * таймлайн затухания до alpha:0/invisible, либо setTimeout-фолбэк). По прямому указанию —
 * должна оставаться видна до момента, пока игрок не нажмёт БРОСИТЬ (новая партия), а не
 * исчезать по таймеру.
 *
 * Run: node tests/dice-highlight-persists-until-throw.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const screenSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8'
);
const gameSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8'
);

console.log('\nTest 1: _diceShowComboHighlight больше не гасит себя по таймеру');
{
    const m = screenSrc.match(/proto\._diceShowComboHighlight = function\(rowIndex\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_diceShowComboHighlight найден');
    if(m){
        const body = m[1];
        assert(!/setTimeout\(\(\)=>\{ h\.visible = false; \}, 3000\);/.test(body), 'setTimeout-фолбэк на 3 сек убран');
        assert(!/alpha:0, duration:0\.5, delay:1\.2/.test(body), 'gsap-затухание до alpha:0 убрано');
        assert(/\.to\(h, \{alpha:1, duration:0\.3\}\);/.test(body), 'пульс при появлении оканчивается на alpha:1 (не на invisible)');
        assert(/h\.visible = true;/.test(body), 'при успешном показе строка становится видимой');
    }
}

// 18.09.2026: перенос экономики на сервер убрал this._loadDaily()/локальную проверку
// стоимости из начала _playDiceNewScreen (теперь это делает dice.php.start()) — граница
// куска теста сдвинута на следующий реальный маркер (старт запроса к серверу).
console.log('\nTest 2: _playDiceNewScreen (кнопка БРОСИТЬ) явно гасит подсветку перед новым броском');
{
    const m = gameSrc.match(/proto\._playDiceNewScreen = function\(\)\{([\s\S]*?)\n        this\._diceStarting = true;/);
    assert(!!m, 'начало _playDiceNewScreen (до запроса к серверу) найдено');
    if(m){
        const body = m[1];
        assert(/if\(this\._diceComboHighlight\)\{/.test(body), 'проверяет наличие объекта подсветки');
        assert(/gsap\.killTweensOf\(this\._diceComboHighlight\);/.test(body), 'останавливает любой текущий твин пульса перед гашением');
        assert(/this\._diceComboHighlight\.visible = false;/.test(body), 'явно скрывает подсветку старой партии при старте новой');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
