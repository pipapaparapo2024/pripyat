/**
 * Test: 28.10.2026, по прямому указанию (скриншот) — "у босса Борода при открытии карусель
 * ВОЗМОЖНАЯ НАГРАДА показывает пустое окно, если листать дальше — появляются". Корень: карусель
 * всегда стартует с shmotCarouselIdx=0 (первый элемент пула босса), а у id96 ("Панама Борода",
 * см. modules/boss-shmot-images.js) НА ТОТ МОМЕНТ намеренно не было картинки — _renderShmotCarousel()
 * в этом случае молча прячет слот. Пул Бороды (bossIdx=6) начинался именно с id96 — первое, что
 * видел игрок.
 *
 * Первый фикс (тем же днём, раньше): id96 передвинут в конец массива пула — состав дропа (что
 * реально может выпасть) не изменился, только порядок отображения в карусели.
 *
 * 28.10.2026 (повторный репорт тем же днём — "сейчас у босса борода не выводится файл 'награда
 * голова зумер борода.png', посмотри что не так и исправь"): корневая причина оказалась глубже —
 * у id96 в принципе никогда не было записи в BOSS_SHMOT_REWARD_IMAGE, хотя файл на самом деле
 * существовал в исходной папке художника под неожиданным именем ("голова", не "панама" — тот же
 * класс несовпадения имён, что уже отмечен в докблоке modules/boss-shmot-images.js для других
 * вещей). Теперь файл скопирован в _client/development/images/, добавлен в прелоад
 * (window._allGamePngs, game-boot.js — см. ПРАВИЛО №11) и внесён в карту как
 * `96: 'награда голова зумер борода.png'`. Переупорядочивание пула (фикс выше) больше не
 * обязательно для отсутствия пустого слота, но оставлено как есть — не мешает.
 *
 * Run: node tests/boss-prefight-shmot-carousel-default-blank-fix.test.js
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

console.log('\nTest 1: id96 ("Панама/голова Борода") теперь ИМЕЕТ картинку — маппинг добавлен, ассет на диске, в прелоаде');
{
    const imgSrc = readSrc('_client/src/modules/boss-shmot-images.js');
    const map = {};
    const re = /(\d+):\s*'([^']+)'/g;
    let m;
    while((m = re.exec(imgSrc))) map[Number(m[1])] = m[2];
    assert(map[96] === 'награда голова зумер борода.png', 'у id96 теперь есть запись в карте — "награда голова зумер борода.png"');
    assert(map[75] && map[76] && map[77], 'id75/76/77 (остальной пул Бороды) по-прежнему ИМЕЮТ картинки');

    const assetPath = path.join(root, '_client', 'development', 'images', 'награда голова зумер борода.png');
    assert(fs.existsSync(assetPath), 'файл реально скопирован в _client/development/images/');

    const bootSrc = readSrc('_client/src/game/game-boot.js');
    assert(/'награда голова зумер борода\.png'/.test(bootSrc), 'ПРАВИЛО №11 — новый ассет сразу добавлен в window._allGamePngs (game-boot.js)');
}

console.log('\nTest 2: пул Бороды (bossIdx=6) переупорядочен — id96 в конце, не в начале');
{
    const src = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');
    assert(/6:\{normal:\[75,76,77,96\], solo:\[58\]\}/.test(src),
        'normal-пул Бороды: [75,76,77,96] (было [96,75,76,77]) — первый элемент теперь с картинкой');
    assert(!/6:\{normal:\[96,75,76,77\]/.test(src), 'старый порядок с id96 первым не остался');
}

console.log('\nTest 3: реальное исполнение — логика выбора карусели по умолчанию (shmotCarouselIdx=0) для нового порядка даёт id с картинкой');
{
    // Реплика _getShmotPool()+начала _renderShmotCarousel() из bosses_prefight.js — тот же пул и
    // та же карта картинок, что в реальном коде (прочитаны выше, не задублированы руками).
    const src = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');
    const poolMatch = src.match(/6:\{normal:\[([\d,]+)\], solo:\[58\]\}/);
    assert(!!poolMatch, 'пул Бороды найден в исходнике');
    const pool = poolMatch[1].split(',').map(Number);

    const imgSrc = readSrc('_client/src/modules/boss-shmot-images.js');
    const map = {};
    const re = /(\d+):\s*'([^']+)'/g;
    let m;
    while((m = re.exec(imgSrc))) map[Number(m[1])] = m[2];

    const shmotCarouselIdx = 0; // то же начальное значение, что в реальном коде
    const defaultItemId = pool[shmotCarouselIdx];
    assert(!!map[defaultItemId],
        'первый элемент пула при открытии карусели (idx=0) теперь имеет картинку — слот больше не пустой при первом открытии, получено id=' + defaultItemId);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
