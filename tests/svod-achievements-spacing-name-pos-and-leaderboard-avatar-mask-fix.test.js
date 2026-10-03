/**
 * Test: батч 22.09.2026 (по прямому указанию, скриншоты редактора позиций) —
 *
 * 1) «Мои достижения»: зазор между карточками уменьшен на 4px (CARD_GAP 10→6), отступ первой
 *    карточки сверху увеличен на 4px (CARD_TOP_OFFSET 10→14).
 * 2) Название карточки (nameTxt) — новая позиция (102,14), снятая через редактор позиций на
 *    ЖИВОЙ (тогда ещё не обрезанной) текстуре x:102 y:57 — конвертирована в систему отсчёта
 *    после обрезки файла (57-43=14, см. svod-achievements-tab-position-and-transparent-padding-crop.test.js).
 * 3) Иконка в визитке игрока (player_profile.js) — новая позиция/размер (51,113,69×69), было
 *    (38,98,86×86).
 * 4) Аватарки в топах Сводки (Общий топ/урон/авторитет/достижения) не выводились ВООБЩЕ — причина:
 *    avatarMask (19.09.2026 фикс) был полностью убран из display-list (не только НЕ добавлен
 *    в row, а вообще нигде), из-за чего PIXI никогда не обновлял его worldTransform (объект без
 *    родителя не проходит по дереву сцены) — маска оставалась в (0,0) вместо (AVATAR_X,4) и
 *    вырезала аватарку целиком. Фикс — тот же рабочий паттерн, что уже есть в
 *    player_profile.js._buildVisitCard: маска ДОБАВЛЯЕТСЯ в сцену (row.addChild(avatarMask)).
 *
 * Run: node tests/svod-achievements-spacing-name-pos-and-leaderboard-avatar-mask-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const achSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');
const profileSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');
const leaderSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');

console.log('\nTest 1: CARD_GAP уменьшен на 4px (10→6), CARD_TOP_OFFSET увеличен (10→14→34), затем 23.09.2026 убран обратно (→0)');
{
    assert(/const CARD_W = 672, CARD_GAP = 6;/.test(achSrc), 'CARD_GAP=6 (было 10)');
    // 22.09.2026: CARD_TOP_OFFSET получил ВТОРУЮ правку в тот же день (+20 сверху) — см.
    // svod-icon-position-rounding-and-subtab-sync-fix.test.js.
    // 23.09.2026 (по прямому указанию — "убери лишний отступ, сделай как в топе по урону"):
    // отступ убран обратно до 0 — см. achievement-card-top-offset.test.js.
    assert(/const CARD_TOP_OFFSET = 0;/.test(achSrc), 'CARD_TOP_OFFSET=0 (было 34, убран 23.09.2026)');
}

console.log('\nTest 2: название карточки (nameTxt) — позиция (95,11), уточнена редактором позиций 22.09.2026 (было 102,14)');
{
    assert(/const NAME_X = 95;/.test(achSrc), 'NAME_X=95 (было 102)');
    assert(/const NAME_Y = 11;/.test(achSrc), 'NAME_Y=11 (было 14)');
    assert(/nameTxt\.x = NAME_X; nameTxt\.y = NAME_Y;/.test(achSrc), 'nameTxt использует именованные NAME_X/NAME_Y (не голое число 120)');
}

console.log('\nTest 3: иконка визитки игрока — новая позиция/размер (51,113,69×69)');
{
    assert(/const AVATAR_X = 51, AVATAR_Y = 113, AVATAR_SIZE = 69;/.test(profileSrc),
        'AVATAR_X/Y/SIZE обновлены (было 38,98,86)');
}

console.log('\nTest 4: svod-leaderboard.js — avatarMask добавлен в сцену (тот же паттерн, что в player_profile.js)');
{
    // 22.09.2026: AVATAR_X = 60+36 стало AVATAR_X = 99 (см. svod-icon-position-rounding-
    // and-subtab-sync-fix.test.js) — ищем по более стабильному якорю (avatarMask).
    const start = leaderSrc.indexOf('const avatarMask = new PIXI.Graphics();');
    const end   = leaderSrc.indexOf('const nameTxt', start);
    const body  = leaderSrc.slice(start, end);
    assert(/row\.addChild\(avatar\);/.test(body), 'avatar (спрайт с фото) добавлен в row');
    assert(/row\.addChild\(avatarMask\);/.test(body), 'avatarMask ТЕПЕРЬ ТОЖЕ добавлен в row (баг — маска без родителя не обновляла transform, вырезая аватар целиком)');

    const profStart = profileSrc.indexOf('const avatarMask = new PIXI.Graphics();');
    const profEnd   = profileSrc.indexOf('if(window.bosses', profStart);
    const profBody  = profileSrc.slice(profStart, profEnd);
    assert(/card\.addChild\(avatarSpr\);/.test(profBody) && /card\.addChild\(avatarMask\);/.test(profBody),
        'player_profile.js (эталонный рабочий паттерн) тоже добавляет и спрайт, и маску в сцену — свод теперь делает так же');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
