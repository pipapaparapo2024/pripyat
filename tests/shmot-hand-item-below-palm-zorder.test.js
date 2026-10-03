/**
 * Test: z-order предметов категории cat:6 ("Рука") относительно кистей рук персонажа.
 *
 * История: 25.09.2026 (по прямому указанию, дважды тем же днём) правило было "предмет в
 * руке ВСЕГДА выше кистей (rightHandSpr/leftHandSpr) — стоит ПОСЛЕДНИМ по z-index". Позже
 * (тот же день, по скриншоту — "все шмотки теперь кладутся поверх файла правая рука, должно
 * быть не так") выяснилось: это верно ТОЛЬКО для 2 конкретных предметов, которые НАДЕТЫ НА
 * руку — id:62 "Часы (Покер)" и id:92 "Цепь (Тинейджер)". Все остальные cat:6 предметы —
 * оружие/инструмент, ЗАЖАТЫЙ в руке — должны быть ПОД пальцами, иначе кисть визуально
 * "съедает" зажатый предмет.
 *
 * Исправлено в 4 местах, отображающих персонажа с надетыми шмотками: home.js (главный экран),
 * shell/overlays/shmot_shop.js (манекен магазина), shell/overlays/hata.js (превью хаты),
 * shell/overlays/player_profile.js (профиль игрока, свой и чужой).
 *
 * Run: node tests/shmot-hand-item-below-palm-zorder.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const homeSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'home.js'), 'utf-8');
const shopSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const hataSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8');
const profileSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');

console.log('\nTest 1: устаревшее специальное правило для часов/цепи удалено');
{
    [['shmot_shop.js', shopSrc], ['hata.js', hataSrc], ['player_profile.js', profileSrc]]
        .forEach(([name, src]) => {
            assert(!/HAND_ITEMS_ABOVE_PALM/.test(src), name + ': нет отдельного правила для часов/цепи');
        });
    assert(!/HAND_ITEMS_ABOVE_PALM/.test(homeSrc), 'home.js: нет отдельного правила для часов/цепи');
}

console.log('\nTest 2: home.js — порядок слоёв: левая кисть → предмет → правая кисть');
{
    assert(!/if\(this\._clothSlots && this\._clothSlots\[6\]\) root\.layer0_mc\.addChild\(this\._clothSlots\[6\]\);/.test(homeSrc),
        'безусловный перенос cat:6 выше кистей в open() убран (перенесён внутрь updateClothes())');
    const m = homeSrc.match(/updateClothes\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'updateClothes() найден');
    if(m){
        const body = m[1];
        assert(/getChildIndex\(this\._leftHandSpr\)/.test(body),
            'якорь z-индекса — левая кисть; предмет вставляется сразу после неё, перед правой');
    }
}

console.log('\nTest 3: shmot_shop.js — this._shopWin проставляется РАНЬШЕ первого _updateManSprites(), иначе guard по .parent молчаливо не сработает');
{
    const winIdx = shopSrc.indexOf('this._shopWin = win;');
    const firstCallIdx = shopSrc.indexOf('this._updateManSprites();');
    assert(winIdx !== -1 && firstCallIdx !== -1 && winIdx < firstCallIdx,
        'this._shopWin = win стоит раньше первого вызова _updateManSprites()');
    // Дубликата присваивания в конце функции быть не должно (иначе не баг, но лишний код).
    const winAssignCount = (shopSrc.match(/this\._shopWin = win;/g) || []).length;
    assert(winAssignCount === 1, 'this._shopWin = win присваивается ровно один раз, ' + winAssignCount);
    assert(/this\._manLeftHandSpr = leftHandSpr;/.test(shopSrc), 'левая кисть сохранена в this для определения z-порядка');
    const m = shopSrc.match(/proto\._updateManSprites = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_updateManSprites найден');
    if(m) assert(/getChildIndex\(this\._manLeftHandSpr\)/.test(m[1]), '_updateManSprites() ставит предмет сразу после левой кисти');
}

console.log('\nTest 4: hata.js — превью хаты использует тот же порядок слоёв');
{
    assert(/this\._charLeftHandSpr = leftHandSpr;/.test(hataSrc), 'левая кисть сохранена в this');
    assert(!/if\(this\._charSlots && this\._charSlots\[6\]\) win\.addChild\(this\._charSlots\[6\]\);/.test(hataSrc),
        'безусловный перенос cat:6 выше кистей убран');
    const m = hataSrc.match(/_updateCharClothes\(\)\{([\s\S]*?)\n    \}/);
    assert(!!m, '_updateCharClothes найден');
    if(m) assert(/getChildIndex\(this\._charLeftHandSpr\)/.test(m[1]), '_updateCharClothes() ставит предмет сразу после левой кисти');
}

console.log('\nTest 5: player_profile.js — карточка игрока использует тот же порядок слоёв (обновлено 28.09.2026)');
{
    // 28.09.2026: тот же редизайн z-order, что и в home.js (см. Test 4 выше) — обычный предмет
    // теперь между левой и правой кистью, часы/цепь по-прежнему поверх правой кисти.
    // HAND_ITEMS_ABOVE_PALM больше не нужен — заменён на прямую проверку id===62||id===92.
    assert(/if\(s\.cat === 6 && def\)\{ handItemSpr = spr; handItemDef = def; \}/.test(profileSrc),
        'предмет cat:6 выбран для перестановки (вместе с def — нужен для проверки id часов/цепи ниже)');
    assert(/getChildIndex\(leftHandSpr\)/.test(profileSrc),
        'предмет вставляется сразу после левой кисти');
    assert(/if\(handItemDef && \(handItemDef\.id === 62 \|\| handItemDef\.id === 92\)\) win\.addChild\(handItemSpr\);/.test(profileSrc),
        'часы (id:62)/цепь (id:92) по-прежнему переносятся поверх правой кисти');
    assert(/else win\.addChildAt\(rightHandSpr, win\.getChildIndex\(handItemSpr\) \+ 1\);/.test(profileSrc),
        'обычный предмет — правая кисть переносится СРАЗУ ПОСЛЕ него (предмет виден между кистями)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
