/**
 * Test: батч 25.09.2026 (по прямому указанию, разбор присланного консольного лога).
 *
 * 1) "рамка уважения" (game/shell/overlays/zone_screen.js) — реальная причина, почему фото/
 *    сумма рекордсмена никогда не появлялись, НЕ в БД/сервере (там всё было верно, см. более
 *    ранний батч этого же дня), а в JS: константы RESPECT_FRAME_ / RESPECT_PHOTO_ /
 *    RESPECT_AMOUNT_ были объявлены как const ВНУТРИ proto._openZoneScreen, а читались из СОСЕДНЕЙ функции
 *    proto._refreshZoneRespectLeaders — ReferenceError: RESPECT_PHOTO_W is not defined,
 *    видно прямо в присланном логе. Константы вынесены на уровень attachZoneScreen(proto).
 *
 * 2) Компас на переходах между экранами (index.html #_screenLoader) — первая версия (тот же
 *    день, более ранний батч) крутила ВЕСЬ диск целиком; по прямому указанию ("пропала
 *    стрелка, компас крутится вместо стрелки") нужно вращать именно стрелку, диск должен
 *    стоять на месте — как было у оригинального удалённого 24.09.2026 варианта.
 *
 *    25.09.2026, ТРЕТЬЕ исправление тем же днём (живой репорт со скриншотом dev-панели —
 *    "компас криво крутится"): первый pivot (26.98% 23.17%) строился на ЛОЖНОМ допущении, что
 *    "компас обрезан.png" и "стрелка компаса обрезана.png", будучи одного размера 1672×941 и
 *    обрезанные одним прямоугольником, сохраняют общую координатную сетку. Прямая проверка
 *    (наложение исходных ПОЛНЫХ файлов) показала, что латунный пин стрелки и центр диска в
 *    исходниках находятся в НИЧЕМ не связанных координатах — два независимо нарисованных
 *    ассета.
 *
 *    ЧЕТВЁРТОЕ исправление того же дня заменило весь этот DOM/CSS-подход на PIXI.Sprite (диск+
 *    стрелка в root.layer2_mc) — см. tests/compass-needle-pivot-realignment.test.js и
 *    tests/screen-transition-compass-loader.test.js для актуальной проверки. Раздел про компас
 *    убран из ЭТОГО файла (проверял уже несуществующую DOM-разметку #_screenLoader), раздел про
 *    рамку уважения ниже остаётся — независимая часть того же батча.
 *
 * Run: node tests/zone-respect-scoping-bug-and-compass-needle-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) zone_screen.js — RESPECT_* константы видны обеим функциям (общий scope attachZoneScreen)');
{
    const src = read('_client/src/game/shell/overlays/zone_screen.js');

    const attachIdx = src.indexOf('export function attachZoneScreen(proto){');
    const openIdx   = src.indexOf('proto._openZoneScreen = function(targetLocIdx){');
    const refreshIdx = src.indexOf('proto._refreshZoneRespectLeaders = function(){');
    assert(attachIdx !== -1 && openIdx !== -1 && refreshIdx !== -1, 'все три якоря найдены');

    const outerChunk = src.slice(attachIdx, openIdx);
    assert(/const RESPECT_FRAME_REL_X = 728, RESPECT_FRAME_REL_Y = 18;/.test(outerChunk),
        'RESPECT_FRAME_REL_X/Y объявлены на уровне attachZoneScreen (ДО _openZoneScreen)');
    assert(/const RESPECT_PHOTO_W = 112, RESPECT_PHOTO_H = 112;/.test(outerChunk),
        'RESPECT_PHOTO_W/H объявлены на уровне attachZoneScreen — именно эта пара отсутствовала (см. ReferenceError в логе)');
    assert(/const RESPECT_AMOUNT_REL_Y = 138;/.test(outerChunk), 'RESPECT_AMOUNT_REL_Y тоже вынесен');

    // Внутри _openZoneScreen эти const больше не объявляются повторно (иначе — redeclare error
    // в строгом смысле недопустим для var в одном scope, но здесь важно, что дубля физически нет).
    const openToRefreshChunk = src.slice(openIdx, refreshIdx);
    assert(!/const RESPECT_FRAME_REL_X/.test(openToRefreshChunk),
        'внутри _openZoneScreen константа RESPECT_FRAME_REL_X больше НЕ дублируется');
    assert(!/const RESPECT_PHOTO_W/.test(openToRefreshChunk),
        'внутри _openZoneScreen константа RESPECT_PHOTO_W больше НЕ дублируется');

    // _refreshZoneRespectLeaders реально использует эти имена — значит без выноса выше
    // это гарантированно был бы ReferenceError (как и было в живом логе пользователя).
    const refreshChunk = src.slice(refreshIdx, refreshIdx + 3500);
    assert(/RESPECT_PHOTO_W/.test(refreshChunk) && /RESPECT_PHOTO_REL_X/.test(refreshChunk),
        '_renderRespectLeaders (внутри _refreshZoneRespectLeaders) реально читает RESPECT_PHOTO_*');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
