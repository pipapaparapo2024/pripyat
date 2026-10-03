/**
 * Test: 2 правки со скриншотов.
 *
 * 1) Компас загрузки (#_clo) — стрелка сдвинута вниз на 3px и вправо на 2px
 *    (было top:calc(24.1% + 4px), left:calc(6.4%) → стало +7px / +2px).
 *
 * 2) Кнопка в dev-панели "100 УР. ВСЕ" — выставляет 100 уровень сразу во всех
 *    4 дворовых играх (покер/карты/зарики/рулетка). Покер использует переменную
 *    шкалу опыта (нужен большой запас exp), остальные — простую "10 очков/уровень,
 *    максимум 100" (exp=1000 гарантированно даёт level 100).
 *
 * Run: node tests/dev-panel-max-dvor-levels.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const htmlSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'development', 'index.html'), 'utf-8');
const devSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

// 24.09.2026 (по прямому указанию — "убери с загрузки компас, он не нужен"): картинка
// компаса со стрелкой (и вся её калибровка top/left из этого теста) убрана из index.html
// целиком — #_clo теперь плоский чёрный оверлей без вложенной стрелки. Test 1 (калибровка
// стрелки) больше не имеет объекта проверки — заменён на регресс-гвард "стрелки там больше
// нет". Подробности — compass-aspect-ratio.test.js.
console.log('\nTest 1: компас со стрелкой убран из index.html целиком (регресс-гвард)');
{
    assert(!/top:calc\(24\.1% \+ 7px\)/.test(htmlSrc), 'калибровка стрелки компаса не осталась в разметке — сама стрелка убрана');
}

console.log('\nTest 2: кнопка "100 УР. ВСЕ" в dev-панели выставляет 100 уровень во всех дворовых играх');
{
    assert(/action:\(\)=>this\._maxDvorLevels\(\)/.test(devSrc), 'кнопка вызывает _maxDvorLevels()');
    const m = devSrc.match(/proto\._maxDvorLevels = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_maxDvorLevels определён');
    if(m){
        const body = m[1];
        assert(/dvor\._data\.poker\.exp\s*=\s*100000;/.test(body), 'покеру — большой запас exp (переменная шкала по брекетам)');
        assert(/dvor\._data\.cards\.exp\s*=\s*1000;/.test(body), 'картам — exp=1000 (10/уровень × 100)');
        assert(/dvor\._data\.dice\.exp\s*=\s*1000;/.test(body), 'зарикам — exp=1000');
        assert(/dvor\._data\.roulette\.exp\s*=\s*1000;/.test(body), 'рулетке — exp=1000');
        assert(/dvor\._saveData\(\);/.test(body), 'сохраняет в this._data (udata.dvor_games_data)');
        assert(/saveDevChanges\(\);/.test(body), 'отправляет изменения на сервер (как остальные dev-читы)');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
