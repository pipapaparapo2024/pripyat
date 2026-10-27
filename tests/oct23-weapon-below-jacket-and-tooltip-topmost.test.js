/**
 * Test: 23.10.2026, по прямому указанию, два скрина (1 — пистолет/кружка/сайга новых сетов
 * должны быть МЕНЬШЕ по Z-индексу, чем куртка + часы на руке тоже под курткой; 2 — тултип
 * описания шмотки в магазине должен быть ВЫШЕ вообще всего).
 *
 * Корень: 23.10.2026 раньше в ЭТОЙ ЖЕ сессии torso-jacket-исключение (куртка поднимается
 * выше рук) было починено так, что переподнимало ЛЮБОЙ предмет на руке (оружие+кисть+фаланги)
 * ВЫШЕ куртки, без разбора — это было верно для обычного зажатого оружия (бита/нож), но
 * ОШИБОЧНО для handBuiltIn-предметов (Сайга/Пистолет/Кружка — своя кисть внутри файла, лежат
 * визуально НА бедре/за поясом) и для часов/цепи (id62/92, надеты на запястье) — эти три
 * категории должны оставаться ПОД курткой, не переподниматься.
 *
 * Run: node tests/oct23-weapon-below-jacket-and-tooltip-topmost.test.js
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

console.log('\nTest 1: shmot_shop.js — torso-exception переподнимает cat:6 ТОЛЬКО для обычного зажатого оружия (не handBuiltIn, не часы/цепь)');
{
    const m = shopSrc.match(/const _torsoEq = \(this\.items \|\| \[\]\)\.find\(it => it\.cat === 1 && it\.equipped\);[\s\S]*?\n        \}\n    \};/);
    assert(!!m, 'torso-exception блок найден');
    const body = m ? m[0] : '';
    assert(/const _handWeaponHeld2 = _handEq && _handEq\.id !== 62 && _handEq\.id !== 92 && \(!_handEq\.handBuiltIn \|\| _handEq\.id === 117\);/.test(body),
        '_handWeaponHeld2 исключает id62/92 (часы/цепь) И handBuiltIn-предметы (кроме id117, см. 26.10.2026)');
    assert(/if\(_handWeaponHeld2\)\{/.test(body),
        'переподъём фаланг/оружия/кисти обёрнут в if(_handWeaponHeld2) целиком — не выполняется для handBuiltIn/часов/цепи');
}

console.log('\nTest 2: home.js/hata.js/player_profile.js — та же логика (handBuiltIn и id62/92 исключены из переподъёма над курткой)');
{
    [
        { name: 'home.js', src: homeSrc, re: /const _handWeaponHeld2 = _handEq && _handEq\.id !== 62 && _handEq\.id !== 92 && \(!_handEq\.handBuiltIn \|\| _handEq\.id === 117\);[\s\S]{0,300}if\(_handWeaponHeld2\)\{/ },
        { name: 'hata.js', src: hataSrc, re: /const _handWeaponHeld2 = _handEq && _handEq\.id !== 62 && _handEq\.id !== 92 && \(!_handEq\.handBuiltIn \|\| _handEq\.id === 117\);[\s\S]{0,300}if\(_handWeaponHeld2\)\{/ },
        { name: 'player_profile.js', src: profileSrc, re: /const _handWeaponHeld2 = _handWeaponHeld && \(!\(handItemDef && handItemDef\.handBuiltIn\) \|\| \(handItemDef && handItemDef\.id === 117\)\);[\s\S]{0,200}if\(_handWeaponHeld2\)\{/ },
    ].forEach(({name, src, re}) => {
        // 26.10.2026: id117 (Бита, Исполнитель) исключена из handBuiltIn-блокировки — держится
        // поднятой в кулаке, в отличие от Сайги/Пистолета/Кружки (лежат у бедра/за поясом).
        assert(re.test(src), `${name}: переподъём над курткой условен на _handWeaponHeld2 (исключает handBuiltIn, кроме id117 — и часы/цепь)`);
    });
}

console.log('\nTest 3: shmot_shop.js — тултип описания всегда переподнимается на самый верх при показе (иначе оружие на манекене рисуется поверх него)');
{
    assert(/this\._shopWin\.addChild\(card\);\s*\n\s*while\(card\.children\.length\) card\.removeChildAt\(0\);/.test(shopSrc),
        '_showShopTip() делает this._shopWin.addChild(card) ПЕРЕД очисткой/перерисовкой содержимого (card попадает в конец display list = топ)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
