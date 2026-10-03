/**
 * Test: 18.09.2026 — экран выбора локаций Зоны.
 *
 *  1) Раньше у каждой из 3 страниц был свой уникальный "комбинированный" фон
 *     ('кордон и свалка.png' / 'долина и агропром.png' / 'янтарь окно.png'). По прямому
 *     указанию — заменить на один и тот же нейтральный фон 'задний фон выбор локаций.png'
 *     для ВСЕХ страниц (изображение предоставлено пользователем, взято из
 *     C:\Users\HONOR\Desktop\vk_game\вкладка зоны (все)\задний фон выбор локаций.png).
 *
 *  2) Карточки локаций (кордон.png/свалка.png/долина.png/Агропром.png/янтарь.png) уже были
 *     верно прописаны в коде — баг был в том, что НА СЕРВЕРЕ лежали устаревшие версии этих
 *     файлов (кордон.png/свалка.png/Агропром.png отличались от локальных по MD5, проверено
 *     18.09.2026 напрямую через SFTP) — код не трогаем, тест фиксирует, что имена файлов
 *     в коде совпадают с локальными файлами (актуальными), которые нужно перезалить.
 *
 * Run: node tests/zone-unified-background-and-location-cards.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root   = path.join(__dirname, '..');
const IMAGES = path.join(root, '_client', 'development', 'images');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');

console.log('\nTest 1: единый фон ZONE_BG — один спрайт на весь экран, больше не привязан к странице/локации');
{
    assert(/const ZONE_BG = Z \+ 'задний фон выбор локаций\.png';/.test(src),
        'ZONE_BG объявлен и указывает на новый общий файл фона');
    // 21.09.2026 (карусель по одной локации — см. zone-locations-carousel-slide.test.js):
    // раньше bg лежал ПОЛЕМ у каждой из 3 страниц (bg:ZONE_BG×3, менялся при смене страницы,
    // хоть и на одно и то же значение). Теперь background создаётся ОДИН РАЗ напрямую из
    // ZONE_BG и никогда не переключается — локации листаются картой locWrap, фон статичен.
    assert(/const bgSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\(ZONE_BG\)\);/.test(src),
        'фон создаётся один раз напрямую из ZONE_BG (не через per-page/per-location поле bg)');
    assert(!/bg:\s*ZONE_BG/.test(src), 'поля bg:ZONE_BG у локаций/страниц больше нет — фон не привязан к листанию');
    assert(!/'кордон и свалка\.png'/.test(src) && !/'долина и агропром\.png'/.test(src) && !/'янтарь окно\.png'/.test(src),
        'старые комбинированные фоны нигде не используются');
}

console.log('\nTest 2: _compassWaitTex ждёт именно новый общий фон, а не старый "кордон и свалка.png"');
{
    assert(/this\._compassWaitTex\(ZONE_BG\);/.test(src),
        'компас скрывается по загрузке ZONE_BG (раньше ждал устаревший файл первой страницы)');
}

console.log('\nTest 3: карточки локаций по-прежнему указывают на свои индивидуальные файлы (не тронуты)');
{
    const pairs = [
        ["Z + 'кордон.png'",   0],
        ["Z + 'свалка.png'",  1],
        ["Z + 'долина.png'",  2],
        ["Z + 'Агропром.png'",3],
        ["Z + 'янтарь.png'",  4],
    ];
    pairs.forEach(([needle, locIdx]) => {
        assert(src.includes(needle), `карточка для locIdx=${locIdx} по-прежнему ссылается на file: ${needle}`);
    });
}

console.log('\nTest 4: все файлы (общий фон + карточки локаций) присутствуют в _client/development/images/');
{
    const files = [
        'задний фон выбор локаций.png',
        'кордон.png', 'свалка.png', 'долина.png', 'Агропром.png', 'янтарь.png',
    ];
    files.forEach(f => {
        assert(fs.existsSync(path.join(IMAGES, f)), `файл присутствует локально: ${f}`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
