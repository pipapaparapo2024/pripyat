/**
 * 11.10.2026, по прямому живому репорту (видео + текст): "механика стаканчиков в рулетке
 * выбила автомат/пистолет, а по факту не начислило" — распространил вопрос на зарики
 * (dice.php) по прямой просьбе ("посмотри на всякий случай другие награды").
 *
 * Корень: roulette.php (_rollSlot()/pickCup()) и dice.php (resolve()) отдавали auto/gun/
 * machete клиенту как clientReward, применяемый через weapons.grantAmmo() — чисто локальная
 * мутация udata['weapons']/udata['ammo_X'], которая ждёт следующего автосейва (queuePlayerSave/
 * players-save.js). Но users.save() ЦЕЛЕНАПРАВЛЕННО отклоняет РОСТ этих полей —
 * $monotonicFields (ammo_auto/ammo_gun/ammo_machete — легитимно могут только расходоваться в
 * бою) и $jsonBlobGuards['weapons'] (_sanitizeWeapons() разрешает только снижение qty/без роста
 * owned/upg) в users.php — это осознанная анти-чит защита от самостоятельной накрутки патронов
 * через консоль. Итог: награда мелькала popup'ом "+1 автомат", но НИ РАЗУ не доезжала до БД —
 * следующий же автосейв тихо откатывал её обратно (сервер отвечал честным "не куплено" на
 * bosses.attack, хотя клиент продолжал визуально показывать прибавку).
 *
 * poker.php.resolve() уже закрывал ровно этот баг раньше (см. его собственный комментарий —
 * "users.save запрещает клиенту увеличивать запас патронов, поэтому clientReward здесь
 * недостаточен") — _grantWeaponReward() пишет прямо в $user, уходит тем же Gameops::saveUser(),
 * в обход whitelist/гвардов users.save() целиком, и попадает в patch (applyPatch() на клиенте).
 * Этот фикс — 1-в-1 порт того же паттерна в roulette.php и dice.php.
 *
 * Реальное исполнение Roulette::_grantWeaponReward()/Dice::_grantWeaponReward() (идентичность
 * poker.php-реализации — слияние с существующим запасом, legacy-only ammo_* подхват,
 * неоружейные/нулевые/отрицательные суммы игнорируются) — см.
 * tests/_php_fixtures/roulette-dice-weapon-reward-core.php. Если локального PHP нет — этот блок
 * мягко пропускается (см. tests/_php_bin.js), остальные (текстовые) проверки ниже всё равно
 * выполняются.
 *
 * Run: node tests/roulette-dice-weapon-and-points-reward-persistence-fix.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('child_process');
const { findPhpBin } = require('./_php_bin.js');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

let failed = 0;
const check = (cond, msg) => {
    if(cond) console.log('  ✅', msg);
    else { console.error('  ❌ FAIL:', msg); failed++; }
};

// ── Часть 1: реальное исполнение PHP (_grantWeaponReward корректность) ─────────────────────
const phpBin = findPhpBin();
if(!phpBin){
    console.log('⚠️  PHP не найден локально — блок реального исполнения пропущен (см. tests/_php_bin.js).');
} else {
    const fixture = path.join(__dirname, '_php_fixtures', 'roulette-dice-weapon-reward-core.php');
    let stdout;
    try {
        stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
    } catch(e){
        console.error('❌ PHP-фикстура упала (фатальная ошибка):', e.stderr || e.message);
        process.exit(1);
    }
    stdout.trim().split('\n').forEach(line => {
        if(line.startsWith('PASS:')) console.log('  ✅', line.slice(6));
        else if(line.startsWith('FAIL:')){ console.error('  ❌ FAIL:', line.slice(6)); failed++; }
        else if(line.trim()) console.log('  ', line);
    });
}

// ── Часть 2: roulette.php — обвязка вокруг _grantWeaponReward() ────────────────────────────
const roulette = read('server/core/controllers/roulette.php');
check(/private function _grantWeaponReward\(&\$user, \$type, \$amount\)/.test(roulette),
    'roulette.php defines _grantWeaponReward()');

const rollSlotSrc = roulette.slice(roulette.indexOf('private function _rollSlot('), roulette.indexOf('private function _tryClaimKeyring('));
check(/case 'auto': case 'gun': case 'machete':\s*\n\s*\/\/[\s\S]*?\$this->_grantWeaponReward\(\$user, \$slot\['type'\], \$slot\['amt'\]\);/.test(rollSlotSrc),
    '_rollSlot() routes auto/gun/machete through _grantWeaponReward()');
// $clientRewards[] = $slot; is still legitimate in the default: branch (unknown future slot
// types) — what must NOT happen is auto/gun/machete falling through to it. Scope the negative
// check to exactly the weapon case block (up to its own `break;`), not the whole switch.
const weaponCaseSrc = rollSlotSrc.slice(rollSlotSrc.indexOf("case 'auto': case 'gun': case 'machete':"), rollSlotSrc.indexOf('default:'));
check(!/\$clientRewards\[\] = \$slot;/.test(weaponCaseSrc),
    '_rollSlot() auto/gun/machete case no longer pushes the raw weapon slot as a clientReward');

const pickCupSrc = roulette.slice(roulette.indexOf('function pickCup()'));
check(/\$this->_grantWeaponReward\(\$user, \$type, \$amt\);/.test(pickCupSrc),
    "pickCup()'s consolation branch routes auto/gun/machete through _grantWeaponReward()");
check(!/\$clientRewards\[\] = \['type'=>\$type, 'amt'=>\$amt\];\s*\/\/ auto\/gun\/machete/.test(roulette),
    'pickCup() no longer has the stale "auto/gun/machete — клиент выдаёт сам" clientReward fallback');

// Both spin() patch-assembly sites (the _rawLink()-failed fallback AND the main path) must
// conditionally add weapons/ammo_X when a weapon slot was actually granted — otherwise the
// client only learns about it on the next full udata reload.
const spinSrc = roulette.slice(roulette.indexOf('function spin(){'), roulette.indexOf('private function _rollSlot('));
check((spinSrc.match(/in_array\(\$slotType, \['auto','gun','machete'\], true\)\)\{ \$patchKeys\w+\[\] = 'weapons'; \$patchKeys\w+\[\] = 'ammo_' \. \$slotType; \}/g) || []).length === 2,
    "spin() appends 'weapons'/'ammo_X' to both patch key lists (rawLink-failed fallback + main path) when a weapon slot hit");

// ── Часть 3: dice.php — та же обвязка ───────────────────────────────────────────────────────
const dice = read('server/core/controllers/dice.php');
check(/private function _grantWeaponReward\(&\$user, \$type, \$amount\)/.test(dice),
    'dice.php defines _grantWeaponReward()');
const applyCurrencySrc = dice.slice(dice.indexOf('$applyCurrency = function'), dice.indexOf('$rewards = []'));
check(/case 'auto': case 'gun': case 'machete':[\s\S]*?\$this->_grantWeaponReward\(\$user, \$type, \$amt\);/.test(applyCurrencySrc),
    'resolve()\'s $applyCurrency routes auto/gun/machete through _grantWeaponReward()');
check(/default:\s*\n\s*\$clientRewards\[\] = \['type' => \$type, 'amt' => \$amt\];/.test(applyCurrencySrc),
    'the generic clientReward fallback is now reached ONLY by the default: branch (not auto/gun/machete)');
check(/if\(!empty\(\$weaponTypesGranted\)\)\{/.test(dice),
    'resolve() conditionally extends the patch with weapons/ammo_X via $weaponTypesGranted');

// ── Часть 4: клиент — ни один живой вызывающий roulette/dice код больше не применяет
// auto/gun/machete через weapons.grantAmmo() (мёртвая ветка, сервер больше не шлёт их в
// clientRewards для этих типов) — вместо этого перечитывает udata через _loadFromUdata() после
// applyPatch(), тем же приёмом, что уже доказанно работает у dvor-poker-game.js.
for(const [label, relPath] of [
    ['dvor-roulette.js',          '_client/src/game/dvor/dvor-roulette.js'],
    ['dvor-roulette-screen.js',   '_client/src/game/dvor/dvor-roulette-screen.js'],
    ['dvor-roulette-minigame.js', '_client/src/game/dvor/dvor-roulette-minigame.js'],
    ['dvor-dice-game.js',         '_client/src/game/dvor/dvor-dice-game.js'],
    ['dvor-dice.js',              '_client/src/game/dvor/dvor-dice.js'],
]){
    const src = read(relPath);
    // Match an actual invocation with arguments (the real dead call looked like
    // `weapons.grantAmmo(cr.type, cr.amt)`) — explanatory comments documenting the old bug are
    // allowed to mention the bare function name `weapons.grantAmmo()`.
    check(!/weapons\.grantAmmo\(cr\.type/.test(src), `${label}: no more live weapons.grantAmmo(cr.type, ...) calls (dead/unsafe path removed)`);
    check(/weapons\._loadFromUdata\(\)/.test(src), `${label}: reloads weapons.data from udata after a weapons patch`);
}

console.log(`\n${'─'.repeat(50)}`);
if(failed === 0) console.log('✅ All roulette/dice weapon-reward persistence checks passed');
else { console.log(`❌ ${failed} FAILED`); process.exit(1); }
