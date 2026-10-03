/**
 * Test: рамка "что выиграл игрок" (покер/блэкджек/зарики) имела две проблемы при работе
 * с универсальным редактором позиций:
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
 *    далеко от самой нарисованной рамки, поэтому "уменьшение" на деле почти незаметно
 *    сдвигало рамку к углу экрана вместо того чтобы красиво сжаться на месте. Фикс:
 *    position ставится в центр строки, прямоугольник рисуется в локальных координатах,
 *    центрированных на (0,0) — pivot остаётся дефолтным (0,0). ВАЖНО: первая версия
 *    этого фикса ошибочно ставила ЕЩЁ и h.pivot.set(cx,cy) в ту же точку — pivot и
 *    position при scale=1 взаимно гасят друг друга (screen = (local-pivot)+position =
 *    local, если pivot===position), из-за чего рамка рисовалась у экранного (0,0)
 *    вместо стола — подсветки не было видно вообще. pivot трогать не нужно.
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
// Зарики (15.09.2026, по прямому указанию) больше НЕ автоскрываются по таймеру вообще —
// подсветка висит до следующего броска (см. dice-highlight-persists-until-throw.test.js),
// поэтому проверка iface._uEditOn (нужна была только чтобы не мешать автоскрытию во время
// работы редактора) для зариков больше не применима — она осталась только у покера/блэкджека.
// multiRect (15.09.2026, зарики) — по прямому указанию "1,1 и 6,6 должно давать обе
// комбинации", _diceShowComboHighlight теперь принимает МАССИВ индексов и рисует по
// прямоугольнику на каждый (h.position остаётся (0,0), координаты — абсолютные), а не один
// прямоугольник, центрированный локально под h.position.set(cx,cy) — тот паттерн остался
// только у покера/блэкджека (там подсвечивается всегда ровно одна строка/линия).
const cases = [
    { file: 'dvor-poker-screen.js',  fn: '_pokerShowComboHighlight', label: 'Покер',   autoHide: true,  multiRect: false },
    { file: 'dvor-blackjack.js',     fn: '_bjShowComboHighlight',    label: 'Блэкджек',autoHide: false, multiRect: false },
    { file: 'dvor-dice-screen.js',   fn: '_diceShowComboHighlight',  label: 'Зарики',  autoHide: false, multiRect: true  },
];

for(const {file, fn, label, autoHide, multiRect} of cases){
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
            // h.visible=false ДОПУСТИМ только в guard-ветке невалидного rowIndex (нет подсветки
            // вовсе) — а не как часть автоскрытия по таймеру после успешного показа.
            assert(!/onComplete:\(\)=>\{ h\.visible = false; \}/.test(body) && !/setTimeout\(\(\)=>\{ h\.visible = false; \}/.test(body),
                'НЕ прячет себя сама по таймеру (гасится явно извне, при старте новой партии — см. _playDiceNewScreen)');
        }
        assert(!/h\.pivot\.set/.test(body),
            'pivot НЕ трогается (иначе гасит position при scale=1 — рамка рисуется у (0,0) экрана, не видна)');
        if(multiRect){
            assert(/h\.position\.set\(0, 0\);/.test(body), 'position держится в (0,0) — рамки рисуются в абсолютных координатах');
            assert(/indices\.forEach\(idx => \{/.test(body), 'рисует по прямоугольнику на КАЖДЫЙ индекс массива (несколько одновременных комбинаций)');
        } else {
            // 26.09.2026: покер перешёл с формулы (cx,cy) на прямую карту координат по строке
            // (COMBO_ROW_POS[combo] → pos.x/pos.y) — имя переменных здесь не важно, важно
            // только что позиция ставится ОДНИМ вызовом position.set (не x/y по отдельности,
            // что сломало бы симметрию масштаба вокруг центра). Блэкджек в тот же день избавился
            // от лишнего "+ BJ_ROW_W/2" в X (баг сдвига вправо на ~140px) — теперь тоже ставит
            // готовый центр напрямую (BJ_ROW_X, cy), без промежуточной переменной cx.
            assert(/h\.position\.set\((cx, cy|pos\.x, pos\.y|BJ_ROW_X, cy)\);/.test(body), 'позиция выставлена в центр строки — масштаб симметричен');
            // Имя переменных ширины/высоты может быть как общей константой (BJ_ROW_W/H —
            // поркер/зарики), так и локальной (w/rowH — блэкджек после nonpair-переопределения,
            // см. bj-nonpair-highlight-and-payment-domain.test.js) — важна только симметрия
            // относительно (0,0), не конкретное имя.
            assert(/drawRoundedRect\(-(\w+)\s*\/\s*2, -(\w+)\s*\/\s*2, \1, \2,/.test(body),
                'прямоугольник рисуется в локальных координатах, центрированных на (0,0) — под position-сдвиг');
        }
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
