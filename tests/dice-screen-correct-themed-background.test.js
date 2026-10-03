/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт — "не выводится задний фон игры
 * в зарики, что не так?") —
 *
 * Причина: 21.09.2026 фон экрана зариков был переключён на "зарики фон вкладка двор.png" —
 * побайтово ту же картинку, что и фон лобби Двора (руины/церковь, подтверждено MD5 в
 * dvor-wrap-hidden-on-game-open-double-bg-fix.test.js), у которой НЕТ печатной панели
 * "ЗАРИКИ"/таблицы наград. Игрок открывал зарики и видел фон лобби вместо тематического
 * экрана — тот самый, что уже существует на диске под именем "задний фон зарики.png"
 * (1280×705, панель с правилами + таблица наград), но с 21.09.2026 нигде не рендерился.
 *
 * Фикс: bg-спрайт dvor-dice-screen.js снова указывает на "задний фон зарики.png". DICE_ROW_Y/
 * DICE_ROW_X (подсветка строки таблицы наград при выигрыше) трогать не пришлось — они и были
 * откалиброваны именно под эту картинку, просто временно "уехали" за подменённым фоном.
 *
 * 02.10.2026 (найдено при разборе полного прогона tests/, UI/ассет — низкий риск): между этой
 * правкой и сейчас фон экрана зариков заменён ЕЩЁ раз — на новый файл "задний фон зарики
 * новыйй.png" (без даты/обоснования в коде, но файл реально существует на диске 1280×705 и
 * добавлен в game-boot.js._allGamePngs вместе со старым именем — т.е. предзагрузка не сломана).
 * Старый "задний фон зарики.png" остался на диске неиспользуемым. Test 1 обновлён под текущее
 * имя файла, смысл проверки (тематический фон, не дубликат лобби Двора) не изменился.
 *
 * Run: node tests/dice-screen-correct-themed-background.test.js
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

const diceScreenSrc = readSrc('_client/src/game/dvor/dvor-dice-screen.js');

console.log('\nTest 1: фон экрана зариков — тематическая картинка "задний фон зарики.png", не дубликат лобби Двора');
{
    const start = diceScreenSrc.indexOf('proto._buildDiceScreen = function');
    const end   = diceScreenSrc.indexOf('\n        // Подсветка строки', start);
    const body  = diceScreenSrc.slice(start, end);

    assert(!!body && start !== -1, '_buildDiceScreen() найден');
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'задний фон зарики новыйй\.png'\)\);/.test(body),
        'bg использует "задний фон зарики новыйй.png" (актуальный тематический фон с панелью правил и таблицей наград)');
    assert(!/'зарики фон вкладка двор\.png'/.test(diceScreenSrc),
        'старая ссылка на дубликат фона лобби Двора ("зарики фон вкладка двор.png") полностью убрана из файла (не осталась мёртвым кодом)');
    assert(/bg\.y = 15;/.test(body), 'вертикальное смещение сохранено (705 + 15 = 720, ровно высота канваса)');
}

console.log('\nTest 2: файл "задний фон зарики новыйй.png" реально существует на диске и имеет ожидаемый нативный размер 1280×705');
{
    const imgPath = path.join(root, '_client', 'development', 'images', 'задний фон зарики новыйй.png');
    assert(fs.existsSync(imgPath), 'файл существует: _client/development/images/задний фон зарики новыйй.png');

    // PNG IHDR: 8-байтная сигнатура, затем чанк IHDR — ширина/высота big-endian uint32 на
    // смещениях 16 и 20 соответственно (без внешних библиотек, тот же приём, что уже
    // используют другие тесты этого каталога для проверки размеров PNG).
    if(fs.existsSync(imgPath)){
        const buf = fs.readFileSync(imgPath);
        const width  = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        assert(width === 1280 && height === 705, `размер файла 1280×705, получили ${width}×${height}`);
    }
}

console.log('\nTest 3: файл предзагружается заранее (game-boot.js._allGamePngs) — не будет визуально "хлопать" при первом открытии зариков');
{
    const bootSrc = readSrc('_client/src/game/game-boot.js');
    assert(/'задний фон зарики новыйй\.png'/.test(bootSrc), '"задний фон зарики новыйй.png" присутствует в списке ранней предзагрузки текстур');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
