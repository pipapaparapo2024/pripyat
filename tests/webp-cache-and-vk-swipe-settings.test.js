/**
 * Test: 28.09.2026 — второй батч оптимизации/адаптива под мобильные.
 *
 * 1. VKWebAppSetSwipeSettings({history:false}) — в iOS-клиенте VK свайп от левого края экрана
 *    это системный жест "назад", который сворачивает мини-приложение. В игре есть
 *    горизонтальные драги (бегунки скролла), и начатый у края драг выкидывал игрока из игры.
 *    Метод поддерживается не везде — обязателен .catch(), иначе неподдерживаемый метод роняет
 *    промис в необработанное исключение.
 *
 * 2. WebP-двойники (tools/make_webp.py) для КАЖДОЙ реально используемой картинки. Имена в коде
 *    не меняются: подмену делает nginx по заголовку Accept (tools/nginx_images.conf), поэтому
 *    тест проверяет не код игры, а полноту покрытия файлов на диске. Замер: 171 МБ PNG -> 30 МБ.
 *
 * Отдельно проверяется, что уменьшение размеров текстур НЕ применялось к иконкам шмоток:
 * у всех 62 записей каталога есть вручную снятые cellScale/manScale, а 10 регресс-тестов
 * пиннят их точные значения — пересчёт обесценил бы и калибровку, и тесты (решение зафиксировано
 * в CLAUDE.md, раздел «Адаптив»).
 *
 * Run: node tests/webp-cache-and-vk-swipe-settings.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const ROOT = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf-8');

console.log('\nTest 1: VKWebAppSetSwipeSettings — системный свайп-назад не закрывает игру');
{
    const index = R('_client', 'src', 'index.js');
    assert(/VKWebAppSetSwipeSettings/.test(index), 'метод вызывается');
    assert(/VKWebAppSetSwipeSettings',\s*\{\s*history:\s*false\s*\}/.test(index),
        'передан history:false — клиент VK перестаёт перехватывать жест');
    const call = index.slice(index.indexOf('VKWebAppSetSwipeSettings'));
    assert(/\.catch\(/.test(call.slice(0, 600)),
        'есть .catch() — на старых клиентах и в вебе метод отсутствует, это нормальный случай');
}

console.log('\nTest 2: инструменты оптимизации на месте');
{
    assert(fs.existsSync(path.join(ROOT, 'tools', 'make_webp.py')), 'tools/make_webp.py — генератор WebP');
    assert(fs.existsSync(path.join(ROOT, 'tools', 'nginx_images.conf')), 'tools/nginx_images.conf — конфиг nginx');
    assert(fs.existsSync(path.join(ROOT, 'tools', 'check_images_headers.sh')), 'tools/check_images_headers.sh — проверка после применения');

    const conf = R('tools', 'nginx_images.conf');
    assert(/map \$http_accept \$webp_suffix/.test(conf), 'подмена идёт по заголовку Accept, а не по User-Agent');
    assert(/try_files \$uri\$webp_suffix \$uri =404;/.test(conf),
        'fallback на исходный PNG, если браузер не принимает WebP');
    assert(/add_header Vary "Accept";/.test(conf), 'Vary: Accept — прокси не перепутают два варианта');
    assert(/max-age=31536000, immutable/.test(conf), 'долгий кэш (безопасен из-за ?asset_v в URL)');

    const gen = R('tools', 'make_webp.py');
    assert(/dst = src \+ '\.webp'/.test(gen), 'webp кладётся РЯДОМ с png, исходник не трогается');
    assert(/if f not in text:\s*\n\s*continue/.test(gen), 'конвертируются только реально используемые картинки');
}

console.log('\nTest 3: WebP-двойники созданы для всех используемых картинок');
{
    // Тот же способ определения "используется", что и в генераторе.
    const blob = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.js')) blob.push(fs.readFileSync(p, 'utf-8'));
        }
    };
    walk(path.join(ROOT, '_client', 'src'));
    const libs = path.join(ROOT, '_client', 'development', 'libs');
    for (const f of fs.readdirSync(libs)) if (f.endsWith('.js')) blob.push(fs.readFileSync(path.join(libs, f), 'utf-8'));
    const jsonDir = path.join(ROOT, 'server', 'json');
    if (fs.existsSync(jsonDir)) for (const f of fs.readdirSync(jsonDir)) if (f.endsWith('.json')) blob.push(fs.readFileSync(path.join(jsonDir, f), 'utf-8'));
    const text = blob.join('\n');

    const IMAGES = path.join(ROOT, '_client', 'development', 'images');
    let used = 0, withWebp = 0, pngBytes = 0, webpBytes = 0;
    const missing = [];
    const scan = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { scan(p); continue; }
            if (!e.name.toLowerCase().endsWith('.png')) continue;
            if (!text.includes(e.name)) continue;
            used++;
            pngBytes += fs.statSync(p).size;
            if (fs.existsSync(p + '.webp')) { withWebp++; webpBytes += fs.statSync(p + '.webp').size; }
            else if (missing.length < 5) missing.push(path.relative(IMAGES, p));
        }
    };
    scan(IMAGES);

    assert(used > 700, 'используемых PNG найдено ' + used + ' (ожидается >700)');
    assert(withWebp === used, 'у всех используемых PNG есть .webp, без пары: ' + (used - withWebp) + ' ' + JSON.stringify(missing));
    const saved = pngBytes ? Math.round(100 * (1 - webpBytes / pngBytes)) : 0;
    assert(saved >= 60, 'WebP экономит ' + saved + '% трафика (' + (pngBytes / 1048576).toFixed(0)
        + ' МБ -> ' + (webpBytes / 1048576).toFixed(0) + ' МБ), ожидается >=60%');
}

console.log('\nTest 4: иконки шмоток НЕ уменьшались — калибровка cellScale/manScale цела');
{
    const shmot = R('_client', 'src', 'game', 'shmot.js');
    // Значения, которые пиннят существующие регресс-тесты — если они изменятся, поломаются они,
    // а не только этот тест; проверяем здесь же, чтобы причина была видна сразу.
    assert(/manScale:0\.225,/.test(shmot), 'id43 Шорты (Ястреб): manScale 0.225 не тронут');
    assert(/manScale:0\.221,/.test(shmot), 'id65 Шорты (Зарики): manScale 0.221 не тронут');

    const IMG = path.join(ROOT, '_client', 'development', 'images', 'shmot');
    const b = fs.readFileSync(path.join(IMG, 'шмот шорты картежник блэкджек.png')).subarray(0, 24);
    assert(b.readUInt32BE(16) === 1335 && b.readUInt32BE(20) === 1179,
        'исходный размер иконки шмотки не менялся (1335×1179) — уменьшение отложено осознанно');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
