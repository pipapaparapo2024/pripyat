/**
 * Test: 18.10.2026, по прямому указанию — первая Spine-анимация босса Крыс ("Rat.zip":
 * Rat.json/Rat.atlas.txt/Rat.webp). До этого BOSS_SPINE[4] был null (см. комментарий "4-7 —
 * пока без Spine", spine-boss.js) — теперь Крыс встаёт в один ряд с Охотником/Счастливчиком/
 * Ястребом/Меченным. Атлас переименован с .atlas.txt → .atlas при копировании (тот же формат
 * файла — spine всегда экспортирует атлас текстом, расширение .txt было только у присланного
 * архива, остальные боссы в проекте используют .atlas — см. карту файлов в этой же директории).
 *
 * Заодно фон боя для Крыса заменён с временного "крыс локация пока что без анимации.png" на
 * реальный "боевка с боссом крыс.png" (bosses_fight.js) — см. boss-fight-new-locations-and-
 * layered-plates.test.js (Test 1) и boss-fight-weapon-slots-panel-position.test.js (Test 5)
 * для проверки самого BOSS_BGS-массива; этот файл фокусируется ТОЛЬКО на BOSS_SPINE[4].
 *
 * 19.10.2026 (по прямому указанию, новый экспорт "Rat.zip" тем же днём — второе обновление):
 * atlas/webp/json реально изменились (44 кости/32 слота, было 44/30) — все 3 файла переименованы
 * под Rat_v2.* для cache-bust (тот же паттерн, что у yastreb_v2/okhotnik2). Старые Rat.atlas/
 * Rat.json/Rat.webp оставлены на диске неиспользуемыми (на случай отката) — Test 2/3 ниже
 * продолжают проверять ИХ (исторический снимок первого экспорта), Test 4 проверяет Rat_v2.*.
 * Заодно в тот же день подключены Баркут(5)/Борода(6)/Жгут(7) — BOSS_SPINE больше не
 * заканчивается тройкой null, это проверяет Test 1 ниже (обновлён), Test 5 проверяет их файлы.
 *
 * Run: node tests/boss-spine-rat-new-boss-animation.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const spineSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8'
);

console.log('\nTest 1: BOSS_SPINE[4] (Крыс) больше не null — реальный конфиг (19.10.2026: обновлён на Rat_v2), 5-7 больше не null');
{
    const idx = spineSrc.indexOf('const BOSS_SPINE = [');
    const end = spineSrc.indexOf('];', idx);
    const block = spineSrc.slice(idx, end);
    assert(/\{ atlas: 'Rat_v2\.atlas', json: 'Rat_v2\.json',\s*\n\s*x: 680, y: 673, scale: 0\.40, anim: 'animation' \},\s*\/\/ 4 — Крыс/.test(block),
        'конфиг Крыса на позиции 4 — atlas Rat_v2.atlas, json Rat_v2.json (обновлённый экспорт), те же дефолты x/y/scale');
    assert(!/null, null, null, null/.test(block), 'четыре null подряд (4-7) больше не идут одним блоком');
    assert(!/null, null, null/.test(block), 'индексы 5-7 (Баркут/Борода/Жгут) больше НЕ null — у всех есть Spine-конфиг (19.10.2026)');
    assert(/\{ atlas: 'Berkut\.atlas', json: 'Berkut\.json',[\s\S]*?\/\/ 5 — Баркут/.test(block), 'конфиг Баркута на позиции 5');
    assert(/\{ atlas: 'Beard\.atlas', json: 'Beard\.json',[\s\S]*?\/\/ 6 — Борода/.test(block), 'конфиг Бороды на позиции 6');
    assert(/\{ atlas: 'Jgut\.atlas', json: 'Jgut\.json',[\s\S]*?\/\/ 7 — Жгут/.test(block), 'конфиг Жгута на позиции 7');
}

console.log('\nTest 2: файлы Rat.atlas/Rat.json/Rat.webp (первый экспорт, неиспользуемые) всё ещё лежат в _client/development/images/spine/');
{
    const spineDir = path.join(root, '_client', 'development', 'images', 'spine');
    for (const f of ['Rat.atlas', 'Rat.json', 'Rat.webp']) {
        const p = path.join(spineDir, f);
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, `${f} существует и не пустой`);
    }
    const atlasFirstLine = fs.readFileSync(path.join(spineDir, 'Rat.atlas'), 'utf-8').split(/\r?\n/)[0].trim();
    assert(atlasFirstLine === 'Rat.webp', 'первая строка Rat.atlas ссылается на Rat.webp (имя совпадает с реальным файлом текстуры)');
}

console.log('\nTest 3: Rat.json — валидный Spine-скелет с анимацией "animation" (та же, что у остальных боссов)');
{
    const json = JSON.parse(fs.readFileSync(path.join(root, '_client', 'development', 'images', 'spine', 'Rat.json'), 'utf-8'));
    assert(!!json.skeleton, 'секция skeleton присутствует');
    assert(Array.isArray(json.bones) && json.bones.length > 0, 'кости присутствуют, кол-во: ' + (json.bones || []).length);
    assert(Array.isArray(json.slots) && json.slots.length > 0, 'слоты присутствуют, кол-во: ' + (json.slots || []).length);
    assert(json.animations && typeof json.animations === 'object' && 'animation' in json.animations,
        'анимация с именем "animation" существует (совпадает с anim: \'animation\' в BOSS_SPINE[4])');
}

console.log('\nTest 4: Rat_v2.atlas/Rat_v2.json/Rat_v2.webp реально лежат в _client/development/images/spine/ и отличаются от Rat.*');
{
    const crypto = require('crypto');
    const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const spineDir = path.join(root, '_client', 'development', 'images', 'spine');
    for (const f of ['Rat_v2.atlas', 'Rat_v2.json', 'Rat_v2.webp']) {
        const p = path.join(spineDir, f);
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, `${f} существует и не пустой`);
    }
    assert(sha256(path.join(spineDir, 'Rat_v2.json')) !== sha256(path.join(spineDir, 'Rat.json')),
        'Rat_v2.json реально отличается от Rat.json (не пустое переименование)');
    assert(sha256(path.join(spineDir, 'Rat_v2.webp')) !== sha256(path.join(spineDir, 'Rat.webp')),
        'Rat_v2.webp реально отличается от Rat.webp (не пустое переименование)');
    const atlasFirstLine = fs.readFileSync(path.join(spineDir, 'Rat_v2.atlas'), 'utf-8').split(/\r?\n/)[0].trim();
    assert(atlasFirstLine === 'Rat_v2.webp', 'первая строка Rat_v2.atlas ссылается на Rat_v2.webp');
}

console.log('\nTest 5: Berkut/Beard/Jgut — файлы существуют и json валиден (кости/слоты/анимация "animation")');
{
    const spineDir = path.join(root, '_client', 'development', 'images', 'spine');
    for (const name of ['Berkut', 'Beard', 'Jgut']) {
        for (const ext of ['atlas', 'json', 'webp']) {
            const p = path.join(spineDir, `${name}.${ext}`);
            assert(fs.existsSync(p) && fs.statSync(p).size > 0, `${name}.${ext} существует и не пустой`);
        }
        const atlasFirstLine = fs.readFileSync(path.join(spineDir, `${name}.atlas`), 'utf-8').split(/\r?\n/)[0].trim();
        assert(atlasFirstLine === `${name}.webp`, `первая строка ${name}.atlas ссылается на ${name}.webp`);

        const json = JSON.parse(fs.readFileSync(path.join(spineDir, `${name}.json`), 'utf-8'));
        assert(!!json.skeleton, `${name}.json: секция skeleton присутствует`);
        assert(Array.isArray(json.bones) && json.bones.length > 0, `${name}.json: кости присутствуют (${(json.bones||[]).length})`);
        assert(Array.isArray(json.slots) && json.slots.length > 0, `${name}.json: слоты присутствуют (${(json.slots||[]).length})`);
        assert(json.animations && 'animation' in json.animations, `${name}.json: анимация "animation" существует`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
