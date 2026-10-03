/**
 * Test: батч 22.09.2026 (по прямому указанию — "добавь на страницу рюкзака файл тушёнка и
 * файл бирка, на бирке напиши двадцать, а куда поставить я сам сделаю") —
 * ryukzak.js._openRyukzakReward() получил 3 новых декоративных объекта: бирка (фон под
 * циферкой), иконка тушёнки, текст "20". НЕ подключены к реальной награде сервера
 * (ryukzak.open не возвращает поле тушёнки) — чисто визуальное добавление, координаты
 * временные, пользователь сам подгонит их через универсальный редактор позиций.
 *
 * Run: node tests/ryukzak-tushenka-decorative-icon.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');

console.log('\nTest 1: новые спрайты (бирка + тушёнка) и текст "20" добавлены в win');
{
    assert(/const tushenkaTagSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'nagrada_ryukzak_birka\.png'\)\);/.test(src),
        'спрайт бирки создаётся из nagrada_ryukzak_birka.png');
    assert(/win\.addChild\(tushenkaTagSpr\);/.test(src), 'бирка добавлена в win');
    assert(/const tushenkaIconSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'nagrada_ryukzak_tushenka\.png'\)\);/.test(src),
        'спрайт тушёнки создаётся из nagrada_ryukzak_tushenka.png');
    assert(/win\.addChild\(tushenkaIconSpr\);/.test(src), 'тушёнка добавлена в win');
    assert(/const tushenkaQtyTxt = new PIXI\.Text\('20', \{/.test(src), 'текст "20" создан');
    assert(/win\.addChild\(tushenkaQtyTxt\);/.test(src), 'текст "20" добавлен в win');
}

console.log('\nTest 2: файлы-ассеты реально лежат в той же папке, что и остальные картинки этого экрана (sidorovich/)');
{
    const dir = path.join(root, '_client', 'development', 'images', 'layers', 'popups', 'sidorovich');
    assert(fs.existsSync(path.join(dir, 'nagrada_ryukzak_birka.png')), 'nagrada_ryukzak_birka.png существует локально');
    assert(fs.existsSync(path.join(dir, 'nagrada_ryukzak_tushenka.png')), 'nagrada_ryukzak_tushenka.png существует локально');
}

console.log('\nTest 3: новые объекты НЕ подключены к реальной логике награды сервера (чисто декоративное добавление)');
{
    assert(!/rewards\.push\(\{type:'tushenka'/.test(src), 'массив rewards (реальные начисления игроку) не содержит тушёнку — это отдельная задача, если понадобится');
    assert(!/tushenkaTagSpr\.visible = /.test(src) && !/tushenkaIconSpr\.visible = /.test(src),
        'видимость новых объектов не завязана на условие (всегда видны, как и попросили — "просто добавь")');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
