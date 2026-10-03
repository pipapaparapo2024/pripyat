/**
 * Test: батч 25.09.2026 (по прямому указанию — "при перелистывании страницы на пол секунды
 * чёрный экран, должен экран чуть затемняться и показываться загрузка компаса").
 *
 * Корень: _compassShow()/_compassHide()/_compassWaitTex() (game/shell/ui_kit.js) — используются
 * ПО ВСЕЙ ИГРЕ при переключении между уже загруженными экранами (zone/weapons/yashik/
 * bosses_fight/sidorovich/ryukzak и т.д.) — раньше показывали/прятали #_clo, тот же элемент,
 * что используется для ПЕРВОНАЧАЛЬНОЙ загрузки приложения. #_clo был сделан полностью
 * непрозрачным 22.09.2026 (задокументированный фикс бага "фон просвечивает во время загрузки")
 * и лишён картинки компаса 24.09.2026 ("убери с загрузки компас, он не нужен") — оба решения
 * КАСАЛИСЬ именно первого запуска (16 фоновых модулей), но т.к. элемент общий, экраны игры
 * ТОЖЕ остались с плоским непрозрачным чёрным экраном без компаса.
 *
 * Фикс (первая версия, тот же день): отдельный, лёгкий DOM-элемент #_screenLoader
 * (полупрозрачное затемнение + крутящийся компас, CSS-анимация) — #_clo не трогается вообще.
 *
 * ЧЕТВЁРТОЕ исправление того же дня (по прямому указанию — "крутится криво, сделай
 * редактируемым через dev-панель") заменило DOM/CSS-подход на PIXI.Sprite (root.layer2_mc) —
 * см. tests/compass-needle-pivot-realignment.test.js для проверки кропа/pivot/PIXI-реализации.
 * Этот файл теперь проверяет, что смысловой КОНТРАКТ переключения (полупрозрачное затемнение,
 * не трогает #_clo, вызывается по всей игре при переходах, не при первом запуске) сохранился
 * при смене реализации.
 *
 * Run: node tests/screen-transition-compass-loader.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const html      = readSrc('_client/development/index.html');
const uiKitSrc  = readSrc('_client/src/game/shell/ui_kit.js');
const bootSrc   = readSrc('_client/src/game/game-boot.js');

console.log('\nTest 1: index.html — старая DOM-разметка #_screenLoader убрана (см. compass-needle-pivot-realignment.test.js), #_clo не тронут');
{
    assert(!/<div id="_screenLoader"/.test(html), '#_screenLoader больше не в index.html (перенесён в PIXI, ui_kit.js)');
    assert(/<div id="_clo" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;display:none;background:#000;overflow:hidden;pointer-events:all"><\/div>/.test(html),
        '#_clo (первоначальная загрузка) остался ДОСЛОВНО без изменений — тот же полностью непрозрачный чёрный фон');
}

console.log('\nTest 2: файл-ассет реально лежит в images/ (источник для деплоя)');
{
    const filePath = path.join(root, '_client', 'development', 'images', 'компас обрезан.png');
    assert(fs.existsSync(filePath), 'компас обрезан.png существует в images/');
}

console.log('\nTest 3: ui_kit.js — _compassShow/_compassHide — PIXI-контейнер (root.layer2_mc), не трогают #_clo/#_screenLoader вообще');
{
    const s = uiKitSrc.indexOf('proto._compassShow = function(){');
    const e = uiKitSrc.indexOf('proto._compassWaitTex', s);
    const body = uiKitSrc.slice(s, e);
    assert(!/getElementById/.test(body), '_compassShow/_compassHide больше не трогают DOM вообще (никакой getElementById)');
    assert(/root\.layer2_mc\.addChild\(this\._compassWin\)/.test(body), '_compassShow добавляет PIXI-контейнер компаса в root.layer2_mc — тот же слой, что у остальных попапов/оверлеев перехода');
    assert(/dark\.beginFill\(0x000000, 0\.55\)/.test(uiKitSrc), 'полупрозрачное затемнение (0.55) — то же значение, что у старой CSS-версии, не полностью непрозрачный, как #_clo');
}

console.log('\nTest 4: game-boot.js (первоначальная загрузка) НЕ использует _compassShow/Hide/WaitTex — работает с #_clo напрямую, не затронут фиксом');
{
    assert(!/_compassShow|_compassHide|_compassWaitTex/.test(bootSrc),
        'game-boot.js никогда не вызывал эти методы (работает с #_clo напрямую) — переключение ui_kit.js на #_screenLoader не может сломать первоначальную загрузку');
    assert(/getElementById\('_clo'\)/.test(bootSrc), 'sanity: game-boot.js по-прежнему сам управляет #_clo напрямую');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
