/**
 * Test: главный экран (16.09.2026) — вкладка «топы» убрана из игры насовсем (правая панель
 * interface-panels.js._buildPngSidePanels), «Сводка» поднялась вверх на её место (позиция
 * считается от индекса в массиве rightCfg, отдельных координат не было и не нужно), «Сводка»
 * сделана кликабельной.
 *
 * 22.09.2026 (по прямому указанию — "убери вкладку «Ежедневные задания», функционал оставь,
 * а саму картинку/кнопку убери"): «задания» убрана из rightCfg ЦЕЛИКОМ (была уже disabled —
 * теперь просто не рисуется вообще). Сам модуль Zadaniya (game/zadaniya.js) не тронут —
 * убрана только точка входа с HUD (module_control.js/game-boot.js по-прежнему создают и
 * загружают window.zadaniya как раньше).
 *
 * Run: node tests/home-tops-removed-svod-clickable.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8');

console.log('\nTest 1: «топы» полностью убраны из правой панели главного экрана');
{
    const start = src.indexOf('const rightCfg = [');
    const end   = src.indexOf('];', start);
    const rightCfgBlock = src.slice(start, end);
    assert(!/mod:\s*'leaderboard'/.test(rightCfgBlock), 'leaderboard всё ещё в массиве rightCfg');
    assert(!/file:\s*'топы'/.test(rightCfgBlock), 'файл «топы» всё ещё в массиве rightCfg');
}

console.log('\nTest 2: Сводка идёт сразу за Хабаром (заняла место топов) и кликабельна; «задания» в панели больше нет вообще');
{
    const start = src.indexOf('const rightCfg = [');
    const end   = src.indexOf('];', start);
    const rightCfgBlock = src.slice(start, end);
    const entries = [...rightCfgBlock.matchAll(/\{\s*file:\s*'([^']+)',\s*mod:\s*'([^']+)'(,\s*disabled:\s*true)?\s*\}/g)];
    assert(entries.length === 4, `в rightCfg ровно 4 вкладки — «задания» больше нет (найдено ${entries.length})`);
    const order = entries.map(m => m[2]);
    assert(JSON.stringify(order) === JSON.stringify(['dvor','base','habar','svod']),
        'порядок вкладок: двор, база, хабар, сводка (получено: ' + order.join(',') + ')');

    const svodEntry = entries.find(m => m[2] === 'svod');
    assert(svodEntry && !svodEntry[3], 'Сводка (svod) НЕ помечена disabled — кликабельна');

    assert(!entries.some(m => m[2] === 'zadaniya'), '«zadaniya» отсутствует в rightCfg — кнопка/картинка убрана из панели полностью');
}

console.log('\nTest 3: модуль Zadaniya НЕ удалён — только точка входа с HUD, сам модуль по-прежнему создаётся/грузится');
{
    const moduleControlSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'module_control.js'), 'utf-8');
    const gameBootSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8');
    assert(/import Zadaniya\s+from '\.\.\/game\/zadaniya\.js';/.test(moduleControlSrc), 'Zadaniya всё ещё импортирован в module_control.js');
    assert(/window\.zadaniya = new Zadaniya\(/.test(moduleControlSrc), 'window.zadaniya всё ещё создаётся');
    assert(/'zadaniya'/.test(gameBootSrc), 'zadaniya всё ещё в списке загружаемых модулей game-boot.js');

    assert(/'zadaniya'/.test(src), '\'zadaniya\' всё ещё упомянут в interface-panels.js (список _closeCurrentModule) — не удалён целиком из кода');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
