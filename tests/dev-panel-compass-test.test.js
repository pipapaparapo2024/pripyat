/**
 * Test: кнопка «Компас загрузки → ПОКАЗАТЬ» в DEV-панели — показывает #_clo (тот же
 * оверлей, что при реальной загрузке игры) бесконечно, без авто-скрытия, для проверки
 * вёрстки/анимации. Кнопка «СТОП» — обычный DOM-элемент с z-index выше #_clo (9999),
 * закрывает компас и убирает сама себя.
 *
 * По прямой просьбе: #_clo обычно перехватывает ВСЕ клики (pointer-events:all) — это
 * мешало кнопке редактора позиций (✥, всегда в углу канваса) быть кликабельной поверх
 * теста компаса. На время теста pointer-events снимается (клики идут насквозь к канвасу),
 * восстанавливается по кнопке «СТОП».
 *
 * Run: node tests/dev-panel-compass-test.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8'
);

console.log('\nTest 1: секция "ТЕСТ UI" с кнопкой вызывает _testCompass()');
{
    assert(/_section\('ТЕСТ UI'\);/.test(src), 'секция добавлена');
    assert(/action:\(\)=>this\._testCompass\(\)/.test(src), 'кнопка вызывает this._testCompass()');
}

console.log('\nTest 2: _testCompass показывает компас бесконечно + кнопку СТОП с z-index выше #_clo');
{
    const m = src.match(/proto\._testCompass = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_testCompass найден');
    if (m) {
        const body = m[1];
        assert(/this\._compassShow\(\);/.test(body), 'вызывает общий _compassShow() (тот же оверлей, что при реальной загрузке)');
        assert(/if\(this\._testCompassStopBtn\) return;/.test(body), 'не создаёт вторую кнопку СТОП, если уже показана');
        assert(/z-index:10000;/.test(body), 'z-index кнопки СТОП (10000) выше z-index #_clo (9999) — иначе кнопка была бы под оверлеем и не кликалась');
        assert(/btn\.onclick = \(\) => \{/.test(body), 'обработчик клика назначен');
    }
    assert(/this\._compassHide\(\);/.test(src), 'кнопка СТОП скрывает компас через тот же _compassHide()');
    assert(/if\(btn\.parentNode\) btn\.parentNode\.removeChild\(btn\);/.test(src), 'кнопка СТОП удаляет сама себя из DOM после клика');
}

console.log('\nTest 3: #_clo пропускает клики к канвасу на время теста (кнопка редактора остаётся кликабельной)');
{
    const m = src.match(/proto\._testCompass = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_testCompass найден');
    if (m) {
        const body = m[1];
        assert(/_cloEl\.style\.pointerEvents = 'none';/.test(body),
            'pointer-events снимается с #_clo при показе — иначе полноэкранный оверлей блокирует клик по кнопке ✥');
        assert(/_cloEl\.style\.pointerEvents = '';/.test(body),
            'pointer-events возвращается обратно по кнопке «СТОП»');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
