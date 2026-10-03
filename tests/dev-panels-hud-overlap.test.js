/**
 * Test: панель МЕНЮ РАЗРАБОТЧИКА перекрывалась верхним HUD.
 *
 * Баг: _openDevPanel() специально поднимает iface.up (верхний HUD, y=0-58) поверх
 * окна панели — чтобы во время читов был виден баланс ресурсов. Но панель
 * центрировалась обычной формулой (720-PH)/2, из-за чего заголовок, крестик
 * закрытия и кнопка «МИЛЛИОН ВСЕГО» попадали в зону y<58 — HUD рисовался поверх
 * них и перехватывал клики: кнопки были не видны И физически не нажимались.
 *
 * (Панель «ПРЕВЬЮ ПОПАПОВ», у которой был тот же баг, была впоследствии удалена
 * и заменена универсальным редактором позиций — см. tests/universal-pos-editor.test.js)
 *
 * Фикс: PY зафиксирован ниже HUD (изначально 62), а не вычисляется центрированием.
 *
 * PY впоследствии подняли до 132 (+70px), а затем опустили обратно до 82 (-50px) —
 * обе правки по прямой просьбе пользователя. Также по просьбе панель больше не отдаёт
 * verhний HUD (iface.up) поверх себя при открытии — теперь панель строго выше ВСЕХ
 * слоёв, включая верхний HUD (раньше HUD специально переподнимался, чтобы читер видел
 * баланс поверх панели).
 *
 * Run: node tests/dev-panels-hud-overlap.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const devPanelSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

const HUD_H = 58; // y=0-58 — зона верхнего HUD (см. CLAUDE.md "HUD-зоны")
const CANVAS_H = 720;

function extractPY_PH(src, label) {
    const pyMatch = src.match(/const PY = (\d+);/);
    const phMatch = src.match(/PH = (\d+);/);
    assert(!!pyMatch, `${label}: PY найден как константа (не формула центрирования)`);
    assert(!!phMatch, `${label}: PH найден`);
    return { py: pyMatch ? +pyMatch[1] : null, ph: phMatch ? +phMatch[1] : null };
}

// 15.09.2026 (позже этого батча): PY поднят ЕЩЁ на 40px (82 → 42) по прямой просьбе — это
// СНОВА заводит верхние элементы панели в зону y<58 (высота HUD). Но это больше не проблема:
// Test 1b ниже фиксирует, что _openDevPanel() перестал переподнимать iface.up поверх окна
// панели — сама панель теперь топ-слой (root.layer2_mc, добавлена последней), поэтому HUD
// физически рисуется ПОД ней и не может ни визуально перекрыть, ни перехватить клики,
// независимо от Y-координаты. Изначальный инвариант "элементы обязаны быть НИЖЕ HUD по Y"
// закрыт другим механизмом (порядок слоёв), а не Y-позицией — поэтому здесь больше не
// требуется py >= HUD_H.
console.log('\nTest 1: dev_panel.js (МЕНЮ РАЗРАБОТЧИКА) не перекрывается HUD');
{
    const { py, ph } = extractPY_PH(devPanelSrc, 'dev_panel.js');
    assert(py === 42, `PY (${py}) === 42 — итоговая позиция после +70px, затем -50px, затем ещё +40px по прямым просьбам`);
    assert(!/const PY = Math\.round\(\(720/.test(devPanelSrc), 'больше не центрируется формулой (720-PH)/2');
}

// ── Test 1b: панель выше ВСЕХ слоёв, включая верхний HUD (iface.up) ───────────
console.log('\nTest 1b: _openDevPanel больше не поднимает HUD поверх панели');
{
    const m = devPanelSrc.match(/proto\._openDevPanel = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_openDevPanel найден');
    if (m) {
        assert(!/root\.layer2_mc\.addChild\(this\.up\);/.test(m[1]),
            'больше не переподнимает iface.up после добавления окна панели — панель остаётся топ-слоем');
    }
}

// ── Test 2: верхние элементы (title/close/million) остаются кликабельны, т.к. панель — топ-слой ──
// PY=42 снова заводит эти элементы в зону y<58 (см. комментарий у Test 1) — они видны и
// кликабельны не потому, что находятся НИЖЕ HUD по Y, а потому что панель рисуется ВЫШЕ HUD
// по слоям (Test 1b). Здесь просто фиксируем сами смещения (+10/+12 от PY), не сравнивая с HUD_H.
console.log('\nTest 2: заголовок и кнопки dev_panel.js — смещения от PY не изменились (10/12px)');
{
    assert(/closeG\.y = PY \+ 10;/.test(devPanelSrc), 'closeG.y = PY + 10 (крестик закрытия)');
    assert(/\.y = PY \+ 12;/.test(devPanelSrc), 'title/million.y = PY + 12');
}

// ── Test 3: кнопка "ПОПАПЫ" удалена из dev_panel.js (заменена универсальным редактором) ──
console.log('\nTest 3: кнопка ПОПАПЫ убрана из dev_panel.js');
{
    assert(!/ПОПАПЫ/.test(devPanelSrc), 'больше нет кнопки "ПОПАПЫ" в dev_panel.js');
    assert(!/_openDevPopupsPanel/.test(devPanelSrc), 'нет вызова _openDevPopupsPanel (файл dev_popups.js удалён)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
