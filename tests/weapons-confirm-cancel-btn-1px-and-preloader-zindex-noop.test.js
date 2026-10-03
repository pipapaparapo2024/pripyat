/**
 * Test: батч 22.09.2026 (по прямому указанию, редактор позиций) —
 *
 * 1) weapons.js._buildConfirmWin — "ОТМЕНА актив" в попапе "ТОЧНО? ТЫ ТОЧНО ХОЧЕШЬ КУПИТЬ?"
 *    поднята ещё на 1px (354→353).
 * 2) preloader-visual.js/index.html — z-index компаса (#_clo) НЕ трогали: пользователь явно
 *    подтвердил, что видео и компас НЕ должны показываться одновременно (сначала видео целиком,
 *    компас — только после того, как видео закончилось, если игра ещё не готова). Тест
 *    фиксирует, что z-index #_clo остался 9999 (тот же, что у видео) — раз оба никогда не
 *    видны одновременно (компас показывается только когда видео уже display:none), z-index
 *    можно не трогать, полагаясь на существующую последовательную (не параллельную) логику.
 *
 * Run: node tests/weapons-confirm-cancel-btn-1px-and-preloader-zindex-noop.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const weaponsSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'weapons.js'), 'utf-8');
const indexHtml   = fs.readFileSync(path.join(root, '_client', 'development', 'index.html'), 'utf-8');
const preloaderSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'preloader-visual.js'), 'utf-8');

console.log('\nTest 1: weapons.js — "ОТМЕНА актив" поднята на 1px (386-32-1=353)');
{
    assert(/выйтиActiv\.x = 665 - 10; выйтиActiv\.y = 386 - 32 - 1;/.test(weaponsSrc),
        'выйтиActiv.y = 386-32-1 (353), было 386-32 (354)');
}

console.log('\nTest 2: #_clo (компас) НЕ получил повышенный z-index — видео и компас по-прежнему НЕ пересекаются по времени показа');
{
    assert(/id="_clo" style="[^"]*z-index:9999;/.test(indexHtml),
        '#_clo сохранил z-index:9999 (равный видео) — они никогда не видны одновременно, поднимать незачем');
    // 24.09.2026 (по прямому указанию — "убери с загрузки компас, он не нужен" + отдельно,
    // тем же днём, "сделай прелоадер анимацию зацикленной"): весь премис этого под-теста
    // (компас-фолбэк показывается ПОСЛЕ того, как видео спрятано) отпал дважды — во-первых,
    // видео больше не прячется по завершении, а зацикливается; во-вторых, у #_clo больше нет
    // картинки-компаса со стрелкой вообще (см. index.html), он остался плоским чёрным
    // оверлеем для СОВСЕМ ДРУГОЙ цели (скрывает недогруженную PIXI-сцену, см. комментарий там
    // же). z-index:9999 подтверждён выше — этого достаточно, "не одновременно" проверять
    // больше не на чем (нечему быть "одновременно" — второй сущности не осталось).
    assert(!/_showCompass\(\);/.test(preloaderSrc), 'компас-фолбэк в preloader-visual.js отсутствует — см. preloader-video-loops-until-game-ready.test.js для актуального поведения');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
