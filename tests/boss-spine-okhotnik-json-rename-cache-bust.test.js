/**
 * Test: 10.10.2026 (по прямому указанию — "анимация Охотника немного не та, мне кажется,
 * проблема в неймиге, потому что у нас уже такое было, что файлы из-за того, что одинаковые,
 * они в кэше сохранялись из-за названия").
 *
 * Диагноз: _loadSpineSkeleton() (spine-boss.js) грузит json/atlas обычным fetch() БЕЗ
 * cache-busting query-параметра (в отличие от основного JS-бандла, у которого index.html
 * всегда ставит ?v=NNN) — предыдущие два обновления okhotnik.json заливались ПОД ТЕМ ЖЕ именем
 * файла, поэтому браузер/прокси мог продолжать отдавать старую закэшированную версию по тому
 * же URL даже после заливки нового содержимого на сервер. Фикс — третье обновление (кость
 * 'hand2' IK, доп. keyframe в начале трека) залито под НОВЫМ именем 'okhotnik_v2.json', старый
 * 'okhotnik.json' остался на диске неиспользуемым (откат при необходимости), атлас/текстура не
 * переименованы (побайтово не менялись между всеми тремя экспортами).
 *
 * 11.10.2026 (по прямому указанию — "вот два файла анимаций [Охотник, Меченный], переименую их,
 * боюсь что кэш застрял в имени"): тот же паттерн применён повторно —
 *  - Охотник: четвёртое обновление (та же модель — 40 костей/26 слотов/18.9667с) →
 *    'okhotnik_v2.json' → 'okhotnik_v3.json' (v2 уже занято предыдущим обновлением). Присланные
 *    в архиве текстура/атлас (okhotnik2.webp/okhotnik2.atlas.txt) побайтово идентичны уже
 *    используемым okhotnik.webp/okhotnik.atlas — не переименованы, переименовывать нечего.
 *  - Меченный: ПЕРВОЕ переименование для этого босса (тот же риг — 61 кость/31 слот/17.2667с) —
 *    'mechennii.json' → 'mechennii_v2.json'. Атлас/текстура не менялись (побайтово те же).
 *
 * 12.10.2026 (по прямому указанию — "вот два пути, новые две анимации для Меченого и для
 * Охотника, закинь на сервер и переименуй их"): пятое и второе обновления соответственно —
 *  - Охотник: 'okhotnik_v3.json' → 'okhotnik_v4.json'. На этот раз ВПЕРВЫЕ изменился и сам
 *    atlas (не только json) — единственная реальная правка внутри: первая строка
 *    'okhotnik.webp' → 'okhotnik2.webp' (diff подтверждён построчно, координаты регионов не
 *    менялись). Атлас переименован 'okhotnik.atlas' → 'okhotnik2.atlas' (та же логика
 *    cache-bust, что у json), текстура — побайтово совпадает с уже лежащим okhotnik1.webp, но
 *    скопирована ОТДЕЛЬНЫМ файлом 'okhotnik2.webp' (не переиспользован okhotnik1.webp), чтобы
 *    не редактировать присланный атлас руками под чужое имя файла.
 *  - Меченный: 'mechennii_v2.json' → 'mechennii_v3.json'. Атлас/текстура снова побайтово
 *    совпадают с уже лежащими — не переименованы.
 *
 * Run: node tests/boss-spine-okhotnik-json-rename-cache-bust.test.js
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8');
const spineDir = path.join(root, '_client', 'development', 'images', 'spine');

function sha256(p){ return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

console.log('\nTest 1: BOSS_SPINE[0] (Охотник) ссылается на САМОЕ НОВОЕ имя json-файла (v4), не на v3/v2/оригинал');
{
    assert(/\{ atlas: 'okhotnik2\.atlas',\s*json: 'okhotnik_v4\.json',/.test(src),
        'конфиг Охотника указывает на okhotnik_v4.json');
    assert(!/json:\s*'okhotnik\.json'/.test(src) && !/json:\s*'okhotnik_v2\.json'/.test(src) && !/json:\s*'okhotnik_v3\.json'/.test(src),
        'ни одно из старых имён (okhotnik.json/_v2/_v3) больше не используется как активная ссылка в конфиге');
}

console.log('\nTest 2: все четыре файла Охотника (оригинал, v2, v3, v4) реально существуют на диске — старые не удалены, просто не используются');
{
    const origPath = path.join(spineDir, 'okhotnik.json');
    const v2Path   = path.join(spineDir, 'okhotnik_v2.json');
    const v3Path   = path.join(spineDir, 'okhotnik_v3.json');
    const v4Path   = path.join(spineDir, 'okhotnik_v4.json');
    assert(fs.existsSync(origPath) && fs.statSync(origPath).size > 0, 'оригинальный okhotnik.json существует (не удалён)');
    assert(fs.existsSync(v2Path) && fs.statSync(v2Path).size > 0, 'okhotnik_v2.json существует (не удалён)');
    assert(fs.existsSync(v3Path) && fs.statSync(v3Path).size > 0, 'okhotnik_v3.json существует (не удалён)');
    assert(fs.existsSync(v4Path) && fs.statSync(v4Path).size > 0, 'новый okhotnik_v4.json существует и не пустой');
    const h = [origPath, v2Path, v3Path, v4Path].map(sha256);
    assert(new Set(h).size === 4, 'все четыре файла реально различаются по содержимому (не пустые переименования без смены контента)');
}

console.log('\nTest 3: 12.10.2026 — ВПЕРВЫЕ переименован и сам atlas Охотника (не только json), т.к. его содержимое реально изменилось (ссылка на текстуру)');
{
    assert(/atlas:\s*'okhotnik2\.atlas'/.test(src), 'atlas теперь okhotnik2.atlas (переименован вместе с json)');
    assert(!/atlas:\s*'okhotnik\.atlas'/.test(src), 'старое имя okhotnik.atlas больше не используется как активная ссылка в конфиге');

    const oldAtlasPath = path.join(spineDir, 'okhotnik.atlas');
    const newAtlasPath = path.join(spineDir, 'okhotnik2.atlas');
    assert(fs.existsSync(oldAtlasPath) && fs.existsSync(newAtlasPath), 'оба атласа (старый okhotnik.atlas и новый okhotnik2.atlas) существуют на диске');
    assert(sha256(oldAtlasPath) !== sha256(newAtlasPath), 'новый атлас реально отличается от старого по содержимому');

    const oldAtlas = fs.readFileSync(oldAtlasPath, 'utf-8');
    const newAtlas = fs.readFileSync(newAtlasPath, 'utf-8');
    assert(oldAtlas.split(/\r?\n/)[0] === 'okhotnik.webp', 'старый атлас (как и раньше) ссылается на okhotnik.webp первой строкой');
    assert(newAtlas.split(/\r?\n/)[0] === 'okhotnik2.webp', 'новый атлас ссылается на okhotnik2.webp первой строкой — именно это и изменилось');

    // Текстура побайтово совпадает с уже используемым okhotnik1.webp (та же картинка), но
    // скопирована ОТДЕЛЬНЫМ файлом под именем, которое буквально требует новый атлас — редактировать
    // присланный атлас под чужое имя файла руками не стали (риск опечатки в координатах регионов).
    const newWebpPath = path.join(spineDir, 'okhotnik2.webp');
    const okhotnik1WebpPath = path.join(spineDir, 'okhotnik1.webp');
    assert(fs.existsSync(newWebpPath) && fs.statSync(newWebpPath).size > 0, 'okhotnik2.webp существует и не пустой');
    assert(sha256(newWebpPath) === sha256(okhotnik1WebpPath),
        'okhotnik2.webp побайтово совпадает с уже использовавшейся текстурой okhotnik1.webp (та же картинка, новое имя под новый atlas)');
}

console.log('\nTest 4: BOSS_SPINE[3] (Меченный) ссылается на САМОЕ НОВОЕ имя json-файла (v3), не на v2/оригинал');
{
    assert(/\{ atlas: 'mechennii\.atlas',\s*json: 'mechennii_v3\.json',/.test(src),
        'конфиг Меченного указывает на mechennii_v3.json');
    assert(!/json:\s*'mechennii\.json'/.test(src) && !/json:\s*'mechennii_v2\.json'/.test(src),
        'ни оригинал mechennii.json, ни предыдущее mechennii_v2.json больше не используются как активная ссылка в конфиге');
}

console.log('\nTest 5: все три файла Меченного (оригинал, v2, v3) реально существуют на диске, атлас/текстура НЕ переименованы (побайтово не менялись ни разу)');
{
    const origPath = path.join(spineDir, 'mechennii.json');
    const v2Path   = path.join(spineDir, 'mechennii_v2.json');
    const v3Path   = path.join(spineDir, 'mechennii_v3.json');
    assert(fs.existsSync(origPath) && fs.statSync(origPath).size > 0, 'оригинальный mechennii.json существует (не удалён)');
    assert(fs.existsSync(v2Path) && fs.statSync(v2Path).size > 0, 'mechennii_v2.json существует (не удалён)');
    assert(fs.existsSync(v3Path) && fs.statSync(v3Path).size > 0, 'новый mechennii_v3.json существует и не пустой');
    const h = [origPath, v2Path, v3Path].map(sha256);
    assert(new Set(h).size === 3, 'все три файла реально различаются по содержимому');

    assert(/atlas:\s*'mechennii\.atlas'/.test(src), 'atlas по-прежнему mechennii.atlas (ни разу не переименован — содержимое не менялось)');
    const atlasPath = path.join(spineDir, 'mechennii.atlas');
    const webpPath  = path.join(spineDir, 'mechennii.webp');
    assert(fs.existsSync(atlasPath) && fs.existsSync(webpPath), 'mechennii.atlas/mechennii.webp существуют под прежними именами');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
