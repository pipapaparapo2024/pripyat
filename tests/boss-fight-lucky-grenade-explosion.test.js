/**
 * Test: репорт 08.10.2026 — "граната должна взрываться в момент, когда Счастливчик её бросает".
 *
 * Первая попытка (эта же дата, раньше в сессии) моделировала взрыв как ОДНОРАЗОВЫЙ эффект,
 * запускаемый триггером при пересечении throwTime=8.5333с (момент, когда граната пропадает из
 * руки в lucky.json) — `state.setAnimation(0, anim, false)` c нуля. Пользователь сообщил, что
 * взрыва до сих пор не видно — разбор lucky_explosion.json покадрово показал АРХИТЕКТУРНУЮ
 * причину: это не короткий эффект, а ПОЛНАЯ параллельная дорожка, синхронизированная с тем же
 * циклом, что и основная анимация lucky.json:
 *   слот 'granata2' (граната в полёте)   — attachment виден t=8.5333..8.9667
 *   слот 'boom1' (кадры взрыва)          — attachment виден t=8.9333..9.9333, rgba гаснет к концу
 *   кость 'granata2' (translate/rotate)  — кейфреймы t=5.3667..10.2333
 * Видимый контент взрыва начинается на t=8.53 ОТ СТАРТА ЕГО СОБСТВЕННОГО трека — поэтому
 * перезапуск "с нуля" в момент броска у основного персонажа показывал вспышку с опозданием почти
 * на целый виток (не совпадало с циклом основной анимации, который короче паузы до появления
 * взрыва). Также у lucky.json реальная длина цикла (максимальный time среди ВСЕХ таймлайнов) —
 * 10.6667с, у lucky_explosion.json — 10.2333с (другая, не совпадает).
 *
 * Исправление: никакого триггера/одноразового проигрывания — explosion.trackEntry создаётся
 * ОДИН раз с loop:true при загрузке, а его trackTime каждый кадр выставляется НАПРЯМУЮ от
 * entry.loopElapsed (общие часы с основным персонажем, Spine сам берёт по модулю СВОЕЙ duration
 * через TrackEntry.getAnimationTime() — расхождение в длине цикла (10.6667 vs 10.2333) не
 * копится, т.к. это не независимое накопление времени, а прямое присваивание от одного источника).
 *
 * Run: node tests/boss-fight-lucky-grenade-explosion.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8'
);

function maxKeyframeTime(animNode) {
    let max = 0;
    (function scan(o) {
        if (Array.isArray(o)) { o.forEach(scan); return; }
        if (o && typeof o === 'object') {
            if (typeof o.time === 'number' && o.time > max) max = o.time;
            for (const k in o) if (k !== 'time') scan(o[k]);
        }
    })(animNode);
    return max;
}

console.log('\nTest 1: lucky.json и lucky_explosion.json действительно имеют РАЗНУЮ длину цикла (обосновывает прямую синхронизацию trackTime, а не независимый update(delta))');
{
    const lucky = JSON.parse(fs.readFileSync(
        path.join(root, '_client', 'development', 'images', 'spine', 'lucky.json'), 'utf-8'));
    const explosion = JSON.parse(fs.readFileSync(
        path.join(root, '_client', 'development', 'images', 'spine', 'lucky_explosion.json'), 'utf-8'));

    const luckyDuration = maxKeyframeTime(lucky.animations.animation);
    const explosionDuration = maxKeyframeTime(explosion.animations.animation);

    assert(Math.abs(luckyDuration - 10.6667) < 0.001, `lucky.json duration (${luckyDuration.toFixed(4)}) = 10.6667с`);
    assert(Math.abs(explosionDuration - 10.2333) < 0.001, `lucky_explosion.json duration (${explosionDuration.toFixed(4)}) = 10.2333с`);
    assert(Math.abs(luckyDuration - explosionDuration) > 0.01,
        'длины циклов РАЗНЫЕ — независимый update(delta) на двух скелетах разошёлся бы по фазе, прямая синхронизация trackTime — нет');
}

console.log('\nTest 2: видимый контент взрыва (граната в полёте / кадры boom) начинается далеко НЕ с t=0 собственного трека — доказывает, что "перезапуск с нуля по триггеру" не мог совпасть по времени с основным циклом');
{
    const explosion = JSON.parse(fs.readFileSync(
        path.join(root, '_client', 'development', 'images', 'spine', 'lucky_explosion.json'), 'utf-8'));
    const slots = explosion.animations.animation.slots;
    const granataFirstVisible = slots.granata2.attachment.find(k => k.name !== undefined);
    const boomFirstVisible = slots.boom1.attachment.find(k => k.name !== undefined);
    assert(granataFirstVisible && Math.abs(granataFirstVisible.time - 8.5333) < 0.001,
        `граната в полёте впервые видна на t=${granataFirstVisible ? granataFirstVisible.time : '?'} собственного трека (не t=0)`);
    assert(boomFirstVisible && Math.abs(boomFirstVisible.time - 8.9333) < 0.001,
        `кадры взрыва впервые видны на t=${boomFirstVisible ? boomFirstVisible.time : '?'} собственного трека (не t=0)`);
}

console.log('\nTest 3: BOSS_SPINE[1].explosion — конфиг без throwTime, позиция/масштаб согласованы с основным персонажем через компенсацию root.scale');
{
    assert(/explosion:\s*\{\s*atlas:\s*'lucky_explosion\.atlas',\s*json:\s*'lucky_explosion\.json'/.test(src),
        'explosion-конфиг ссылается на lucky_explosion.atlas/json');
    assert(!/throwTime:\s*[\d.]+/.test(src),
        'throwTime как поле конфига полностью убран — синхронизация теперь не завязана на программный триггер-момент (слово может остаться только в тексте комментария, описывающем СТАРЫЙ подход)');
    // 10.10.2026 (по прямому указанию, сначала "сделай взрыв 0.25 примерно", затем "сделай в
    // натуральном размере, как она написана" (scale:1.0), затем — по скриншоту с "разбросанным"
    // взрывом — выяснилось, что кость 'boom' внутри lucky_explosion.json несёт СВОЙ собственный
    // запечённый scale-таймлайн (~3.6×) плюс translate до y≈1216 (почти 2× высоты канваса), т.е.
    // "натуральный размер" на деле ~1340px и улетает за кадр 1280×720): масштаб возвращён на 0.25,
    // при котором и кадр (~335px), и смещения костей (до ~304px по Y) укладываются в канвас.
    //
    // 10.10.2026 (по прямому указанию, со скриншотом — "дым поднимается выше взрыва, подними
    // немного, 0.32"): 0.25 → 0.32, чисто визуальная подстройка, позиция (680,673) не менялась.
    // 10.10.2026 (по прямому указанию — "скейл с 0.32 до 0.44"): 0.32 → 0.44, та же логика.
    assert(/x:\s*680,\s*y:\s*673,\s*scale:\s*0\.44/.test(src),
        'позиция взрыва (680,673) совпадает с основным персонажем, масштаб 0.44 (поднят с 0.32 по прямому указанию)');
}

console.log('\nTest 4: _loadSpineSkeleton отдаёт trackEntry наружу (нужен для прямого управления trackTime у взрыва)');
{
    assert(/onReady\(\{\s*skeleton,\s*state,\s*renderer,\s*trackEntry,\s*duration:/.test(src),
        'onReady() передаёт trackEntry в объект результата загрузки');
}

console.log('\nTest 5: tick() синхронизирует взрыв прямой установкой trackTime от loopElapsed — НЕ через setAnimation(loop:false) по триггеру');
{
    assert(!/crossedThrow/.test(src), 'edge-detection "crossedThrow" полностью убрана — взрыв больше не перезапускается по условию');
    assert(!/entry\.explosion\.state\.setAnimation\(0, ecfg\.anim, false\)/.test(src),
        'взрыв больше не запускается одноразово (loop:false) по триггеру');
    assert(/ex\.trackEntry\.trackTime = entry\.loopElapsed/.test(src),
        'trackTime взрыва выставляется НАПРЯМУЮ от loopElapsed (общие часы с основным персонажем) каждый кадр');
    assert(/entry\.loopElapsed \+= delta;\s*\n\s*if \(entry\.loopElapsed >= entry\.duration\) entry\.loopElapsed -= entry\.duration;/.test(src),
        'loopElapsed растёт на delta и зацикливается по длительности ОСНОВНОГО персонажа (entry.duration), без привязки к explosion.duration');
}

console.log('\nTest 6: кэш взрыва больше не хранит одноразовые поля playing/elapsed — рисуется каждый кадр без них');
{
    assert(!/entry\.explosion = \{ \.\.\.eLoaded, cfg: ecfg, playing: false, elapsed: 0 \};/.test(src),
        'старая форма кэш-объекта (playing/elapsed) убрана');
    const matches = src.match(/entry\.explosion = \{ \.\.\.eLoaded, cfg: ecfg \};/g) || [];
    assert(matches.length === 2,
        `кэш взрыва собирается новой простой формой БЕЗ playing/elapsed в обоих местах (_spineBossLoad + _spineBossPreloadAll), найдено: ${matches.length}`);
}

console.log('\nTest 7: взрыв грузится ПАРАЛЛЕЛЬНО с основным персонажем, не блокирует его показ (не изменилось в этой правке)');
{
    const loadStart = src.indexOf('proto._spineBossLoad = function(bossIdx, cfg) {');
    const loadEnd    = src.indexOf('proto._spineBossPreloadAll = function()');
    assert(loadStart !== -1 && loadEnd !== -1, '_spineBossLoad найден');
    const body = src.slice(loadStart, loadEnd);
    const mainReadyIdx = body.indexOf('this._spineBossStartLoop();');
    const explosionLoadIdx = body.indexOf('if (cfg.explosion) {');
    assert(mainReadyIdx !== -1 && explosionLoadIdx !== -1, 'оба маркера найдены внутри _spineBossLoad');
    assert(explosionLoadIdx > mainReadyIdx,
        'загрузка взрыва запускается ПОСЛЕ того, как основной персонаж уже показан/в кэше — не задерживает его появление');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
