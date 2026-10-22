/**
 * Test: 22.10.2026, по прямому указанию — два z-order бага, найденные живым тестированием
 * на тестовом сервере (v=648).
 *
 * 1) "Файлы кистей должны быть выше, чем файлы предплечий" — на 3 из 4 экранов персонажа
 *    (home.js/hata.js/shmot_shop.js) это уже было так: их блок переупорядочивания кисти
 *    (addChildAt по индексу this._leftHandSpr/_charLeftHandSpr/_manLeftHandSpr) выполняется
 *    ВСЕГДА при обработке cat:6, независимо от того, надет ли предмет в руке. Но в
 *    player_profile.js (попап профиля ЧУЖОГО игрока) аналогичный блок был обёрнут в
 *    `if(handItemSpr)`, а handItemSpr захватывался ТОЛЬКО когда `def` существует (предмет
 *    реально надет в cat:6) — у игрока без предмета в руке (самый частый случай) весь
 *    reorder-блок не выполнялся вообще, и кисть (handSpr, добавлена в win ДО forearmSpr)
 *    оставалась статично НИЖЕ предплечья. Фикс: handItemSpr теперь захватывается всегда
 *    (`if(s.cat === 6)`, без `&& def`), reorder выполняется независимо от наличия предмета.
 *
 * 2) "Шмотки на голову должны быть выше по Z-индексу, чем шмотки на торс" — это правило уже
 *    было реализовано 24.09.2026 порядком CLOTH_SLOTS/MAN_SLOTS/CHAR_SLOTS (голова сразу
 *    ПОСЛЕ торса в массиве = выше по z). Но 22.10.2026 добавленное исключение "куртки трёх
 *    новых сетов (id102/107/112) поднимаются на самый верх z-порядка" (см. предыдущий батч)
 *    поднимало торс ВЫШЕ ВСЕГО, включая голову — при равенстве этих двух правил голова
 *    снова проигрывала куртке. Фикс: тот же блок исключения теперь переподнимает слот
 *    головы (cat:0) СРАЗУ ПОСЛЕ торса на всех 4 экранах, чтобы голова осталась выше.
 *
 * Run: node tests/oct22-hand-above-forearm-and-head-above-torso.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const profileSrc = readSrc('_client/src/game/shell/overlays/player_profile.js');
const homeSrc     = readSrc('_client/src/game/home.js');
const hataSrc     = readSrc('_client/src/game/shell/overlays/hata.js');
const shopSrc     = readSrc('_client/src/game/shell/overlays/shmot_shop.js');

console.log('\nTest 1: player_profile.js — handItemSpr захватывается независимо от того, надет ли предмет (не только при def)');
{
    assert(/if\(s\.cat === 6\)\{ handItemSpr = spr; handItemDef = def; \}/.test(profileSrc),
        'захват handItemSpr/handItemDef больше не требует `&& def`');
    assert(!/if\(s\.cat === 6 && def\)\{ handItemSpr = spr;/.test(profileSrc),
        'старое условие `s.cat === 6 && def` больше не используется для захвата кисти');
}

console.log('\nTest 2: player_profile.js — голова (headSpr) захватывается для последующего переподнятия выше торса');
{
    assert(/let headSpr = null;/.test(profileSrc), 'headSpr объявлен');
    assert(/if\(s\.cat === 0\)\{ headSpr = spr; \}/.test(profileSrc), 'headSpr захватывается на cat:0');
}

console.log('\nTest 3: все 4 экрана — исключение "куртка выше всего" переподнимает слот головы (cat:0) сразу после торса');
{
    const SCREENS = [
        { name: 'home',    src: homeSrc,    torsoAdd: /root\.layer0_mc\.addChild\(this\._clothSlots\[1\]\);/, headAdd: /if\(this\._clothSlots\[0\]\) root\.layer0_mc\.addChild\(this\._clothSlots\[0\]\);/ },
        { name: 'hata',    src: hataSrc,    torsoAdd: /this\._win\.addChild\(this\._charSlots\[1\]\);/,       headAdd: /if\(this\._charSlots\[0\]\) this\._win\.addChild\(this\._charSlots\[0\]\);/ },
        { name: 'shop',    src: shopSrc,    torsoAdd: /this\._shopWin\.addChild\(this\._manSlots\[1\]\);/,    headAdd: /if\(this\._manSlots\[0\]\) this\._shopWin\.addChild\(this\._manSlots\[0\]\);/ },
        { name: 'profile', src: profileSrc, torsoAdd: /win\.addChild\(torsoSpr\);/,                          headAdd: /if\(headSpr\) win\.addChild\(headSpr\);/ },
    ];
    for(const s of SCREENS){
        assert(s.torsoAdd.test(s.src), `${s.name}: торс поднимается на верх (куртки id102/107/112)`);
        assert(s.headAdd.test(s.src), `${s.name}: голова переподнимается выше торса сразу после`);
        // Порядок внутри блока: addChild торса должен стоять РАНЬШЕ addChild головы (текстово).
        const torsoIdx = s.src.search(s.torsoAdd);
        const headIdx = s.src.search(s.headAdd);
        assert(torsoIdx !== -1 && headIdx !== -1 && torsoIdx < headIdx,
            `${s.name}: addChild(торс) идёт раньше addChild(голова) в коде — голова реально переподнимается ПОСЛЕ`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
