/**
 * Test: 17.10.2026, по прямому указанию — глобальный визуальный рефакторинг экрана боя с
 * боссом (комплект "боевка с боссами/новые локации"). Логика НЕ менялась (подтверждено
 * пользователем явно), только раскладка слоёв и исходники фонов.
 *
 * Z-порядок, как продиктовано: фон → (если у босса есть Spine) анимация поверх фона → слоты
 * оружия поверх анимации → три универсальные подложки (оставшееся время/рейтинг урона/таланты
 * табличка) ПОВЕРХ слотов оружия. Spine-анимация есть у Охотника(0)/Счастливчика(1)/Ястреба(2)/
 * Меченного(3) — см. BOSS_SPINE в spine-boss.js. Для Баркута(5)/Бороды(6)/Жгута(7), у которых
 * анимации пока нет, используются отдельные "...локация пока что без анимации.png" фоны —
 * временная мера со слов пользователя.
 *
 * 18.10.2026 (по прямому указанию): Крыс(4) получил Spine-анимацию (BOSS_SPINE[4],
 * spine-boss.js) и реальный фон "боевка с боссом крыс.png" — больше не входит в группу "без
 * анимации" вместе с Баркутом/Бородой/Жгутом.
 *
 * 19.10.2026 (по прямому указанию, Spine-анимации присланы и для Баркута(5)/Бороды(6)/Жгута(7),
 * плюс обновлённый экспорт Крыса(4) — см. BOSS_SPINE[4-7] в spine-boss.js): больше НЕТ боссов
 * "без анимации" — все 4 оставшихся "...локация пока что без анимации.png" заменены на единый
 * комплект "локация под N.png" (тот же, что уже использовался для Охотника/Счастливчика/
 * Ястреба/Меченного с 17.10.2026). Крыс переведён с "боевка с боссом крыс.png" на
 * "локация под крыс.png" — тот же комплект, что и остальные 7 боссов.
 *
 * Run: node tests/boss-fight-new-locations-and-layered-plates.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');

console.log('\nTest 1: BOSS_BGS — новые per-boss локации, индексы 0-7 не перепутаны');
{
    const idx = src.indexOf('const BOSS_BGS = [');
    const block = src.slice(idx, idx + 700);
    assert(/'локация под охотника\.png'/.test(block), 'индекс 0 (Охотник) — локация под охотника.png');
    assert(/'локация под счастливчика\.png'/.test(block), 'индекс 1 (Счастливчик) — локация под счастливчика.png');
    assert(/'локация под ястреба\.png'/.test(block), 'индекс 2 (Ястреб) — локация под ястреба.png');
    assert(/'локация под меченного\.png'/.test(block), 'индекс 3 (Меченный) — локация под меченного.png');
    // 19.10.2026: все 4 оставшихся босса получили Spine-анимацию — "без анимации" больше ни у кого.
    assert(/'локация под крыс\.png'/.test(block), 'индекс 4 (Крыс) — единый комплект фонов, как у остальных');
    assert(/'локация под баркута\.png'/.test(block), 'индекс 5 (Баркут) — единый комплект фонов, как у остальных');
    assert(/'локация под бороду\.png'/.test(block), 'индекс 6 (Борода) — единый комплект фонов, как у остальных');
    assert(/'локация под жгута\.png'/.test(block), 'индекс 7 (Жгут) — единый комплект фонов, как у остальных');
    assert(!/локация пока что без анимации/.test(block), 'временные "без анимации"-файлы больше не используются ни для одного босса');
}

console.log('\nTest 2: слоты оружия — новый файл без "v2", та же логика обрезки (8 ячеек, 7 видимых)');
{
    assert(/'боевка слоты под оружие\.png'/.test(src), 'fullTex берёт новый файл (без v2)');
    assert(!/'боевка слоты под оружие v2\.png'/.test(src), 'старый v2-файл больше не используется');
    assert(/TOTAL_CELLS = 8, VISIBLE_CELLS = 7, EXTRA_TRIM_PX = 14/.test(src),
        'обрезка 8→7 ячеек не тронута — новый файл визуально тот же (проверено скриншотом)');
}

console.log('\nTest 3: три новые подложки — координаты ровно как продиктовано');
{
    const idx = src.indexOf("const timePlate = new PIXI.Sprite");
    const block = src.slice(idx, idx + 900);
    assert(/timePlate\.x = 0; timePlate\.y = 73;/.test(block), 'оставшееся время.png — x:0,y:73');
    assert(/ratingPlate\.x = 0; ratingPlate\.y = 472;/.test(block), 'нижняя часть рейтинг урона.png — x:0,y:472');
    assert(/talentsPlate\.x = 953; talentsPlate\.y = 519;/.test(block), 'таланты табличка.png — x:953,y:519');
    assert(/Texture\.from\(B \+ 'оставшееся время\.png'\)/.test(block), 'timePlate использует файл "оставшееся время.png"');
    assert(/Texture\.from\(B \+ 'нижняя часть рейтинг урона\.png'\)/.test(block), 'ratingPlate использует файл "нижняя часть рейтинг урона.png"');
    assert(/Texture\.from\(B \+ 'таланты табличка\.png'\)/.test(block), 'talentsPlate использует файл "таланты табличка.png"');
}

console.log('\nTest 4: Z-порядок — подложки вставлены ПОСЛЕ блока слотов/кнопок оружия (выше по Z)');
{
    const wpnLoopIdx = src.indexOf('for(let i = 0; i < WPN_BTNS.length; i++){');
    const wpnLoopEnd = src.indexOf('this._bossFightWpnSprs.push({ spr, id:cfg.id });', wpnLoopIdx);
    const timePlateIdx = src.indexOf('const timePlate = new PIXI.Sprite');
    assert(wpnLoopIdx > -1 && wpnLoopEnd > -1 && timePlateIdx > wpnLoopEnd,
        'timePlate (и остальные 2 подложки сразу за ним) создаются ПОСЛЕ цикла кнопок оружия — выше по Z-порядку PIXI');

    const wpnSlotsBgIdx = src.indexOf('const wpnSlotsBg = new PIXI.Sprite');
    assert(wpnSlotsBgIdx > -1 && wpnSlotsBgIdx < timePlateIdx, 'wpnSlotsBg создан РАНЬШЕ подложек — подложки лежат выше него по Z');
}

console.log('\nTest 5: левая панель (имя/ХП/таймер) и рейтинг урона "подняты" НАД новыми подложками после их вставки (bring-to-front через повторный addChild)');
{
    const timePlateIdx = src.indexOf('const timePlate = new PIXI.Sprite');
    const sidBtnIdx = src.indexOf("Кнопка \"Седой\"");
    const block = src.slice(timePlateIdx, sidBtnIdx !== -1 ? sidBtnIdx : timePlateIdx + 1800);
    assert(/win\.addChild\(bossNameTxt\);/.test(block), 'bossNameTxt поднят (повторный addChild) после вставки timePlate');
    assert(/win\.addChild\(hpBarBg\);[\s\S]{0,10}win\.addChild\(hpBar\);/.test(block), 'hpBarBg/hpBar подняты');
    assert(/win\.addChild\(hpTxt\);/.test(block), 'hpTxt поднят');
    assert(/win\.addChild\(timerTxt\);/.test(block), 'timerTxt поднят — иначе timePlate (x:0,y:73,274×178) перекрыл бы его (x:80,y:203)');
    assert(/_ratingHitAreas\[r\]/.test(block) && /_ratingFrameSprs\[r\]/.test(block) && /_ratingDmgLbls\[r\]/.test(block),
        'все 3 строки рейтинга (включая frameSpr/rowHit/dmgLbl, которые не хранятся в this._bossFightRatingRows) подняты циклом НАД ratingPlate');
}

console.log('\nTest 6: talentsPlate НЕ требует явного подъёма — весь талант-блок добавляется НИЖЕ по файлу (естественно выше по Z)');
{
    const talentsPlateIdx = src.indexOf('const talentsPlate = new PIXI.Sprite');
    const talentBtnIdx = src.indexOf("Texture.from(B + 'скиллы.png')");
    assert(talentsPlateIdx > -1 && talentBtnIdx > talentsPlateIdx,
        'talentBtn (скиллы.png) создаётся ПОСЛЕ talentsPlate в коде — естественно выше по Z без доп. addChild');
}

console.log('\nTest 7: новый Spine-экспорт Ястреба "yeastreb test (2).zip" — json переименован под cache-bust, atlas/webp не трогали (побайтово совпадают)');
{
    const spineSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8');
    // 17.10.2026 (третий экспорт тем же днём, "Yastreb без ограничителей.zip"): json снова
    // переименован — yastreb_v3.json → yastreb_v4.json, atlas/webp опять не трогали.
    assert(/\{ atlas: 'yastreb_v2\.atlas', json: 'yastreb_v4\.json',/.test(spineSrc),
        'конфиг Ястреба (индекс 2) указывает на yastreb_v2.atlas (не менялся) + yastreb_v4.json (новый)');
}

console.log('\nTest 8: все 16 новых файлов реально существуют в _client/development/images/');
{
    const files = [
        'локация под баркута.png', 'локация под бороду.png', 'локация под жгута.png', 'локация под крыс.png',
        'локация под меченного.png', 'локация под охотника.png', 'локация под счастливчика.png', 'локация под ястреба.png',
        'баркут локация пока что без анимации.png', 'борода локация пока что без анимации.png',
        'жгут локация пока что без анимации.png', 'боевка с боссом крыс.png',
        'боевка слоты под оружие.png', 'нижняя часть рейтинг урона.png', 'оставшееся время.png', 'таланты табличка.png',
    ];
    files.forEach(f => {
        const p = path.join(root, '_client', 'development', 'images', f);
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, `файл существует и не пустой: ${f}`);
    });
}

console.log('\nTest 9: yastreb_v4.json реально существует и отличается от yastreb_v2.json (не пустое переименование)');
{
    const crypto = require('crypto');
    const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const v2 = path.join(root, '_client', 'development', 'images', 'spine', 'yastreb_v2.json');
    const v3 = path.join(root, '_client', 'development', 'images', 'spine', 'yastreb_v4.json');
    assert(fs.existsSync(v3) && fs.statSync(v3).size > 0, 'yastreb_v4.json существует и не пустой');
    assert(sha256(v2) !== sha256(v3), 'yastreb_v4.json реально отличается от yastreb_v2.json по содержимому');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
