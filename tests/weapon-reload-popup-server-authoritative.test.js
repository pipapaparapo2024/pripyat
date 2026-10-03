/**
 * Test: 26.09.2026 — попап «Перезарядка» бесплатного оружия (нож/цепь/бита) + серверный сброс
 * КД за 20 рублей (по прямому указанию, новые ассеты добавлены пользователем локально).
 *
 * Раньше клик по бесплатному оружию на кулдауне показывал только текстовый notify.showResult
 * ("Бесплатный удар КД: Хч Yмин. Откат за 20р."), а СБРОС кулдауна (bosses-combat.js.
 * resetFreeWeaponCd) тратил рубли ПРЯМО НА КЛИЕНТЕ (udata['coins'] -= 20) без единого запроса
 * на сервер — читер мог вызвать bosses.resetFreeWeaponCd() из консоли и сбросить КД бесплатно,
 * либо заранее подменить udata['coins']. Теперь:
 *   1) клик по оружию на кулдауне открывает полноценный попап с картинками (weapon_reload_popup.js);
 *   2) кнопка «Ускорить за 20» идёт через сервер (bosses.rushFreeWeapon) — тот сам проверяет
 *      кулдаун и баланс, списывает рубли и обнуляет freeWpnCdMs[weaponId].
 *
 * Run: node tests/weapon-reload-popup-server-authoritative.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
const bossesSrc = readSrc('_client/src/game/bosses.js');
const popupSrc  = readSrc('_client/src/game/shell/overlays/weapon_reload_popup.js');
const fightSrc  = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const bossesPhp = readSrc('server/core/controllers/bosses.php');

console.log('\nTest 1: bosses.js подключает и регистрирует попап перезарядки');
{
    assert(/import \{ attachWeaponReloadPopup \} from '\.\/shell\/overlays\/weapon_reload_popup\.js';/.test(bossesSrc),
        'import attachWeaponReloadPopup найден');
    assert(/attachWeaponReloadPopup\(Bosses\.prototype\);/.test(bossesSrc), 'attachWeaponReloadPopup(Bosses.prototype) вызван');
}

console.log('\nTest 2: _attack() открывает попап вместо текстового notify при кулдауне бесплатного оружия');
{
    const start = combatSrc.indexOf('proto._attack = function(){');
    const end   = combatSrc.indexOf('const mult = isFree', start);
    const body  = combatSrc.slice(start, end);
    assert(/this\._openWeaponReloadPopup\(eqWpn\.id\);/.test(body), '_attack() зовёт _openWeaponReloadPopup(eqWpn.id) при активном КД');
    assert(!/notify\.showResult\(\{text:'Бесплатный удар КД/.test(body), 'старый текстовый notify с КД убран');
}

console.log('\nTest 3: resetFreeWeaponCd() больше не списывает рубли на клиенте — делегирует в серверный _rushFreeWeaponCd()');
{
    const rStart = combatSrc.indexOf('proto.resetFreeWeaponCd = function');
    const rEnd   = combatSrc.indexOf('\n    };', rStart);
    const body   = combatSrc.slice(rStart, rEnd);
    assert(!/udata\['coins'\]\s*=/.test(body), 'resetFreeWeaponCd() больше НЕ мутирует udata[\'coins\'] напрямую (старая дыра для читера)');
    assert(/this\._rushFreeWeaponCd\(eqWpn\.id\);/.test(body), 'resetFreeWeaponCd() делегирует в _rushFreeWeaponCd(eqWpn.id)');
}

console.log('\nTest 4: _rushFreeWeaponCd() — реальный round-trip на сервер, applyPatch, достижения');
{
    const pStart = combatSrc.indexOf('proto._rushFreeWeaponCd = function');
    const pEnd   = combatSrc.indexOf("}, (err) => {", pStart);
    assert(pStart !== -1 && pEnd !== -1, '_rushFreeWeaponCd() определён');
    const body = combatSrc.slice(pStart, pEnd);
    assert(/TS\.php\('bosses\.rushFreeWeapon', \{ weapon_id: weaponId \}/.test(body), 'зовёт TS.php(\'bosses.rushFreeWeapon\', {weapon_id})');
    assert(/applyPatch\(res\.patch\);/.test(body), 'применяет patch от сервера через applyPatch()');
    assert(/this\._loadFromUdata\(\);/.test(body), 'перечитывает freeWpnCdMs из свежего bosses_data после patch');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(body), 'проверяет достижения после успешной траты рублей');
}

console.log('\nTest 5: weapon_reload_popup.js — попап ссылается на реальные файлы ассетов и стоимость 20');
{
    assert(/export function attachWeaponReloadPopup\(proto\)\{/.test(popupSrc), 'attachWeaponReloadPopup экспортирован');
    assert(/const RUSH_COST = 20;/.test(popupSrc), 'стоимость ускорения — 20');
    assert(/попап обновления бесплатного оружия\.png/.test(popupSrc), 'фон попапа подключён');
    assert(/попап перезарядки нож\.png/.test(popupSrc), 'иконка ножа подключена');
    assert(/попап перезарядки цепь\.png/.test(popupSrc), 'иконка цепи подключена');
    assert(/попап перезарядки бита\.png/.test(popupSrc), 'иконка биты подключена');
    assert(/попап перезарядки кнопка ускорить\.png/.test(popupSrc), 'кнопка «Ускорить» подключена');
    assert(/монеты эмблема\.png/.test(popupSrc), 'иконка монет подключена (уже существующий в проекте файл)');
    assert(/this\._rushFreeWeaponCd\(this\._weaponReloadWeaponId/.test(popupSrc), 'кнопка «Ускорить» зовёт _rushFreeWeaponCd() с id текущего оружия');
}

console.log('\nTest 6: файлы ассетов реально скопированы в development/images');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    assert(fs.existsSync(path.join(imgDir, 'попап обновления бесплатного оружия.png')), 'фон попапа скопирован');
    assert(fs.existsSync(path.join(imgDir, 'попап перезарядки нож.png')), 'иконка ножа скопирована');
    assert(fs.existsSync(path.join(imgDir, 'попап перезарядки цепь.png')), 'иконка цепи скопирована');
    assert(fs.existsSync(path.join(imgDir, 'попап перезарядки бита.png')), 'иконка биты скопирована');
    assert(fs.existsSync(path.join(imgDir, 'попап перезарядки кнопка ускорить.png')), 'кнопка «Ускорить» скопирована');
    assert(fs.existsSync(path.join(imgDir, 'монеты эмблема.png')), 'иконка монет уже существовала в проекте');
}

console.log('\nTest 7: _closeBossesFight() останавливает интервал попапа перезарядки при выходе из боя');
{
    const start = fightSrc.indexOf('proto._closeBossesFight = function(){');
    const end   = fightSrc.indexOf('\n    };', start);
    const body  = fightSrc.slice(start, end);
    assert(/bosses\._closeWeaponReloadPopup\(\);/.test(body), '_closeBossesFight() зовёт bosses._closeWeaponReloadPopup() (иначе setInterval попапа тикает вхолостую после выхода из боя)');
}

console.log('\nTest 8: сервер — bosses.rushFreeWeapon() зарегистрирован в permits и проверяет только бесплатное оружие (0-2)');
{
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): регекс требовал, чтобы
    // 'rushFreeWeapon' было ПОСЛЕДНИМ элементом массива (...'rushFreeWeapon'];) — тем же
    // батчем (26.09.2026) чуть позже добавлен и permit 'buyKey' (перенос bosses.js._buyKey()
    // на сервер, несвязанная правка), из-за чего 'rushFreeWeapon' больше не последний, а
    // .test не проверяли позицию внутри массива — достаточно, что элемент присутствует.
    assert(/\$this->permits = \[[^\]]*'rushFreeWeapon'[^\]]*\];/.test(bossesPhp), "'rushFreeWeapon' добавлен в \$this->permits (public, иначе universal.php молча отклонит вызов)");
    assert(/public \$permits;/.test(bossesPhp), '$permits объявлен public (см. incident_permits_must_be_public)');
    assert(/function rushFreeWeapon\(\)\{/.test(bossesPhp), 'метод rushFreeWeapon() существует');

    const start = bossesPhp.indexOf('function rushFreeWeapon(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->ops->ok', start));
    const body  = bossesPhp.slice(start, end);
    assert(/if\(\$weaponId < 0 \|\| \$weaponId > 2\) return \$this->ops->fail\(54\);/.test(body), 'отклоняет weaponId вне диапазона 0-2 (донатное оружие не участвует)');
    assert(/if\(\$lastUse <= 0 \|\| \(\$now - \$lastUse\) >= \$this->FREE_WPN_CD_MS\) return \$this->ops->fail\(53\);/.test(body), 'отклоняет попытку сброса, если оружие уже не на кулдауне');
    assert(/\$this->ops->deduct\(\$user, 'coins', \$cost\)/.test(body), 'списывает рубли через Gameops::deduct() (сервер проверяет баланс сам)');
    assert(/\$this->ops->add\(\$user, 'coins_spent', \$cost\);/.test(body), 'учитывает трату в coins_spent (для достижений, как и weapons.php.buy())');
    // 28.09.2026 (фикс собственного теста после введения ОБЩЕГО кулдауна бесплатного оружия —
    // см. tests/boss-daily-reset-msk-and-free-weapon-shared-cd.test.js Test 9): удар любым из
    // трёх (нож/цепь/бита) блокирует остальные два тоже, поэтому и сброс через rushFreeWeapon()
    // обнуляет ВСЕ три ключа foreach-ем, а не только $weaponId запрошенного оружия.
    assert(/foreach\(\$this->FREE_WPN_IDS as \$fw\) \$cdMap\[\$fw\] = 0;/.test(body), 'обнуляет freeWpnCdMs для ВСЕХ трёх бесплатных оружий разом (общий кулдаун)');
    assert(/\$this->ops->saveUser\(\$user\)/.test(body), 'сохраняет пользователя через Gameops::saveUser()');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
