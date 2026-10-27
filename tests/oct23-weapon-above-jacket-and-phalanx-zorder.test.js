/**
 * Test: 23.10.2026, по прямому указанию (скрин — "бита прячется под куртку, такого быть не
 * должно... оружие должно быть поверх всего, кроме самой кисти").
 *
 * Корень бага: torso-jacket-исключение (id102/107/112 — длинный рукав, добавлено 22.10.2026)
 * поднимает торс/голову на самый верх z-порядка ПОСЛЕ того, как цикл по MAN_SLOTS/CLOTH_SLOTS
 * уже корректно переставил кисть/оружие (cat:6) выше. Повторный подъём торса хоронил уже
 * переставленные кисть+оружие под рукавом куртки — отдельный баг от "кисть выше предплечья"
 * (тот уже был починен раньше, см. oct21-new-shmot-sets-and-forearm-hand-split.test.js).
 *
 * Заодно вернули "фаланги правой руки.png" (был неиспользуемым файлом с 21.10.2026, когда его
 * заменили на полную кисть — физически файл не удалялся) — отдельным слоем МЕЖДУ оружием и
 * предплечьем, видим только когда в руке реально что-то зажато. Итоговый z-order (снизу вверх):
 * предплечье → фаланги → оружие → кисть; часы Poker/цепь Teenager (id62/92) — исключение,
 * носятся НА кисти, поэтому остаются выше неё без переподъёма.
 *
 * Применено на всех 4 экранах персонажа: home.js, hata.js, player_profile.js, shmot_shop.js.
 *
 * Run: node tests/oct23-weapon-above-jacket-and-phalanx-zorder.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = p => fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
const homeSrc    = norm(path.join(root, '_client/src/game/home.js'));
const hataSrc     = norm(path.join(root, '_client/src/game/shell/overlays/hata.js'));
const profileSrc  = norm(path.join(root, '_client/src/game/shell/overlays/player_profile.js'));
const shopSrc     = norm(path.join(root, '_client/src/game/shell/overlays/shmot_shop.js'));

console.log('\nTest 1: файл "фаланги правой руки.png" физически существует (проверено — не удалён со времён 21.10.2026)');
{
    assert(fs.existsSync(path.join(root, '_client/development/images/фаланги правой руки.png')),
        'фаланги правой руки.png — есть локально');
}

console.log('\nTest 2: shmot_shop.js — phalanxSpr создан, добавлен в cat:6 вместе с rightHandSpr, скрыт по умолчанию');
{
    assert(/const phalanxSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/фаланги правой руки\.png'\)\);/.test(shopSrc),
        'phalanxSpr создаётся из правильного файла');
    assert(/phalanxSpr\.visible = false;/.test(shopSrc), 'по умолчанию скрыт (виден только при реально зажатом предмете)');
    assert(/this\._manPhalanxSpr = phalanxSpr;/.test(shopSrc), 'сохранён в this._manPhalanxSpr');
    assert(/if\(s\.cat === 6\)\{ win\.addChild\(rightHandSpr\); win\.addChild\(phalanxSpr\); \}/.test(shopSrc),
        'phalanxSpr добавлен в сцену в том же условии cat:6, что и кисть');
}

console.log('\nTest 3: shmot_shop.js — внутри _updateManSprites() порядок снизу вверх: фаланги → оружие → кисть');
{
    const m = shopSrc.match(/proto\._updateManSprites = function\(\)\{[\s\S]*?\n    \};/);
    assert(!!m, '_updateManSprites блок найден');
    const body = m ? m[0] : '';
    assert(/if\(this\._manPhalanxSpr\) this\._manPhalanxSpr\.visible = !!\(_handWeaponHeld && !eq\.handBuiltIn\);/.test(body),
        'видимость фаланг управляется тем же признаком _handWeaponHeld (и не у handBuiltIn-предметов)');
    const phalanxIdx = body.indexOf('this._shopWin.addChildAt(this._manPhalanxSpr,');
    const weaponIdx = body.indexOf('this._shopWin.addChildAt(spr, Math.min(topIdx');
    const handIdx = body.indexOf('this._shopWin.addChildAt(this._manRightHandSpr, this._shopWin.getChildIndex(spr) + 1);');
    assert(phalanxIdx !== -1 && weaponIdx !== -1 && handIdx !== -1 && phalanxIdx < weaponIdx && weaponIdx < handIdx,
        'порядок addChildAt в коде: фаланги раньше оружия раньше кисти (снизу вверх по z-индексу)');
}

console.log('\nTest 4: shmot_shop.js — torso-jacket-исключение переподнимает фаланги/оружие/кисть ПОСЛЕ куртки');
{
    const m = shopSrc.match(/const _torsoEq = \(this\.items \|\| \[\]\)\.find\(it => it\.cat === 1 && it\.equipped\);[\s\S]*?\n        \}\n    \};/);
    assert(!!m, 'torso-exception блок найден');
    const body = m ? m[0] : '';
    assert(/this\._shopWin\.addChild\(this\._manSlots\[1\]\);/.test(body), 'торс поднимается первым');
    assert(/if\(this\._manSlots\[0\]\) this\._shopWin\.addChild\(this\._manSlots\[0\]\);/.test(body), 'голова поднимается следом');
    const phalanxReraise = body.indexOf('this._shopWin.addChild(this._manPhalanxSpr);');
    const weaponReraise  = body.indexOf('if(this._manSlots[6]) this._shopWin.addChild(this._manSlots[6]);');
    const handReraise    = body.indexOf('this._shopWin.addChild(this._manRightHandSpr);');
    assert(phalanxReraise !== -1 && weaponReraise !== -1 && handReraise !== -1 && phalanxReraise < weaponReraise && weaponReraise < handReraise,
        'после куртки повторно поднимаются фаланги → оружие → кисть, именно в этом порядке');
    assert(/const _handEq = \(this\.items \|\| \[\]\)\.find\(it => it\.cat === 6 && it\.equipped\);/.test(body),
        'отдельно вычисляется надетый предмет в руке для решения про часы/цепь/handBuiltIn');
    // 23.10.2026 (повторный скрин — "Сайга/Пистолет/Кружка должны быть МЕНЬШЕ по Z-индексу, чем
    // куртка; часы на руке тоже под курткой"): переподъём теперь условен целиком на
    // _handWeaponHeld2 (НЕ часы/цепь И НЕ handBuiltIn) — часы/цепь/Сайга/Пистолет/Кружка вообще
    // не входят в блок переподъёма (остаются под курткой), а не "переподнимаются, но без кисти
    // сверху", как было раньше — см. oct23-weapon-below-jacket-and-tooltip-topmost.test.js.
    // 26.10.2026 (по прямому указанию, скрин — "бита исполнителя должна быть поверх шмоток на
    // торс"): id117 добавлено как исключение из handBuiltIn-блокировки — см.
    // oct25-executive-set-z-order-and-calibration.test.js Test 6 за детальную проверку.
    assert(/const _handWeaponHeld2 = _handEq && _handEq\.id !== 62 && _handEq\.id !== 92 && \(!_handEq\.handBuiltIn \|\| _handEq\.id === 117\);/.test(body),
        '_handWeaponHeld2 исключает часы/цепь (id62/92) И handBuiltIn-предметы (кроме id117) из переподъёма');
    assert(/if\(_handWeaponHeld2\)\{/.test(body), 'переподъём фаланг/оружия/кисти выполняется только при _handWeaponHeld2');
}

console.log('\nTest 5: home.js — те же три проверки (создание phalanxSpr, порядок в updateClothes(), переподъём после куртки)');
{
    assert(/this\._phalanxSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/фаланги правой руки\.png'\)\);/.test(homeSrc),
        'this._phalanxSpr создаётся из правильного файла');
    assert(/this\._phalanxSpr\.visible = false;/.test(homeSrc), 'по умолчанию скрыт');
    assert(/if\(s\.cat === 6\)\{ root\.layer0_mc\.addChild\(this\._rightHandSpr\); root\.layer0_mc\.addChild\(this\._phalanxSpr\); \}/.test(homeSrc),
        'phalanxSpr добавлен в сцену в том же условии cat:6, что и кисть');

    const updM = homeSrc.match(/updateClothes\(\)\{[\s\S]*?\n\t\}/);
    const updBody = updM ? updM[0] : '';
    assert(/if\(this\._phalanxSpr\) this\._phalanxSpr\.visible = !!\(_handWeaponHeld && !eq\.handBuiltIn\);/.test(updBody),
        'видимость фаланг управляется _handWeaponHeld');
    const pIdx = updBody.indexOf('root.layer0_mc.addChildAt(this._phalanxSpr,');
    const wIdx = updBody.indexOf('root.layer0_mc.addChildAt(spr, Math.min(topIdx');
    const hIdx = updBody.indexOf('root.layer0_mc.addChildAt(this._rightHandSpr, root.layer0_mc.getChildIndex(spr) + 1);');
    assert(pIdx !== -1 && wIdx !== -1 && hIdx !== -1 && pIdx < wIdx && wIdx < hIdx,
        'порядок в updateClothes(): фаланги раньше оружия раньше кисти');

    const torsoM = homeSrc.match(/const _torsoEq = \(shmot\.items \|\| \[\]\)\.find\(it => it\.cat === 1 && it\.equipped\);[\s\S]*?\n\t\t\}\n\t\}/);
    const torsoBody = torsoM ? torsoM[0] : '';
    assert(!!torsoM, 'torso-exception блок найден в home.js');
    const pR = torsoBody.indexOf('root.layer0_mc.addChild(this._phalanxSpr);');
    const wR = torsoBody.indexOf('if(this._clothSlots[6]) root.layer0_mc.addChild(this._clothSlots[6]);');
    const hR = torsoBody.indexOf('root.layer0_mc.addChild(this._rightHandSpr);');
    assert(pR !== -1 && wR !== -1 && hR !== -1 && pR < wR && wR < hR,
        'после куртки повторно поднимаются фаланги → оружие → кисть');
}

console.log('\nTest 6: hata.js — те же три проверки (переменные this._char*)');
{
    assert(/this\._charPhalanxSpr = phalanxSpr;/.test(hataSrc), 'this._charPhalanxSpr сохранён');
    assert(/if\(s\.cat === 6\)\{ win\.addChild\(rightHandSpr\); win\.addChild\(phalanxSpr\); \}/.test(hataSrc),
        'phalanxSpr добавлен в сцену в том же условии cat:6');

    const updM = hataSrc.match(/_updateCharClothes\(\)\{[\s\S]*?\n    \}/);
    const updBody = updM ? updM[0] : '';
    assert(/if\(this\._charPhalanxSpr\) this\._charPhalanxSpr\.visible = !!\(_handWeaponHeld && !eq\.handBuiltIn\);/.test(updBody),
        'видимость фаланг управляется _handWeaponHeld');
    const pIdx = updBody.indexOf('this._win.addChildAt(this._charPhalanxSpr,');
    const wIdx = updBody.indexOf('this._win.addChildAt(spr, Math.min(topIdx');
    const hIdx = updBody.indexOf('this._win.addChildAt(this._charRightHandSpr, this._win.getChildIndex(spr) + 1);');
    assert(pIdx !== -1 && wIdx !== -1 && hIdx !== -1 && pIdx < wIdx && wIdx < hIdx,
        'порядок в _updateCharClothes(): фаланги раньше оружия раньше кисти');

    const torsoM = hataSrc.match(/const _torsoEq = \(shmot\.items \|\| \[\]\)\.find\(it => it\.cat === 1 && it\.equipped\);[\s\S]*?\n        \}\n    \}/);
    const torsoBody = torsoM ? torsoM[0] : '';
    assert(!!torsoM, 'torso-exception блок найден в hata.js');
    const pR = torsoBody.indexOf('this._win.addChild(this._charPhalanxSpr);');
    const wR = torsoBody.indexOf('if(this._charSlots[6]) this._win.addChild(this._charSlots[6]);');
    const hR = torsoBody.indexOf('this._win.addChild(this._charRightHandSpr);');
    assert(pR !== -1 && wR !== -1 && hR !== -1 && pR < wR && wR < hR,
        'после куртки повторно поднимаются фаланги → оружие → кисть');
}

console.log('\nTest 7: player_profile.js — phalanxSpr создан локальной переменной, добавлен в win сразу после handSpr');
{
    assert(/const phalanxSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/фаланги правой руки\.png'\)\);/.test(profileSrc),
        'phalanxSpr создаётся из правильного файла');
    assert(/phalanxSpr\.visible = !!\(_handWeaponHeld && !\(handItemDef && handItemDef\.handBuiltIn\)\);/.test(profileSrc),
        'видимость выставлена сразу при создании (профиль пересобирается с нуля при каждом открытии)');
    assert(/win\.addChild\(phalanxSpr\);/.test(profileSrc), 'phalanxSpr добавлен в сцену');

    const m = profileSrc.match(/if\(handItemSpr\)\{[\s\S]*?\n        \}/);
    const body = m ? m[0] : '';
    assert(!!m, 'блок переупорядочивания if(handItemSpr) найден');
    assert(/if\(phalanxSpr\.visible\)\{/.test(body), 'фаланги вставляются в цепочку, только если видимы');
    const pIdx = body.indexOf('win.addChildAt(phalanxSpr,');
    const wIdx = body.indexOf('win.addChildAt(handItemSpr, Math.min(topIdx');
    assert(pIdx !== -1 && wIdx !== -1 && pIdx < wIdx, 'фаланги вставляются раньше предмета в руке');

    const torsoM = profileSrc.match(/if\(torsoDef && \[102, 107, 112, 118, 119\]\.includes\(torsoDef\.id\) && torsoSpr\)\{[\s\S]*?\n        \}/);
    const torsoBody = torsoM ? torsoM[0] : '';
    assert(!!torsoM, 'torso-exception блок найден в player_profile.js');
    const pR = torsoBody.indexOf('win.addChild(phalanxSpr);');
    const wR = torsoBody.indexOf('if(handItemSpr) win.addChild(handItemSpr);');
    const hR = torsoBody.indexOf('win.addChild(handSpr);');
    assert(pR !== -1 && wR !== -1 && hR !== -1 && pR < wR && wR < hR,
        'после куртки повторно поднимаются фаланги → оружие → кисть');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
