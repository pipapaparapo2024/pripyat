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

console.log('\nTest 1: BOSS_SPINE[0] (Охотник) ссылается на САМОЕ НОВОЕ имя json-файла (v3), не на v2/оригинал');
{
    assert(/\{ atlas: 'okhotnik\.atlas',\s*json: 'okhotnik_v3\.json',/.test(src),
        'конфиг Охотника указывает на okhotnik_v3.json');
    assert(!/json:\s*'okhotnik\.json'/.test(src) && !/json:\s*'okhotnik_v2\.json'/.test(src),
        'ни старое имя okhotnik.json, ни предыдущее okhotnik_v2.json больше нигде не используются как активная ссылка в конфиге');
}

console.log('\nTest 2: все три файла Охотника (оригинал, v2, v3) реально существуют на диске — старые не удалены, просто не используются');
{
    const origPath = path.join(spineDir, 'okhotnik.json');
    const v2Path   = path.join(spineDir, 'okhotnik_v2.json');
    const v3Path   = path.join(spineDir, 'okhotnik_v3.json');
    assert(fs.existsSync(origPath) && fs.statSync(origPath).size > 0, 'оригинальный okhotnik.json существует (не удалён)');
    assert(fs.existsSync(v2Path) && fs.statSync(v2Path).size > 0, 'okhotnik_v2.json существует (не удалён)');
    assert(fs.existsSync(v3Path) && fs.statSync(v3Path).size > 0, 'новый okhotnik_v3.json существует и не пустой');
    const h = [origPath, v2Path, v3Path].map(sha256);
    assert(new Set(h).size === 3, 'все три файла реально различаются по содержимому (не пустые переименования без смены контента)');
}

console.log('\nTest 3: атлас/текстура Охотника НЕ переименованы (побайтово не менялись между всеми экспортами — переименовывать нечего)');
{
    assert(/atlas:\s*'okhotnik\.atlas'/.test(src), 'atlas по-прежнему okhotnik.atlas (не переименован)');
    const atlasPath = path.join(spineDir, 'okhotnik.atlas');
    const webpPath  = path.join(spineDir, 'okhotnik.webp');
    assert(fs.existsSync(atlasPath) && fs.existsSync(webpPath), 'okhotnik.atlas/okhotnik.webp существуют под прежними именами');
}

console.log('\nTest 4: BOSS_SPINE[3] (Меченный) ссылается на НОВОЕ имя json-файла (v2), не на оригинал');
{
    assert(/\{ atlas: 'mechennii\.atlas',\s*json: 'mechennii_v2\.json',/.test(src),
        'конфиг Меченного указывает на mechennii_v2.json');
    assert(!/json:\s*'mechennii\.json'/.test(src),
        'старое имя mechennii.json больше нигде не используется как активная ссылка в конфиге');
}

console.log('\nTest 5: оба файла Меченного (старый и новый) реально существуют на диске, атлас/текстура не переименованы');
{
    const oldPath = path.join(spineDir, 'mechennii.json');
    const newPath = path.join(spineDir, 'mechennii_v2.json');
    assert(fs.existsSync(oldPath) && fs.statSync(oldPath).size > 0, 'старый mechennii.json существует (не удалён, оставлен на случай отката)');
    assert(fs.existsSync(newPath) && fs.statSync(newPath).size > 0, 'новый mechennii_v2.json существует и не пустой');
    assert(sha256(oldPath) !== sha256(newPath), 'новый файл реально отличается от старого по содержимому');

    assert(/atlas:\s*'mechennii\.atlas'/.test(src), 'atlas по-прежнему mechennii.atlas (не переименован)');
    const atlasPath = path.join(spineDir, 'mechennii.atlas');
    const webpPath  = path.join(spineDir, 'mechennii.webp');
    assert(fs.existsSync(atlasPath) && fs.existsSync(webpPath), 'mechennii.atlas/mechennii.webp существуют под прежними именами');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
