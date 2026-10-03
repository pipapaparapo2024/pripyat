/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт) — "я растягиваю жёлтые квадратики
 * (ручки resize), и не могу убрать растяжение, отпустить мышь не получается, толкаю бесконечно,
 * ничего больше не тыкается".
 *
 * Корень бага: ручка (h) и cap (полноэкранный перехватчик кликов) — СОСЕДИ в root, не
 * родитель/потомок. pointerdown на ручке находит её как топ-хит, cap.onDown вообще не получает
 * этот pointerdown → cap не начинает отслеживать этот указатель → его pointerup/pointerupoutside
 * для ЭТОГО перетаскивания не сработают. Если пользователь отпускает мышь, пока курсор ещё физически
 * над ручкой (частый случай при resize — ручка маленькая, 9x9px) — событие release попадает на
 * саму ручку, а не на cap, а у ручки не было обработчика pointerup — событие проглатывается,
 * _uResizeDrag остаётся висеть навсегда.
 *
 * Фикс: у каждой ручки свой pointerup/pointerupoutside (тот же общий proto._uEndResize, что и у
 * cap), плюс доп. защита — повторный pointerdown по ЛЮБОЙ ручке, пока резайз уже идёт, гасит его
 * вместо запуска нового (явно запрошено пользователем как страховка).
 *
 * Run: node tests/pos-editor-resize-handle-stuck-drag-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');

console.log('\nTest 1: proto._uEndResize — общая точка остановки резайза, переиспользуемая cap и ручками');
{
    assert(/proto\._uEndResize = function\(\)\{\s*\n\s*this\._uResizeDrag = null;\s*\n\s*\};/.test(src),
        '_uEndResize() определён и просто обнуляет _uResizeDrag');
}

console.log('\nTest 2: cap.onUp использует общий _uEndResize (не дублирует логику инлайн)');
{
    assert(/const onUp = \(\) => \{ this\._uDrag = null; this\._uEndResize\(\); \};/.test(src),
        'onUp (pointerup/pointerupoutside на cap) вызывает this._uEndResize()');
}

console.log('\nTest 3: каждая ручка (handle) сама подписана на pointerup/pointerupoutside — не только cap');
{
    const start = src.indexOf('proto._uCreateHandles = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(/h\.on\('pointerup', \(\) => this\._uEndResize\(\)\);/.test(body),
        'ручка подписана на pointerup — release прямо над ручкой (частый случай, ручка маленькая) теперь тоже гасит резайз');
    assert(/h\.on\('pointerupoutside', \(\) => this\._uEndResize\(\)\);/.test(body),
        'ручка подписана и на pointerupoutside — на случай release чуть мимо самой ручки');
}

console.log('\nTest 4: повторный pointerdown по ручке, пока резайз уже активен, ОСТАНАВЛИВАЕТ его вместо запуска нового');
{
    const start = src.indexOf('proto._uCreateHandles = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(/if\(this\._uResizeDrag\)\{ this\._uEndResize\(\); return; \}/.test(body),
        'pointerdown на ручке проверяет активный _uResizeDrag ПЕРЕД стартом нового и гасит его вместо повторного _uStartResize (явная страховка по прямому указанию)');
    // Порядок важен: проверка должна идти ДО вызова _uStartResize, иначе он всегда перезапишет драг.
    const stopIdx  = body.indexOf('if(this._uResizeDrag){ this._uEndResize(); return; }');
    const startIdx = body.indexOf('this._uStartResize(def.type, e);');
    assert(stopIdx !== -1 && startIdx !== -1 && stopIdx < startIdx,
        'проверка активного резайза стоит РАНЬШЕ вызова _uStartResize в теле обработчика');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
