/**
 * Test: батч 16.09.2026 —
 *  1) achievement.js — обычный (не dev-persistent) показ ачивки сокращён вдвое
 *     (0.3+3.0+0.5=3.8с → 0.15+1.5+0.25=1.9с) и больше НЕ закрывается тапом игрока
 *     (только persistent/dev-режим остаётся тап-закрываемым).
 *  2) zone.js — плавающий попап "+XP/+сигареты/+уважение" помечен _uDraggable, чтобы
 *     редактор позиций мог заморозить и открыть его для правки отдельных элементов.
 *  3) universal_pos_editor.js — Shift+клик выбирает объект ПОД тем, что лежит сверху
 *     (наложенные друг на друга элементы), с циклическим повтором в той же точке.
 *  4) bosses_select.js — счётчик ключей теперь просто цифра, без слова "КЛЮЧЕЙ".
 *
 * Run: node tests/achievement-timing-editor-shift-and-keys-digit.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const achSrc    = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'achievement.js'), 'utf-8');
const zoneSrc   = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8');
const editorSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');
const bossSelSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8');

console.log('\nTest 1: achievement.js — обычный показ сокращён вдвое (1.9с вместо 3.8с)');
{
    assert(/\.to\(win, \{alpha:1, duration:0\.15\}\)/.test(achSrc), 'фаза появления 0.15с (было 0.3)');
    assert(/\.to\(win, \{alpha:1, duration:1\.5\}\) \/\/ держим на экране/.test(achSrc), 'фаза удержания 1.5с (было 3.0)');
    assert(/\.to\(win, \{alpha:0, duration:0\.25, onComplete:_advance\}\)/.test(achSrc), 'фаза затухания 0.25с (было 0.5)');
    assert(/setTimeout\(_advance, 1900\);/.test(achSrc), 'fallback без gsap — 1900мс (было 3800)');
    assert(!/duration:3\.0/.test(achSrc) && !/setTimeout\(_advance, 3800\)/.test(achSrc), 'старые тайминги полностью убраны');
}

console.log('\nTest 2: achievement.js — обычный показ больше НЕ закрывается тапом, dev-режим — закрывается');
{
    const persistentIdx = achSrc.indexOf('if(persistent){');
    const elseIdx       = achSrc.indexOf('} else if(window.gsap){');
    assert(persistentIdx !== -1 && elseIdx !== -1, 'обе ветки (persistent / обычная) найдены');
    const persistentBody = achSrc.slice(persistentIdx, elseIdx);
    assert(/win\.on\('pointerdown'/.test(persistentBody), 'в persistent-ветке тап ПО-ПРЕЖНЕМУ закрывает попап');

    const elseBody = achSrc.slice(elseIdx, elseIdx + 700);
    assert(!/win\.on\('pointerdown'/.test(elseBody), 'в обычной ветке обработчик тапа НЕ навешивается');
}

console.log('\nTest 3: zone.js — floating-попап локации помечен _uDraggable для редактора');
{
    const idx = zoneSrc.indexOf('_showCpReward(xp, cig, resp){');
    assert(idx !== -1, '_showCpReward найден');
    const body = zoneSrc.slice(idx, idx + 700);
    assert(/win\._uDraggable = true;/.test(body), 'win._uDraggable=true сразу после создания контейнера');
}

console.log('\nTest 4: universal_pos_editor.js — Shift+клик выбирает объект под наложенным');
{
    assert(/proto\._uCollectAt = function\(node, gx, gy, results\)\{/.test(editorSrc), '_uCollectAt (сбор ВСЕХ совпадений) определён');
    assert(/proto\._uFindAllAt = function\(gx, gy\)\{/.test(editorSrc), '_uFindAllAt определён');
    assert(/return all\.length \? all\[0\] : null;/.test(editorSrc), '_uFindTopmost переиспользует _uFindAllAt (первый элемент)');
    assert(/const isShift = !!\(e\.data\.originalEvent && e\.data\.originalEvent\.shiftKey\);/.test(editorSrc),
        'onDown читает shiftKey из нативного события');
    assert(/this\._uShiftIdx = samePoint \? \(this\._uShiftIdx \+ 1\) % Math\.max\(1, all\.length\)/.test(editorSrc),
        'повторный Shift-клик в той же точке циклически идёт глубже');
    assert(/: \(all\.length > 1 \? 1 : 0\);/.test(editorSrc),
        'первый Shift-клик в новой точке берёт ВТОРОЙ сверху объект (индекс 1), а не тот же топовый');
}

console.log('\nTest 5: bosses_select.js — счётчик ключей теперь просто цифра');
{
    // 16.09.2026 (позже этого батча): have переименован в shownKeys (= Math.min(999, have)) —
    // счётчик ограничен 999 для визуального центрирования по числу цифр, см.
    // tests/bosses-select-killer-fallback.test.js. Суть проверки (просто цифра, без " КЛЮЧЕЙ") та же.
    assert(/const keysTxt = new PIXI\.Text\(String\(shownKeys\), \{/.test(bossSelSrc), 'keysTxt = String(shownKeys), без " КЛЮЧЕЙ"');
    assert(!/have \+ ' КЛЮЧЕЙ'/.test(bossSelSrc), 'старый вариант с суффиксом убран');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
