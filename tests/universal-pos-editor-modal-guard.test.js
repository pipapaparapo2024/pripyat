/**
 * Test: универсальный редактор позиций не должен "пробивать" открытый модальный
 * экран (попап/оверлей в layer2_mc) насквозь до HUD (layer1_mc) или игрового мира
 * (layer0_mc).
 *
 * История бага: у КАЖДОГО оверлея в проекте (боёвка с боссом, покер, рулетка и т.д.)
 * по стандартной конвенции (см. CLAUDE.md, "Паттерн нового PIXI-экрана") первым
 * добавляется полноэкранный interactive PIXI.Graphics-"blocker" 1280×720. Обычный
 * геометрический хит-тест (_uFindTopmost) искал только среди Sprite/Text — сам
 * blocker невидим для него (это Graphics без _uDraggable). Если курсор попадал на
 * участок экрана, где среди Sprite/Text ЭТОГО оверлея совпадения не находилось
 * (например, между объектами, или у самого фона оверлея почему-то не совпали
 * границы), поиск проваливался ДАЛЬШЕ — в HUD и игровой мир — и находил там
 * элементы СКРЫТОГО ПОЗАДИ экрана (конкретно так был утащен фон главного меню
 * "home_elements_atlas_1.png" из-под открытого окна боя с боссом).
 *
 * Фикс: _uFindTopmost сначала проверяет layer2_mc как раньше; если там ничего не
 * найдено СРЕДИ Sprite/Text, но при этом где-то в layer2_mc есть открытый
 * полноэкранный interactive Graphics (то есть модальный экран технически открыт) —
 * поиск останавливается и возвращает null, не пробиваясь в layer1_mc/layer0_mc.
 * Если модалки нет вообще (обычный базовый экран без оверлея) — поведение не
 * меняется, редактор по-прежнему может достать элементы HUD/игрового мира.
 *
 * Run: node tests/universal-pos-editor-modal-guard.test.js
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

console.log('\nTest 1: _uFindAllAt не идёт в layer1/layer0, если в layer2 открыт модальный blocker');
{
    // 16.09.2026: логика хит-теста вынесена из _uFindTopmost в _uFindAllAt (нужен полный
    // список кандидатов под курсором для Shift+клика по наложенным объектам,
    // см. achievement-timing-editor-shift-and-keys-digit.test.js) — _uFindTopmost теперь
    // просто берёт первый элемент из _uFindAllAt. Поведение модал-гвардии не изменилось,
    // только переехало в другую функцию.
    const m = src.match(/proto\._uFindAllAt = function\(gx, gy\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uFindAllAt найден');
    if (m) {
        const body = m[1];
        assert(/const l2 = this\._uCollectAt\(root\.layer2_mc, gx, gy, \[\]\);/.test(body), 'сначала как раньше ищет в layer2_mc');
        assert(/if\(l2\.length\) return l2;/.test(body), 'если нашли в layer2_mc — сразу возвращаем (поведение не изменилось)');
        assert(/if\(this\._uHasFullscreenBlocker\(root\.layer2_mc\)\) return \[\];/.test(body),
            'если в layer2_mc есть полноэкранный blocker (модалка открыта) — дальше НЕ ищем, возвращаем []');
        assert(/return this\._uCollectAt\(root\.layer1_mc, gx, gy, \[\]\)\.concat\(this\._uCollectAt\(root\.layer0_mc, gx, gy, \[\]\)\);/.test(body),
            'без модалки (blocker не найден) — как раньше проверяем layer1_mc/layer0_mc');
    }

    const m2 = src.match(/proto\._uFindTopmost = function\(gx, gy\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m2, '_uFindTopmost найден');
    if(m2) assert(/return all\.length \? all\[0\] : null;/.test(m2[1]), '_uFindTopmost делегирует в _uFindAllAt и берёт первый элемент');
}

console.log('\nTest 2: _uHasFullscreenBlocker находит видимый interactive Graphics на весь канвас, рекурсивно');
{
    const m = src.match(/proto\._uHasFullscreenBlocker = function\(node\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uHasFullscreenBlocker найден');
    if (m) {
        const body = m[1];
        assert(/node\.visible === false/.test(body), 'пропускает невидимые ветки (скрытый экран — не модалка)');
        assert(/child instanceof PIXI\.Graphics && child\.interactive/.test(body),
            'ищет именно interactive Graphics — соответствует стандартному "blocker" паттерну проекта');
        assert(/b\.width >= 1270 && b\.height >= 710/.test(body),
            'порог близкий к 1280×720 (с запасом на округления bounds)');
        assert(/this\._uHasFullscreenBlocker\(child\)/.test(body), 'рекурсивно проверяет вложенные контейнеры (win внутри layer2_mc)');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
