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

console.log('\nTest 1: BOSS_SPINE[0] (Охотник) ссылается на НОВОЕ имя json-файла, не на старое');
{
    assert(/\{ atlas: 'okhotnik\.atlas',\s*json: 'okhotnik_v2\.json',/.test(src),
        'конфиг Охотника указывает на okhotnik_v2.json');
    assert(!/json:\s*'okhotnik\.json'/.test(src),
        'старое имя okhotnik.json больше нигде не используется как активная ссылка в конфиге');
}

console.log('\nTest 2: оба файла (старый и новый) реально существуют на диске — старый не удалён, просто не используется');
{
    const oldPath = path.join(spineDir, 'okhotnik.json');
    const newPath = path.join(spineDir, 'okhotnik_v2.json');
    assert(fs.existsSync(oldPath) && fs.statSync(oldPath).size > 0, 'старый okhotnik.json существует (не удалён, оставлен на случай отката)');
    assert(fs.existsSync(newPath) && fs.statSync(newPath).size > 0, 'новый okhotnik_v2.json существует и не пустой');
    assert(sha256(oldPath) !== sha256(newPath), 'новый файл реально отличается от старого по содержимому (не пустое переименование без смены контента)');
}

console.log('\nTest 3: атлас/текстура НЕ переименованы (побайтово не менялись между экспортами — переименовывать нечего)');
{
    assert(/atlas:\s*'okhotnik\.atlas'/.test(src), 'atlas по-прежнему okhotnik.atlas (не переименован)');
    const atlasPath = path.join(spineDir, 'okhotnik.atlas');
    const webpPath  = path.join(spineDir, 'okhotnik.webp');
    assert(fs.existsSync(atlasPath) && fs.existsSync(webpPath), 'okhotnik.atlas/okhotnik.webp существуют под прежними именами');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
