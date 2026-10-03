/**
 * Test: 17.09.2026 (десятый батч) — репорт пользователя со скриншотами по Сводке:
 *
 *  1) Главные вкладки Сводки (svod.js) и саб-табы лидерборда (svod-leaderboard.js) визуально
 *     «прыгали» при переключении актив/пассив — корень: спрайты без anchor (default 0,0 —
 *     top-left) при разных пиксельных размерах картинок актив/пассив ("кнопка топ по
 *     достижения пассив.png" 154×153 против "кнопка топ по достижениям актив.png" 154×66 —
 *     почти вдвое выше; "друзья актив.png" 257×50 против "друзья неактив.png" 159×35 — почти
 *     на 100px шире). Исправлено: anchor(0.5,0.5) + координаты как ЦЕНТР кнопки — теперь актив
 *     и пассив центрируются в одной точке независимо от собственного размера картинки.
 *
 *  2) Самодельные заголовки «МЕСТО»/«ИГРОК»/значение убраны из кода — уже нарисованы в фоне
 *     панели (repoрт: "самостоятельно не пиши... всё уже написано").
 *
 *  3) Координаты текста в строке (место/имя/значение) — точный снимок пользователя через
 *     редактор позиций, применены к каждой строке пула.
 *
 *  4) Колонка «УРОВЕНЬ» отсутствовала полностью (top.php не отдавал exp вообще) — добавлена и
 *     на сервере (top.get теперь отдаёт exp), и на клиенте (новый levelTxt, формула — та же,
 *     что interface.js.updateNick, посчитана заново на клиенте, не задублирована на PHP).
 *
 * Run: node tests/svod-leaderboard-anchor-center-level-col.test.js
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

const svodSrc  = readSrc('_client/src/game/svod.js');
const lbSrc    = readSrc('_client/src/game/svod/svod-leaderboard.js');
const topPhp   = readSrc('server/core/controllers/top.php');

console.log('\nTest 1: главные вкладки — anchor(0.5,0.5) + центр вместо top-left');
{
    const start = svodSrc.indexOf('const MAIN_TABS = [');
    const end   = svodSrc.indexOf('const tabSprites = {};');
    const body  = svodSrc.slice(start, end);
    assert(/x:200,\s*y:206/.test(body), 'news: центр (200, 206) — вычислен из старого top-left + половина размера актив.png');
    assert(/x:197\.5,\s*y:337/.test(body), 'damage: центр (197.5, 337)');
    assert(/x:201,\s*y:414/.test(body), 'ach: центр (201, 414)');

    const loopStart = svodSrc.indexOf('MAIN_TABS.forEach(t => {');
    const loopEnd   = svodSrc.indexOf('this._svodTabSprites = tabSprites;');
    const loopBody  = svodSrc.slice(loopStart, loopEnd);
    assert(/spr\.anchor\.set\(0\.5, 0\.5\);/.test(loopBody), 'спрайт вкладки получает anchor(0.5,0.5)');
}

console.log('\nTest 2: заголовки МЕСТО/ИГРОК/значение убраны из кода панели лидерборда');
{
    assert(!/new PIXI\.Text\('МЕСТО'/.test(lbSrc), "PIXI.Text('МЕСТО') больше не создаётся кодом");
    assert(!/new PIXI\.Text\('ИГРОК'/.test(lbSrc), "PIXI.Text('ИГРОК') больше не создаётся кодом");
    assert(!/HEADER_STYLE/.test(lbSrc), 'HEADER_STYLE (стиль самодельных заголовков) полностью убран');
}

console.log('\nTest 3: саб-табы (Общий топ / Друзья / Мои достижения) — anchor-центрирование');
{
    const start = lbSrc.indexOf('const subAll = new PIXI.Sprite');
    const end   = lbSrc.indexOf('const rowsContainer');
    const body  = lbSrc.slice(start, end);
    assert(/subAll\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'subAll получает anchor(0.5,0.5)');
    assert(/subSecond\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'subSecond получает anchor(0.5,0.5)');
    // 19.09.2026 (по прямому указанию): раньше центр вычислялся из ширины АКТИВНОЙ картинки
    // конкретной вкладки (друзья 257 vs мои достижения 174), из-за чего у экрана достижений
    // правая кнопка садилась в другую точку, чем у урона/авторитета. Теперь единая абсолютная
    // точка (SUBTAB_SECOND_X/Y) для всех трёх экранов — anchor сам центрирует любой ассет
    // вокруг неё независимо от размера, secondActiveW/H в svod.js больше не существуют.
    assert(/subSecond\.x = SUBTAB_SECOND_X;/.test(body), 'subSecond.x = SUBTAB_SECOND_X (единая точка для всех вкладок)');
    assert(/subSecond\.y = SUBTAB_SECOND_Y;/.test(body), 'subSecond.y = SUBTAB_SECOND_Y (единая точка для всех вкладок)');
    assert(!/secondActiveW/.test(svodSrc), 'secondActiveW больше не используется в svod.js (мёртвое поле убрано вместе со сменой формулы)');
    assert(!/secondActiveH/.test(svodSrc), 'secondActiveH больше не используется в svod.js');
}

console.log('\nTest 4: координаты текста строки — точный снимок редактора позиций');
{
    const start = lbSrc.indexOf('for(let i = 0; i < ROWS_POOL; i++){');
    const end   = lbSrc.indexOf('rowsContainer.addChild(row);');
    const body  = lbSrc.slice(start, end);
    // 19.09.2026: система суб-блоков ячейки (CELL_BLOCKS) — место/ник/значение больше не сидят
    // на абсолютных x, а центрируются (anchor.x=0.5) относительно СВОЕГО блока, см.
    // svod-cell-blocks-and-text-centering.test.js. Y/scale не менялись.
    assert(/placeTxt\.anchor\.set\(0\.5, 0\);\s*\n\s*placeTxt\.x = centerX\(CELL_BLOCKS\.place\); placeTxt\.y = 6; placeTxt\.scale\.set\(1\.200\);/.test(body),
        'placeTxt: центрирован в блоке «место», y=6, scale=1.2');
    assert(/nameTxt\.anchor\.set\(0\.5, 0\);\s*\n\s*nameTxt\.x = centerX\(CELL_BLOCKS\.name\); nameTxt\.y = 10; nameTxt\.scale\.set\(0\.954\);/.test(body),
        'nameTxt: центрирован в блоке «никнейм», y=10, scale=0.954');
    assert(/valTxt\.anchor\.set\(0\.5, 0\);\s*\n\s*valTxt\.x = centerX\(CELL_BLOCKS\.value\); valTxt\.y = 9; valTxt\.scale\.set\(1\.000\);/.test(body),
        'valTxt: центрирован в блоке «урон авторитет» (было anchor 1,0 у правого края), y=9, scale=1.0');
}

console.log('\nTest 5: колонка «Уровень» — сервер отдаёт exp, клиент считает и показывает уровень');
{
    const start = topPhp.indexOf('function get(){');
    const end   = topPhp.indexOf('function ', start + 10);
    const body  = topPhp.slice(start, end !== -1 ? end : topPhp.length);
    // Позже этого батча добавлено 'nick' (игровой ник вместо VK-имени, аудит 17.09.2026) —
    // exp по-прежнему выбирается, просто уже не последним элементом массива.
    assert(/\['id', \$field, 'exp', 'nick'\]/.test(body), 'top.get() дополнительно выбирает exp (и nick) из БД');
    assert(/'exp'=>intval\(\$r\['exp'\] \?\? 0\)/.test(body), 'exp попадает в ответ каждой строки топа');

    assert(/const levelTxt = new PIXI\.Text/.test(lbSrc), 'клиент создаёт levelTxt — новый текстовый элемент строки');
    assert(/const levelFromExp = \(exp\) => Math\.max\(0, Math\.floor\(\(-1 \+ Math\.sqrt\(1 \+ exp \/ 5\)\) \/ 2\)\);/.test(lbSrc),
        'формула уровня идентична interface.js.updateNick (не задублирована иначе)');
    assert(/r\.levelTxt\.text = String\(levelFromExp\(entry\.exp \|\| 0\)\);/.test(lbSrc),
        'levelTxt.text заполняется в обеих ветках _loadLeaderboard (с VK-резолвом имён и без него)');
    const occurrences = (lbSrc.match(/r\.levelTxt\.text = String\(levelFromExp/g) || []).length;
    assert(occurrences === 2, 'заполнение levelTxt происходит в ОБЕИХ ветках (с VK-резолвом и без) — 2 вхождения');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
