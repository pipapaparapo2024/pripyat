/**
 * Test: 20.10.2026, по прямому указанию — "сделай так чтобы в азартных играх при нажатии на
 * редактор показывались все варианты выпадения комбинаций, потому что сейчас почему то каждое
 * выпадение комбинации какой либо имеет координаты 0 0, или можешь сделать так чтобы координаты
 * показывались относительно всей плоскости (как например сделано сейчас у других файлов)".
 *
 * Корень (зарики, самый острый случай): _diceComboHighlight был ОДНИМ общим PIXI.Graphics на
 * весь список из 18 строк таблицы наград, с h.position ЖЁСТКО зафиксированным в (0,0) —
 * прямоугольники для каждой строки рисовались ВНУТРИ одного draw-вызова по абсолютным
 * координатам. Универсальный редактор позиций, выбрав такой объект, всегда читал x:0,y:0
 * (позицию контейнера, не отдельной строки) и физически не мог показать больше одной
 * комбинации одновременно для калибровки.
 *
 * Покер/блэкджек technически НЕ имели бага "0,0" (там один объект переставлялся через
 * h.position.set(x,y) под КАЖДУЮ отдельную комбинацию — координаты были корректными), но
 * страдали тем же классом неудобства: увидеть/откалибровать ВСЕ строки таблицы сразу было
 * невозможно, не дождавшись каждой комбинации по очереди в реальной игре.
 *
 * Фикс — единый для всех трёх игр: ОДИН переиспользуемый Graphics заменён на N НЕЗАВИСИМЫХ
 * маркеров (по одному на строку/ранг/комбинацию), каждый с собственной позицией, заданной
 * ОДИН раз при постройке экрана (абсолютные координаты, та же система, что у любого другого
 * объекта в проекте) — и персонально помечен _uDraggable. Редактор позиций дополнительно
 * получил хук: при включении режима — показать ВСЕ варианты разом (window.dvor._xShowAll
 * ComboVariants), при выключении — вернуть реальный результат игры (_xRestoreComboHighlight).
 *
 * Run: node tests/dice-poker-bj-combo-highlight-editor-markers.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const diceSrc   = fs.readFileSync(path.join(root, 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const pokerSrc  = fs.readFileSync(path.join(root, 'dvor', 'dvor-poker-screen.js'), 'utf-8');
const bjSrc     = fs.readFileSync(path.join(root, 'dvor', 'dvor-blackjack.js'), 'utf-8');
const editorSrc = fs.readFileSync(path.join(root, 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');

console.log('\nTest 1: зарики — 18 независимых маркеров вместо одного общего Graphics с position(0,0)');
{
    assert(/this\._diceComboHighlights = DICE_ROW\.map\(\(rowPos, idx\) => \{/.test(diceSrc), 'маркеры строятся по одному на каждую запись DICE_ROW');
    assert(/m\.x = rowPos\.x; m\.y = rowPos\.y;/.test(diceSrc), 'каждый маркер получает СВОЮ позицию (не (0,0) контейнера)');
    assert(/m\._uDraggable = true;/.test(diceSrc), 'каждый маркер отдельно доступен редактору позиций');
    assert(!/this\._diceComboHighlight = comboHighlight;/.test(diceSrc), 'старый единственный this._diceComboHighlight убран');
}

console.log('\nTest 2: зарики — show/hide/showAll/restore работают с массивом маркеров');
{
    assert(/proto\._diceShowComboHighlight = function\(rowIndex\)\{/.test(diceSrc), '_diceShowComboHighlight определён');
    assert(/proto\._diceHideComboHighlight = function\(\)\{/.test(diceSrc), '_diceHideComboHighlight определён (гасит все 18 разом)');
    assert(/proto\._diceShowAllComboVariants = function\(\)\{/.test(diceSrc), '_diceShowAllComboVariants определён (для редактора)');
    assert(/proto\._diceRestoreComboHighlight = function\(\)\{/.test(diceSrc), '_diceRestoreComboHighlight определён (возврат после редактора)');
    const showAllBody = diceSrc.slice(diceSrc.indexOf('proto._diceShowAllComboVariants'), diceSrc.indexOf('proto._diceRestoreComboHighlight'));
    assert(/markers\.forEach\(m => \{ if\(window\.gsap\) gsap\.killTweensOf\(m\); m\.visible = true; m\.alpha = 1; \}\);/.test(showAllBody),
        '_diceShowAllComboVariants делает видимыми ВСЕ маркеры разом');
    const restoreBody = diceSrc.slice(diceSrc.indexOf('proto._diceRestoreComboHighlight'), diceSrc.indexOf('proto._diceRestoreComboHighlight') + 300);
    assert(/this\._diceShowComboHighlight\(this\._diceLastComboIndices \|\| \[\]\);/.test(restoreBody),
        '_diceRestoreComboHighlight возвращает ПОСЛЕДНИЙ реальный результат (не все 18)');
}

console.log('\nTest 3: покер — 10 независимых маркеров (по combo-ключу), показать все/восстановить');
{
    assert(/this\._pokerComboHighlights = \{\};/.test(pokerSrc), 'карта маркеров заведена');
    assert(/Object\.keys\(COMBO_ROW_POS\)\.forEach\(key => \{/.test(pokerSrc), 'маркер строится на каждый ключ COMBO_ROW_POS');
    assert(/m\.x = pos\.x; m\.y = pos\.y;/.test(pokerSrc), 'каждый маркер получает СВОЮ позицию из COMBO_ROW_POS');
    assert(!/this\._pokerComboHighlight = comboHighlight;/.test(pokerSrc), 'старый единственный this._pokerComboHighlight убран');
    assert(/proto\._pokerShowAllComboVariants = function\(\)\{/.test(pokerSrc), '_pokerShowAllComboVariants определён');
    assert(/proto\._pokerRestoreComboHighlight = function\(\)\{/.test(pokerSrc), '_pokerRestoreComboHighlight определён');
    assert(/this\._pokerLastCombo = combo;/.test(pokerSrc), 'последний реальный результат запоминается для восстановления');
}

console.log('\nTest 4: блэкджек — 9 независимых маркеров (по ключу BJ_ROW_Y), показать все/восстановить');
{
    assert(/this\._bjComboHighlights = \{\};/.test(bjSrc), 'карта маркеров заведена');
    assert(/Object\.keys\(BJ_ROW_Y\)\.forEach\(key => \{/.test(bjSrc), 'маркер строится на каждый ключ BJ_ROW_Y');
    assert(!/this\._bjComboHighlight = comboHighlight;/.test(bjSrc), 'старый единственный this._bjComboHighlight убран');
    assert(/proto\._bjShowAllComboVariants = function\(\)\{/.test(bjSrc), '_bjShowAllComboVariants определён');
    assert(/proto\._bjRestoreComboHighlight = function\(\)\{/.test(bjSrc), '_bjRestoreComboHighlight определён');
    assert(/this\._bjLastComboKey = key;/.test(bjSrc), 'последний реальный результат запоминается для восстановления');
}

console.log('\nTest 5: universal_pos_editor.js — включение режима показывает все варианты во всех трёх играх, выключение восстанавливает');
{
    const enableBody = editorSrc.slice(editorSrc.indexOf('proto._enableUniversalEdit = function(){'), editorSrc.indexOf('proto._uDestroyHandles = function('));
    assert(/dvor\._diceShowAllComboVariants === 'function'\) dvor\._diceShowAllComboVariants\(\);/.test(enableBody), 'включение редактора показывает все варианты зариков');
    assert(/dvor\._pokerShowAllComboVariants === 'function'\) dvor\._pokerShowAllComboVariants\(\);/.test(enableBody), 'включение редактора показывает все варианты покера');
    assert(/dvor\._bjShowAllComboVariants === 'function'\) dvor\._bjShowAllComboVariants\(\);/.test(enableBody), 'включение редактора показывает все варианты блэкджека');

    const disableBody = editorSrc.slice(editorSrc.indexOf('proto._disableUniversalEdit = function(){'));
    assert(/dvor\._diceRestoreComboHighlight === 'function'\) dvor\._diceRestoreComboHighlight\(\);/.test(disableBody), 'выключение редактора восстанавливает реальный результат зариков');
    assert(/dvor\._pokerRestoreComboHighlight === 'function'\) dvor\._pokerRestoreComboHighlight\(\);/.test(disableBody), 'выключение редактора восстанавливает реальный результат покера');
    assert(/dvor\._bjRestoreComboHighlight === 'function'\) dvor\._bjRestoreComboHighlight\(\);/.test(disableBody), 'выключение редактора восстанавливает реальный результат блэкджека');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
