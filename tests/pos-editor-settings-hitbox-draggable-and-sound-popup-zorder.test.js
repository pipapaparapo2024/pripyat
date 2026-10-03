/**
 * Test: батч 25.09.2026 (по прямому указанию), два независимых фикса:
 *
 * 1) "В редакторе позиций могу двигать только иконку настроек, не её хотбокс": хотбокс шестерёнки
 *    (butt_settings, interface_elements.min.js — компилированный FLA, см. правило №2 в CLAUDE.md
 *    про допустимые точечные правки уже скомпилированного файла) — это Container (f) с ОДНИМ
 *    ребёнком-Graphics (b), а interactive=true стоит на САМОМ f, не на b. Хит-тест редактора
 *    позиций (_uCollectAt, universal_pos_editor.js) ищет ТОЛЬКО Sprite/Text/явно-помеченные
 *    _uDraggable/маленькие-interactive-Graphics-без-детей — Container (f) не подходит ни под один
 *    критерий (не Sprite/Text, сам не Graphics), поэтому никогда не попадал в список кандидатов
 *    под курсором — двигалась только видимая иконка (_bst, обычный Sprite), а её отдельный
 *    невидимый хитбокс — никогда. Фикс: f._uDraggable=true — явный флаг, тот же приём, что уже
 *    используется для других Graphics-объектов в проекте (см. popup-hit-shapes.js).
 *
 * 2) "Поп-ап настроек открывается только поверх главного экрана, а не поверх текущего (например
 *    шмоток)": попап кэшируется (this._soundWin) и добавляется в root.layer2_mc ОДИН раз при
 *    первой постройке — на повторных открытиях просто ставился visible=true БЕЗ повторного
 *    addChild. Если между первым и последующим открытием на layer2_mc добавлялся другой экран
 *    (шмотки и т.п.) — он оказывался ВЫШЕ (позже добавлен = выше z-order), и кэшированный попап
 *    настроек рендерился ПОД ним. Фикс: root.layer2_mc.addChild(this._soundWin) на КАЖДОМ
 *    открытии (addChild на уже присоединённом объекте просто переносит его в конец списка детей —
 *    тот же приём, что и у кнопки редактора позиций, держащейся сверху через Ticker).
 *
 * Run: node tests/pos-editor-settings-hitbox-draggable-and-sound-popup-zorder.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const compiledSrc = fs.readFileSync(path.join(root, '_client', 'development', 'libs', 'interface_elements.min.js'), 'utf-8');
const soundSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'sound.js'), 'utf-8');
const editorSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');

console.log('\nTest 1: interface_elements.min.js — хитбокс butt_settings (f) явно помечен _uDraggable для редактора позиций');
{
    // 25.09.2026: setTransform(1244,13) -> (1237,23) (редактор позиций, тот же день — иконка и
    // хитбокс сведены к единой позиции, см. tests/settings-hitbox-and-super-copy-button.test.js).
    assert(/f\.interactive=!0,f\.buttonMode=!0,f\._uDraggable=!0,f\.setTransform\(1237,23\),this\[f\.name="butt_settings"\]=f;/.test(compiledSrc),
        'КРИТИЧНО: f._uDraggable=!0 добавлен на контейнер хитбокса шестерёнки (между buttonMode и setTransform)');
}

console.log('\nTest 2: sanity — соседний хитбокс butt_energy_plus НЕ тронут (правка точечная, не общая для всех Container-хитбоксов компиляции)');
{
    assert(/u\.interactive=!0,u\.buttonMode=!0,u\.setTransform\(660,18\),this\[u\.name="butt_energy_plus"\]=u/.test(compiledSrc),
        'butt_energy_plus остался без _uDraggable — фикс адресный, только для запрошенного элемента');
}

console.log('\nTest 3: universal_pos_editor.js — регресс-гвард, что _uDraggable===true по-прежнему считается критерием для хит-теста редактора (иначе фикс #1 не сработает)');
{
    assert(/child\._uDraggable === true/.test(editorSrc),
        'sanity: _uCollectAt всё ещё учитывает флаг _uDraggable при поиске объекта под курсором');
}

console.log('\nTest 4: sound.js — попап настроек поднимается наверх layer2_mc при КАЖДОМ открытии, включая переиспользование кэша');
{
    // Файл использует CRLF (\r\n) — indexOf с литеральным \n не совпадает, ищем границу regex'ом.
    const s = soundSrc.indexOf('proto._openSoundPopup = function(){');
    const endMatch = soundSrc.slice(s).match(/return;\r?\n\t\t\}/);
    const e = endMatch ? s + endMatch.index + endMatch[0].length : soundSrc.length;
    const cachedBranch = soundSrc.slice(s, e);
    assert(/root\.layer2_mc\.addChild\(this\._soundWin\);/.test(cachedBranch),
        'КРИТИЧНО: ветка повторного открытия (кэш) заново вызывает addChild — переносит попап в конец списка детей (topmost)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
