/**
 * Test: подсветка выигранной строки в зариках раньше гасла сама через ~3 секунды (gsap-
 * таймлайн затухания до alpha:0/invisible, либо setTimeout-фолбэк). По прямому указанию —
 * должна оставаться видна до момента, пока игрок не нажмёт БРОСИТЬ (новая партия), а не
 * исчезать по таймеру.
 *
 * 20.10.2026: подсветка переведена с ОДНОГО переиспользуемого Graphics на 18 независимых
 * маркеров (_diceComboHighlights, см. tests/dice-poker-bj-combo-highlight-editor-markers.
 * test.js) — этот файл обновлён под новую структуру (markers[idx] вместо одной переменной h),
 * поведение (нет авто-гашения по таймеру) не менялось.
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
        assert(!/setTimeout\(\(\)=>\{ m\.visible = false; \}, 3000\);/.test(body), 'setTimeout-фолбэк на 3 сек не добавлен');
        assert(!/alpha:0, duration:0\.5, delay:1\.2/.test(body), 'gsap-затухание до alpha:0 убрано');
        assert(/\.to\(m, \{alpha:1, duration:0\.3\}\);/.test(body), 'пульс при появлении оканчивается на alpha:1 (не на invisible)');
        assert(/m\.visible = active;/.test(body), 'при показе каждый маркер получает видимость по своему индексу (active/не active)');
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
        // 20.10.2026: прямое обращение к this._diceComboHighlight (один объект) заменено общим
        // хелпером _diceHideComboHighlight() — см. tests/dice-poker-bj-combo-highlight-editor-
        // markers.test.js для проверки самого хелпера.
        assert(/this\._diceHideComboHighlight === 'function'\) this\._diceHideComboHighlight\(\);/.test(body),
            'явно скрывает подсветку старой партии при старте новой через _diceHideComboHighlight()');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
