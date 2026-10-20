/**
 * Test: рамка "что выиграл игрок" (покер/блэкджек/зарики) в прошлом имела две проблемы при
 * работе с универсальным редактором позиций:
 *
 * 1) Автоскрытие через ~3 секунды (gsap-таймлайн затухания / setTimeout-фолбэк) не давало
 *    спокойно выделить и подвинуть рамку. Проверка iface._uEditOn перед запуском твина
 *    чинит случай "открыл редактор → сыграл → рамка появилась" — но НЕ чинит случай
 *    "рамка уже гасла (твин уже идёт) → в этот момент включили редактор": проверка на
 *    старте функции тут не помогает, твин уже был запущен раньше. Поэтому
 *    universal_pos_editor.js._uScanForceActive() (уже существующий периодический скан,
 *    500мс, пока режим включён) ТАКЖЕ добивает: останавливает уже идущий твин и
 *    возвращает alpha=1 любому видимому объекту с флагом _uDraggable.
 *
 * 2) PageUp/PageDown (масштаб через редактор) не давал НАГЛЯДНО уменьшить рамку — пивот
 *    масштабирования стоял в (0,0) экрана (объект никогда не имел собственных x/y),
 *    далеко от самой нарисованной рамки.
 *
 * 20.10.2026 (по прямому указанию — "каждое выпадение комбинации имеет координаты 0,0,
 * сделай координаты относительно всей плоскости / покажи все варианты в редакторе"):
 * архитектура сменилась с "ОДИН переиспользуемый Graphics, перерисовываемый/переставляемый
 * под каждый вызов _xShowComboHighlight" на "N независимых маркеров, каждый с собственной
 * ФИКСИРОВАННОЙ позицией и формой, заданными один раз при постройке экрана" — теперь
 * _xShowComboHighlight только переключает visible/alpha, не position/draw. Этот файл
 * переписан под новую структуру — см. tests/dice-poker-bj-combo-highlight-editor-markers.
 * test.js для полной проверки самих маркеров и show-all/restore хуков редактора.
 *
 * Run: node tests/combo-highlight-stays-in-editor.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const dvorDir = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const cases = [
    { file: 'dvor-poker-screen.js',  fn: '_pokerShowComboHighlight', label: 'Покер',    autoHide: true },
    { file: 'dvor-blackjack.js',     fn: '_bjShowComboHighlight',    label: 'Блэкджек', autoHide: false },
    { file: 'dvor-dice-screen.js',   fn: '_diceShowComboHighlight',  label: 'Зарики',   autoHide: false },
];

for(const {file, fn, label, autoHide} of cases){
    console.log(`\nTest: ${label} (${fn})`);
    const src = fs.readFileSync(path.join(dvorDir, file), 'utf-8');
    const re = new RegExp(`proto\\.${fn} = function\\([^)]*\\)\\{([\\s\\S]*?)\\n    \\};`);
    const m = src.match(re);
    assert(!!m, `${fn} найден`);
    if(m){
        const body = m[1];
        if(autoHide){
            assert(/if\(window\.iface && iface\._uEditOn\) return;/.test(body),
                'проверяет iface._uEditOn и выходит раньше автоскрытия');
        } else {
            // Автоскрытие по таймеру после успешного показа по-прежнему не допускается —
            // гашение теперь идёт явным общим хелпером (_bjHideComboHighlight/
            // _diceHideComboHighlight), не внутри самой show-функции.
            assert(!/setTimeout\(.*visible = false/.test(body),
                'НЕ прячет себя сама по таймеру (гасится явно извне, при старте новой партии)');
        }
        // 20.10.2026: позиция и форма рамки теперь задаются ОДИН раз при постройке экрана
        // (см. _buildXxxScreen/маркеры) — show-функция больше не вызывает position.set/
        // drawRoundedRect на каждый показ, только переключает visible/alpha.
        assert(!/\.position\.set\(/.test(body), 'show-функция не переставляет маркер (позиция фиксирована при постройке)');
        assert(!/drawRoundedRect\(/.test(body), 'show-функция не перерисовывает маркер (форма фиксирована при постройке)');
        assert(!/\.pivot\.set/.test(body), 'pivot не трогается');
    }
}

console.log('\nTest: universal_pos_editor._uScanForceActive добивает уже идущее затухание у _uDraggable-объектов');
{
    const src = fs.readFileSync(
        path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
    );
    const m = src.match(/proto\._uScanForceActive = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_uScanForceActive найден');
    if(m){
        const body = m[1];
        assert(/child\._uDraggable === true && child\.visible !== false/.test(body),
            'проверяет видимые объекты с флагом _uDraggable (рамки-подсветки)');
        assert(/gsap\.killTweensOf\(child\);/.test(body), 'останавливает уже запущенный gsap-твин затухания');
        assert(/child\.alpha = 1;/.test(body), 'возвращает полную непрозрачность каждый скан, пока редактор включён');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
