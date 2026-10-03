/**
 * Test: 17.09.2026 (пятнадцатый батч) — репорт пользователя со скриншотами двух отдельных багов:
 *
 *  1) Стрелка "вниз" пагинации Зоны выглядела как маленькая плоская иконка вместо серой
 *     метал-рамки (как у активной, только серая). Причина — коллизия имён: zone_screen.js
 *     (пагинация Зоны) и svod-scroll.js (скроллбар Сводки, добавлен 17.09.2026 в этой же
 *     сессии) оба использовали ОДНО имя файла 'стрелка вниз.png' для двух РАЗНЫХ по стилю и
 *     размеру ассетов (52×50 метал-рамка у Зоны против 28×30 плоской иконки у Сводки) — какая
 *     заливка была последней, та и оставалась на сервере для ОБЕИХ фич разом.
 *     Исправлено: svod-scroll.js переведён на собственные однозначные имена
 *     ('свод стрелка вверх/вниз.png' — старое маленькое плоское содержимое сохранено под
 *     этими новыми именами), а 'стрелка вниз.png'/'Стрелка вверх.png' пересозданы как серые
 *     (обесцвеченные) копии активных метал-рамок — та же стилистика, что просил пользователь.
 *
 *  2) Вкладка "Топ по достижениям" визуально "прыгала" не туда, куда её позиционировали
 *     координатами — реальная причина не в координатах: файл "кнопка топ по достижения
 *     пассив.png" был 154×153px, но реальное видимое содержимое (медаль + текст) занимало
 *     только НИЖНИЕ ~65px — верхние ~88px были полностью прозрачным полем (проверено по
 *     альфа-каналу). Обрезано до 154×65 — теперь совпадает с активной (154×66) без искажений.
 *
 * Run: node tests/svod-scroll-arrow-collision-and-achievement-tab-asset-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const IMAGES = path.join(root, '_client', 'development', 'images');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: svod-scroll.js больше не делит имена файлов стрелок с zone_screen.js');
{
    const svodSrc = readSrc('_client/src/game/svod/svod-scroll.js');
    const zoneSrc = readSrc('_client/src/game/shell/overlays/zone_screen.js');

    assert(svodSrc.includes("IMG + 'свод стрелка вверх.png'"), 'svod-scroll использует свод стрелка вверх.png');
    assert(svodSrc.includes("IMG + 'свод стрелка вниз.png'"), 'svod-scroll использует свод стрелка вниз.png');
    assert(!svodSrc.includes("IMG + 'стрелка вверх.png'"), 'svod-scroll больше НЕ ссылается на общее имя стрелка вверх.png');
    assert(!svodSrc.includes("IMG + 'стрелка вниз.png'"), 'svod-scroll больше НЕ ссылается на общее имя стрелка вниз.png');

    // zone_screen.js по-прежнему владеет исходными именами — коллизии больше нет ни с одной стороны.
    assert(zoneSrc.includes("'стрелка вниз.png'"), 'zone_screen.js по-прежнему использует стрелка вниз.png (теперь безраздельно)');
    assert(!zoneSrc.includes("свод стрелка"), 'zone_screen.js не ссылается на новые svod-имена (разделены полностью)');
}

console.log('\nTest 2: файлы стрелок Сводки существуют отдельно от файлов Зоны');
{
    ['свод стрелка вверх.png', 'свод стрелка вниз.png'].forEach(f => {
        assert(fs.existsSync(path.join(IMAGES, f)), `${f} существует`);
    });
}

console.log('\nTest 3: "кнопка топ по достижения пассив.png" обрезана — совпадает по высоте с активной (154×66)');
{
    // Простая проверка PNG-заголовка (ширина/высота — байты 16-23 IHDR-чанка) — без внешних зависимостей.
    function pngSize(filePath){
        const buf = fs.readFileSync(filePath);
        const width  = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        return { width, height };
    }
    const passive = pngSize(path.join(IMAGES, 'кнопка топ по достижения пассив.png'));
    const active  = pngSize(path.join(IMAGES, 'кнопка топ по достижениям актив.png'));
    console.log('    пассив:', JSON.stringify(passive), '| актив:', JSON.stringify(active));
    assert(passive.width === active.width, 'ширина пассив/актив совпадает (154px)');
    assert(Math.abs(passive.height - active.height) <= 2,
        'высота пассив/актив совпадает с точностью до 2px (была разница ~87px из-за пустого поля сверху)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
