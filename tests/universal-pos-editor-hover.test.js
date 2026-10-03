/**
 * Test: подсветка объекта под курсором в универсальном редакторе позиций.
 *
 * Раньше пользователь узнавал, какой объект схвачен, только ПОСЛЕ клика (по подписи
 * в readout-панели) — не было визуальной подсказки при наведении, из-за чего было
 * непонятно, что именно будет двигаться, до самого клика.
 *
 * Фикс: отдельная Graphics-рамка (_uHoverBox), которая на каждый pointermove (когда
 * ничего не тащим) обводит объект, найденный тем же hit-тестом (_uFindTopmost), что
 * и обычный drag — то есть подсветка гарантированно совпадает с тем, что реально
 * схватится по клику. Во время самого драга рамка следует за перетаскиваемым объектом.
 *
 * Run: node tests/universal-pos-editor-hover.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);

// ── Test 1: рамка-подсветка создаётся вместе с остальным UI редактора ───────
console.log('\nTest 1: _uHoverBox создаётся в _enableUniversalEdit и живёт в root');
{
    assert(/const hoverBox = new PIXI\.Graphics\(\);/.test(src), 'hoverBox создан как Graphics');
    assert(/hoverBox\.visible = false;/.test(src), 'изначально скрыт (пока нет наведения)');
    assert(/root\.addChild\(hoverBox\);/.test(src), 'добавлен в root (тот же слой, что кнопка/readout/capture)');
    assert(/this\._uHoverBox = hoverBox;/.test(src), 'сохранён как this._uHoverBox');
}

// ── Test 2: onMove подсвечивает объект под курсором, когда НЕ тащим ─────────
console.log('\nTest 2: pointermove без активного drag вызывает hit-test и подсвечивает результат');
{
    const m = src.match(/const onMove = \(e\) => \{([\s\S]*?)\n\s{8}\};/);
    assert(!!m, 'onMove найден');
    if (m) {
        const body = m[1];
        assert(/const found = this\._uFindTopmost\(g\.x, g\.y\);[\s\S]*?this\._uUpdateHoverBox\(found\);/.test(body),
            'без drag — подсвечивает то, что вернул тот же _uFindTopmost, что и обычный клик-хит-тест');
        assert(/if\(this\._uDrag\)\{[\s\S]*?this\._uUpdateHoverBox\(obj\);/.test(body),
            'во время drag — рамка следует за перетаскиваемым объектом (obj), а не пересчитывается заново');
    }
}

// ── Test 3: _uUpdateHoverBox рисует рамку по getBounds() найденного объекта ─
console.log('\nTest 3: _uUpdateHoverBox рисует/скрывает рамку корректно');
{
    const m = src.match(/proto\._uUpdateHoverBox = function\(obj\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uUpdateHoverBox определён');
    if (m) {
        const body = m[1];
        assert(/if\(!obj\)\{/.test(body) && /this\._uHoverBox\.visible = false;/.test(body),
            'при отсутствии объекта под курсором рамка скрывается (не остаётся висеть на старом месте)');
        assert(/const b = obj\.getBounds\(\);/.test(body), 'использует getBounds() найденного объекта');
        assert(/this\._uHoverBox\.drawRect\(b\.x, b\.y, b\.width, b\.height\);/.test(body),
            'рамка рисуется точно по границам объекта');
        assert(/this\._uHoverBox\.visible = true;/.test(body), 'рамка становится видимой при наведении');
    }
}

// ── Test 4: рамка исключена из собственного hit-теста (не мешает выбору) ────
console.log('\nTest 4: _uFindTopmost игнорирует саму рамку-подсветку');
{
    assert(/child === this\._uHoverBox/.test(src), 'hoverBox добавлен в список исключений hit-теста');
}

// ── Test 5: рамка убирается при выключении режима редактора ─────────────────
console.log('\nTest 5: _disableUniversalEdit удаляет рамку и чистит ссылки');
{
    const m = src.match(/proto\._disableUniversalEdit = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_disableUniversalEdit найден');
    if (m) {
        const body = m[1];
        assert(/if\(this\._uHoverBox && this\._uHoverBox\.parent\) this\._uHoverBox\.parent\.removeChild\(this\._uHoverBox\);/.test(body),
            'рамка удаляется из дерева при выключении режима');
        assert(/this\._uHoverBox = null; this\._uHovered = null;/.test(body),
            'ссылки на рамку и текущий hover сбрасываются');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
