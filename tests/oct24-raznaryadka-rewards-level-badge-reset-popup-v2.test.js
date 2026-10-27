/**
 * Test: 24.10.2026 (по прямому указанию, второй батч правок за день):
 * 1) Разнарядка — награда "пистолет"/"автомат" выдаёт реальный инвентарь оружия (weapon_type в
 *    raznaryadka_config.json + RaznaryadkaProgress::_grantWeaponReward()), не абстрактные
 *    gun_count/auto_count (похоже, несуществующие колонки БД — объясняет баг "нельзя собрать
 *    награду"). "Патроны" — валюта ящика (bullets), не ammo_auto (валюта боя с боссом).
 * 2) Баг "сброс аккаунта → сразу уровень 120": 19.10.2026 'exp' и ещё 14 полей убраны из
 *    client-writable $allowed (см. exp-respect-whitelist-console-exploit-fix.test.js), но
 *    dev_panel.js._resetAccount() продолжал слать их обычным users.save(), который теперь их
 *    молча игнорирует — реальный (несброшенный) exp потом подтягивался в udata первым же
 *    server-authoritative patch (например raznaryadka.getState()) и триггерил попап нового
 *    уровня с РЕАЛЬНЫМ (старым) уровнем игрока. Исправлено дельта-путём через
 *    users.devGrantCurrency(), тем же приёмом, что уже есть у _giveMillion().
 * 3) Бейдж уровня игрока в верхнем HUD — level_txt теперь центрируется (anchor.x=0.5) в
 *    хитбоксе x:367,y:32,w:80,h:34 (был статичный x:396 без anchor — один/два/три знака числа
 *    сдвигали видимый центр).
 * 4) Попап подтверждения выкупа дня v2 — заголовок/подзаголовок сдвинуты на +40px вправо,
 *    заголовок жирнее (fontWeight) + обводка, текст кнопок тем же цветом, что заголовок,
 *    "СКОРО" (шапка даты до launch_month) жирнее.
 *
 * Run: node tests/oct24-raznaryadka-rewards-level-badge-reset-popup-v2.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = (p) => fs.readFileSync(p, 'utf-8');

console.log('\nTest 1: raznaryadka_config.json — пистолет/автомат используют weapon_type, не gun_count/auto_count');
{
    const config = JSON.parse(norm(path.join(root, 'server/json/raznaryadka_config.json')));
    const tiers = config.reward_tiers;
    const pistol = tiers.find(t => t.label_icon === 'pistol');
    const ak = tiers.find(t => t.label_icon === 'ak');
    const ammo = tiers.find(t => t.label_icon === 'ammo');
    const chest = tiers.find(t => t.label_icon === 'chest');
    assert(pistol && pistol.weapon_type === 'gun' && pistol.amt === 20, 'пистолет: weapon_type=gun, amt=20, получено ' + JSON.stringify(pistol));
    assert(ak && ak.weapon_type === 'auto' && ak.amt === 10, 'автомат: weapon_type=auto, amt=10, получено ' + JSON.stringify(ak));
    assert(ammo && ammo.field === 'bullets' && ammo.amt === 2, 'патроны: field=bullets (валюта ящика), amt=2, получено ' + JSON.stringify(ammo));
    assert(chest && chest.bonus_weapon_type === 'auto' && chest.bonus_amt === 10, 'сундук: bonus_weapon_type=auto, bonus_amt=10, получено ' + JSON.stringify(chest));
    assert(!tiers.some(t => t.field === 'gun_count' || t.field === 'auto_count' || t.bonus_field === 'auto_count' || t.bonus_field === 'gun_count'),
        'ни один tier больше не ссылается на gun_count/auto_count (вероятно несуществующие колонки БД)');
    assert(!tiers.some(t => t.field === 'ammo_auto'), 'патроны больше НЕ пишут в ammo_auto (это валюта боя с боссом, не ящика)');
}

console.log('\nTest 2: raznaryadkaprogress.php — _grantWeaponReward()/grantTier() подключены корректно');
{
    const src = norm(path.join(root, 'server/core/models/raznaryadkaprogress.php'));
    assert(/static function _grantWeaponReward\(\$ops, &\$user, \$type, \$amount\)/.test(src), '_grantWeaponReward($ops, &$user, $type, $amount) определена');
    assert(/\$wid = \['machete' => 3, 'gun' => 4, 'auto' => 5\]\[\$type\] \?\? null;/.test(src), 'маппинг machete=3/gun=4/auto=5 — тот же, что в dice.php/poker.php/weapons.php');
    assert(/\$ammoKey = 'ammo_' \. \$type;/.test(src), 'зеркалит в legacy ammo_<type> колонку');
    assert(/if\(!empty\(\$tier\['weapon_type'\]\)\)\s*self::_grantWeaponReward\(\$ops, \$user, \$tier\['weapon_type'\], intval\(\$tier\['amt'\]\)\);/.test(src),
        'grantTier() вызывает _grantWeaponReward() для tier.weapon_type');
    assert(/if\(!empty\(\$tier\['bonus_weapon_type'\]\)\)\s*self::_grantWeaponReward\(\$ops, \$user, \$tier\['bonus_weapon_type'\], intval\(\$tier\['bonus_amt'\]\)\);/.test(src),
        'grantTier() вызывает _grantWeaponReward() для tier.bonus_weapon_type (сундук)');
}

console.log('\nTest 3: users.php devGrantCurrency() — расширен на все 15 полей, выпавших из whitelist 19.10.2026');
{
    const src = norm(path.join(root, 'server/core/controllers/users.php'));
    const start = src.indexOf('function devGrantCurrency()');
    const block = src.slice(start, src.indexOf('function devSetRyukzakLevel', start));
    const extra = ['total_damage', 'bosses_killed', 'coins_earned', 'zone_fights',
        'zone_fights_0', 'zone_fights_1', 'zone_fights_2', 'zone_fights_3', 'zone_fights_4',
        'energy_spent', 'train_count', 'vassilich_buys', 'hata_progress', 'dvor_games',
        'loc_respect_0', 'loc_respect_1', 'loc_respect_2', 'loc_respect_3', 'loc_respect_4'];
    extra.forEach(key => {
        assert(new RegExp("'" + key + "'").test(block), `devGrantCurrency() $allowedTypes включает '${key}'`);
    });
    assert(/'exp'.*'respect'.*'stash_count'/.test(block.replace(/\n/g, ' ')) || /'exp'/.test(block), 'exp всё ещё в allowedTypes (не регрессия)');
}

console.log('\nTest 4: dev_panel.js._resetAccount() — дельта-сброс через devGrantCurrency для полей вне whitelist');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'));
    const start = src.indexOf('proto._resetAccount = function(){');
    // 11000 — с запасом покрывает и расчёт resetDeltas (сразу в начале функции, ДО переопределения
    // window.udata), и сам TS.php('users.devGrantCurrency', ...) вызов (физически вынесен ниже,
    // рядом с остальными server-only сбросами resetSession/devGrantShmot — см. комментарий в коде).
    const block = src.slice(start, start + 11000);
    assert(/const RESET_DELTA_TARGETS = \{/.test(block), 'RESET_DELTA_TARGETS словарь определён');
    assert(/exp: 0/.test(block), 'exp: целевое значение 0');
    assert(/hata_progress: -1/.test(block), 'hata_progress: целевое значение -1 (не 0 — "хата не куплена")');
    assert(/const delta = RESET_DELTA_TARGETS\[key\] - parseInt\(udata\[key\] \|\| 0\);/.test(block), 'дельта считается от ТЕКУЩЕГО (до сброса) значения udata');
    assert(/TS\.php\('users\.devGrantCurrency', resetDeltas,/.test(block), 'вызывает users.devGrantCurrency с посчитанными дельтами');
    // Дельта-блок должен идти ДО window.udata = wrapPlayerData(...) — иначе udata[key] уже
    // читал бы НОВЫЕ (сброшенные) значения, и дельта всегда была бы 0.
    const deltaIdx = block.indexOf('RESET_DELTA_TARGETS');
    const wrapIdx = block.indexOf('window.udata = window.wrapPlayerData(');
    assert(deltaIdx > -1 && wrapIdx > -1 && deltaIdx < wrapIdx, 'захват дельт идёт ДО перезаписи window.udata оптимистичным сбросом (иначе дельта всегда 0)');
}

console.log('\nTest 5: interface.js — level_txt центрируется в хитбоксе x:367,y:32,w:80,h:34');
{
    const src = norm(path.join(root, '_client/src/game/interface.js'));
    assert(/this\.level_txt\.anchor\.x = 0\.5;/.test(src), 'level_txt.anchor.x = 0.5 (центрирование, тот же приём, что nick_txt)');
    assert(/this\.level_txt\.x = 367 \+ 80 \/ 2;/.test(src), 'level_txt.x = 367 + 80/2 (центр хитбокса)');
    assert(!/this\.level_txt\.x = 396;/.test(src), 'старая статичная позиция x=396 без anchor убрана');
}

console.log('\nTest 6: raznaryadka.js — попап подтверждения v2 (позиции/цвет/жирность/обводка)');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));
    assert(/titleTxt\.x = 660; titleTxt\.y = 270;/.test(src), 'заголовок сдвинут вправо на 40px (620→660)');
    assert(/msgTxt\.x = 660; msgTxt\.y = 312;/.test(src), 'подзаголовок сдвинут вправо на 40px (620→660)');
    assert(/fontFamily: FONT, fontSize: 36, fill: '#a59472', fontWeight: 'bold',\s*stroke: '#000000', strokeThickness: 1,/.test(src),
        'заголовок — жирность (fontWeight) + обводка (stroke)');
    // 24.10.2026 (переделано тем же днём на mkUniversalBtn() — confirmTxt/cancelTxt больше не
    // отдельные именованные переменные, оба текста кнопок строятся общим кодом внутри
    // mkUniversalBtn с тем же цветом a59472, что у заголовка).
    assert(/const txt = new PIXI\.Text\(label, \{ fontFamily: FONT, fontSize: 27, fill: '#a59472', dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 \}\);/.test(src),
        'текст кнопки (ПОДТВЕРДИТЬ/ОТМЕНА) — цвет a59472 (как у заголовка, было d2d2d2)');
    assert(/this\._dateTxt\.style\.fontWeight = 'bold';/.test(src), '"СКОРО" получает fontWeight=bold');
    assert(/this\._dateTxt\.style\.fontWeight = 'normal';/.test(src), 'обычный "ДЕЛО НА..." возвращает fontWeight=normal (не остаётся жирным после launch_month)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
