/**
 * Test: 17.10.2026 (по прямому указанию — "вот путь, который ведёт к новому файлу анимации
 * босса Ястреб [...] переименуй его, дай новый name, чтобы кэш старого не остался").
 *
 * Тот же паттерн cache-bust, что уже применялся к Охотнику/Меченному (см.
 * boss-spine-okhotnik-json-rename-cache-bust.test.js) — _loadSpineSkeleton() (spine-boss.js)
 * грузит json/atlas обычным fetch() БЕЗ cache-busting query-параметра, поэтому заливка под
 * старым именем рискует отдать закэшированную версию.
 *
 * Первое переименование для Ястреба (до сих пор заливался под именем yastreb.* без версии).
 * Все ТРИ файла (atlas/json/webp) реально изменились — md5 разошёлся со старыми при сверке
 * с присланным zip "yeastreb test.zip" — переименованы в yastreb_v2.*. Атлас — текстовый файл,
 * первая строка указывает имя текстуры (см. "Правило tex" в AGENTS.md), поэтому при
 * переименовании webp эту строку внутри .atlas тоже пришлось поправить (yastreb.webp →
 * yastreb_v2.webp), иначе новый атлас продолжил бы искать старое имя файла текстуры.
 *
 * Run: node tests/boss-spine-yastreb-v2-rename-cache-bust.test.js
 */
const fs = require('fs');
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

console.log('\nTest 1: BOSS_SPINE[2] (Ястреб) ссылается на новое имя (yastreb_v2), не на оригинал без версии');
{
    assert(/\{ atlas: 'yastreb_v2\.atlas', json: 'yastreb_v2\.json',/.test(src),
        'конфиг Ястреба указывает на yastreb_v2.atlas/yastreb_v2.json');
    assert(!/atlas:\s*'yastreb\.atlas'/.test(src) && !/json:\s*'yastreb\.json'/.test(src),
        'старые имена (yastreb.atlas/yastreb.json, без версии) больше не используются как активная ссылка в конфиге');
}

console.log('\nTest 2: оба набора файлов (оригинал без версии и новый v2) реально существуют на диске — старый не удалён, просто не используется');
{
    const files = ['atlas', 'json', 'webp'];
    files.forEach(ext => {
        const oldPath = path.join(spineDir, `yastreb.${ext}`);
        const newPath = path.join(spineDir, `yastreb_v2.${ext}`);
        assert(fs.existsSync(oldPath) && fs.statSync(oldPath).size > 0, `оригинальный yastreb.${ext} существует (не удалён)`);
        assert(fs.existsSync(newPath) && fs.statSync(newPath).size > 0, `новый yastreb_v2.${ext} существует и не пустой`);
        assert(sha256(oldPath) !== sha256(newPath), `yastreb_v2.${ext} реально отличается от старого по содержимому (не пустое переименование)`);
    });
}

console.log('\nTest 3: внутренняя ссылка на текстуру в новом атласе (строка 1) указывает на yastreb_v2.webp, не на старое имя');
{
    const newAtlas = fs.readFileSync(path.join(spineDir, 'yastreb_v2.atlas'), 'utf-8');
    const oldAtlas = fs.readFileSync(path.join(spineDir, 'yastreb.atlas'), 'utf-8');
    assert(newAtlas.split(/\r?\n/)[0] === 'yastreb_v2.webp',
        'новый атлас ссылается на yastreb_v2.webp первой строкой — иначе он искал бы несуществующий/чужой файл текстуры');
    assert(oldAtlas.split(/\r?\n/)[0] === 'yastreb.webp',
        'sanity: старый атлас (как и раньше) по-прежнему ссылается на yastreb.webp — его мы не трогали');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
