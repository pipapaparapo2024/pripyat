/**
 * Test: 29.09.2026, по прямому указанию — "черные отступы по бокам, наложи на них задний
 * фон" (новый файл добавлен пользователем локально — "фоновый бэг.png", 2180×721, шире канваса
 * игры 1280px и по высоте совпадает с ней). Раньше body имел голую заливку #000 — на широких
 * окнах браузера по бокам канваса была видна чистая чернота. Теперь позади канваса — эта
 * картинка в натуральную величину по центру (без background-size — не растягивается/не
 * обрезается), #000 остаётся fallback-цветом.
 *
 * Run: node tests/page-background-behind-letterbox.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, '_client', 'development', 'index.html'), 'utf-8');

console.log('\nTest 1: body — фоновая картинка за канвасом, по центру, без повтора, масштабируется вместе с игрой');
{
    // 30.09.2026 (прогон перед деплоем — тест обновлён под 2 позднейшие правки того же дня):
    // 1) файл переименован в ASCII-имя side-background.png (кириллица в имени файла ломает URL
    //    при заливке на сервер, см. ПРАВИЛО №5 в CLAUDE.md);
    // 2) добавлен background-size:auto 100% — letterbox-вписывание канваса (index.js.resize())
    //    держит его РОВНО 100% высоты body при окне шире 16:9, без этого фон визуально не
    //    совпадал по масштабу с игрой при zoom≠100%/разных размерах окна.
    // 30.09.2026 (третий заход в тот же день): ?cb=2/?cb=3 не помогли — диагностика на экране
    // показала кэш ВНЕ нашего контроля (похоже на прокси/CDN самого ВК для мини-приложений),
    // игнорирующий смену query-параметра. Файл переименован в side-background-v2.png — смена
    // самого ПУТИ гарантированно пробивает любой кэш, независимо от его политики.
    assert(/body\{position:fixed;top:0;left:0;width:100%;height:100%;background:#000\s*\n\s*url\('\.\/images\/side-background-v2\.png'\) center center no-repeat;\s*\n\s*background-size:auto 100%;/.test(html),
        'body.background — #000 (fallback) + url(side-background-v2.png) center center no-repeat + background-size:auto 100%');
}

console.log('\nTest 2: файл картинки реально скопирован в _client/development/images/');
{
    const imgPath = path.join(root, '_client', 'development', 'images', 'фоновый бэг.png');
    assert(fs.existsSync(imgPath), 'файл "фоновый бэг.png" существует локально');
    if(fs.existsSync(imgPath)){
        const buf = fs.readFileSync(imgPath);
        assert(buf.length > 0, 'файл не пустой');
        assert(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47, 'валидный PNG-заголовок (не повреждён)');
    }
}

console.log('\nTest 3: регресс-гвард — html,body{...overflow:hidden...} (мобильная гигиена 27.09.2026) не задета этой правкой');
{
    assert(/html,body\{margin:0;padding:0;overflow:hidden;overscroll-behavior:none\}/.test(html),
        'базовое правило html,body не изменилось');
    assert(/canvas#stage\{touch-action:none\}/.test(html), 'touch-action:none на канвасе не задет');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
