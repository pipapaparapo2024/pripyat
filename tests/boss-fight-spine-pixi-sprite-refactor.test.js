/**
 * Test: репорт 08.10.2026 — "тултип оружия был ПОД Spine-анимацией босса" + "анимация должна
 * быть поверх заднего фона, но ниже всего остального (иконки оружия/тултипы)".
 *
 * Корень старой реализации: spine-boss.js рисовал анимацию в ОТДЕЛЬНЫЙ DOM-канвас
 * (document.body.appendChild, CSS z-index:50) — CSS z-index не может воткнуть один DOM-элемент
 * МЕЖДУ двумя слоями ВНУТРИ одного PIXI-канваса (фон и UI — оба просто пиксели одного и того же
 * <canvas id="stage">), поэтому Spine был либо целиком НАД, либо целиком ПОД всей игровой сценой.
 *
 * Фикс: Spine рисуется в offscreen-канвас, который служит источником обычной PIXI.Texture —
 * сам "персонаж" теперь ОБЫЧНЫЙ PIXI.Sprite внутри _bossFightWin, вставленный сразу после фона
 * (bg) и до любого другого UI — порядок addChild и есть Z-порядок в PIXI.
 *
 * Run: node tests/boss-fight-spine-pixi-sprite-refactor.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const spineSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8'
);
const bossesFightSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);

console.log('\nTest 1: Spine больше НЕ отдельный DOM-канвас поверх document.body');
{
    // Комментарии в файле намеренно ОБЪЯСНЯЮТ старый DOM/z-index подход (история фикса) —
    // проверяем только реальный код, не текст комментариев, иначе тест ложно падает на
    // собственной документации.
    const codeOnly = spineSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    assert(!/document\.body\.appendChild/.test(codeOnly),
        'document.body.appendChild отсутствует в коде spine-boss.js (раньше канвас монтировался прямо в body)');
    assert(!/cssText.*z-index|style\.zIndex/.test(codeOnly),
        'CSS z-index в коде не используется (больше нет отдельного слоя, который им управлялся бы)');
    assert(!/_onTop/.test(codeOnly),
        'хрупкая проверка "_bossFightWin — последний ребёнок layer2_mc" полностью убрана из кода');
}

console.log('\nTest 2: Spine теперь PIXI.Sprite с текстурой из offscreen-канваса, обновляемой каждый кадр');
{
    assert(/PIXI\.Texture\.from\(cv\)/.test(spineSrc), 'PIXI.Texture.from(offscreen-канвас) создаётся');
    assert(/new PIXI\.Sprite\(this\._spineTexture\)/.test(spineSrc), 'PIXI.Sprite оборачивает текстуру');
    assert(/this\._spineTexture\.update\(\)/.test(spineSrc),
        'texture.update() вызывается в render loop — без этого канвас не перезальётся на GPU и спрайт не обновится');
}

console.log('\nTest 3: _spineBossMount(win) — монтирует спрайт СРАЗУ после фона, до любого другого UI');
{
    assert(/proto\._spineBossMount = function\(win\)/.test(spineSrc), '_spineBossMount(win) определена в spine-boss.js');

    const buildStart = bossesFightSrc.indexOf('proto._buildBossesFight = function(){');
    const bgIdx    = bossesFightSrc.indexOf('this._bossFightBg = bg;', buildStart);
    const mountIdx = bossesFightSrc.indexOf('this._spineBossMount(win);', buildStart);
    const wpnRowIdx = bossesFightSrc.indexOf('РЯД ОРУЖИЙ', buildStart);
    const bossNameIdx = bossesFightSrc.indexOf('bossNameTxt', buildStart);

    assert(bgIdx !== -1 && mountIdx !== -1, 'оба маркера (bg, _spineBossMount) найдены в _buildBossesFight()');
    assert(mountIdx > bgIdx, '_spineBossMount(win) вызывается ПОСЛЕ создания фона (bg)');
    assert(mountIdx < bossNameIdx, '_spineBossMount(win) вызывается ДО остального UI (имя босса и далее)');
    assert(mountIdx < wpnRowIdx, '_spineBossMount(win) вызывается ДО ряда оружия/тултипов');
}

console.log('\nTest 4: защита от повторного перезапуска анимации при показе уже идущего босса (атака и т.п. не должны её сбрасывать)');
{
    assert(/this\._spineBossIdx === bossIdx && this\._spineCache\[bossIdx\] && this\._spineSprite\.visible/.test(spineSrc),
        '_spineBossShow() не трогает уже запущенный для того же босса рендер-цикл (no-op guard)');
}

console.log('\nTest 5: bosses_fight.js по-прежнему вызывает _spineBossShow() РОВНО из одного места (открытие экрана, не атака)');
{
    const showCalls = (bossesFightSrc.match(/\._spineBossShow\(/g) || []).length;
    assert(showCalls === 1, `_spineBossShow вызывается 1 раз в bosses_fight.js (найдено: ${showCalls}) — только из _reallyOpenBossesFight, не из _attackWithWeapon`);

    const attackStart = bossesFightSrc.indexOf('proto._attackWithWeapon = function(weapIdx){');
    const attackEnd    = bossesFightSrc.indexOf('proto._openNoWeaponPopup = function(){');
    const attackBody   = bossesFightSrc.slice(attackStart, attackEnd);
    assert(!/_spineBoss/.test(attackBody), '_attackWithWeapon() не содержит ни одного обращения к _spineBoss* — атака не трогает анимацию вовсе');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
