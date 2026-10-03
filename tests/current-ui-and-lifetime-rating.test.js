/** Регрессии текущего пакета: Зарики, награды локации, рейтинг и пустое оружие. */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg){
    if(cond){ console.log('  ✅', msg); passed++; }
    else { console.error('  ❌ FAIL:', msg); failed++; }
}
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dice = read('_client/src/game/dvor/dvor-dice.js');
const zone = read('_client/src/game/zone.js');
const combat = read('_client/src/game/bosses/bosses-combat.js');
const fight = read('_client/src/game/shell/overlays/bosses_fight.js');
const php = read('server/core/controllers/bosses.php');

// 16.09.2026 (позже этого батча, по прямому указанию): подпись над кнопкой БРОСИТЬ вернули
// живой — "БЕСПЛАТНЫЙ БРОСОК" или обратный отсчёт до него (см.
// tests/dice-level-scale-asset-and-roulette-wheel-verify.test.js) — раньше пустая заглушка
// text='' была именно временным решением, чтобы просто убрать статичную неверную фразу.
console.log('\nTest 1: лишняя подпись Зариков удалена');
assert(!dice.includes('1 ИГРА = 1 КРАСНЫЙ ПОИНТ'), 'фраза отсутствует в интерфейсе');
assert(dice.includes("this._diceTimerTxt.text = 'БЕСПЛАТНЫЙ БРОСОК'") || dice.includes('БЕСПЛАТНЫЙ БРОСОК ЧЕРЕЗ'),
    'поле подписи теперь живое (бесплатный бросок/обратный отсчёт), не пустая заглушка');

console.log('\nTest 2: три награды используют общий белый стиль и шаг с gap 14px');
const reward = zone.slice(zone.indexOf('_showCpReward(xp, cig, resp){'), zone.indexOf('_showStashPickup(){'));
assert(reward.includes('const REWARD_FONT_SIZE = 24'), 'единый размер 24px');
assert(reward.includes('const REWARD_ROW_GAP = 14'), 'зазор 14px');
assert(reward.includes("fill:'#ffffff'"), 'белый цвет');
assert((reward.match(/new PIXI\.Text\([^\n]+REWARD_STYLE\)/g) || []).length === 3,
    'XP, сигареты и уважение используют общий стиль');

console.log('\nTest 3: рейтинг пожизненно суммирует полный урон, помощь друзей остаётся цикловой');
// 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер"): расчёт и накопление
// урона (включая пожизненный bossDamage) переехали из bosses-combat.js в bosses.php.attack() —
// см. boss-attack-server-authoritative-and-timing-friend-rule.test.js за полным покрытием.
assert(php.includes("$data['bossDamage'][$bossId] = intval($data['bossDamage'][$bossId]) + $damage;"),
    'пожизненный bossDamage увеличивается на полный удар (теперь на сервере)');
assert(!php.slice(php.indexOf('function attack(){')).includes('Math.max'), 'ограничение максимумом цикла отсутствует в attack()');
assert(php.includes('function _myFightStart($data, $diffIdx, $bossId){'), 'граница "текущего цикла" для помощи друзей — bossStartMs МОЕГО боя, читается напрямую');

console.log('\nTest 4: пустое магазинное оружие всегда открывает попап покупки');
const attack = fight.slice(fight.indexOf('proto._attackWithWeapon = function(weapIdx)'), fight.indexOf('proto._openNoWeaponPopup = function()'));
assert(attack.includes("weapIdx > 2 && (!wp.owned || (parseInt(wp.qty)||0) <= 0)"),
    'проверяются мачете, ствол и автомат с нулевым количеством');
assert(attack.includes('this._openNoWeaponPopup()'), 'открывается единый попап покупки');

console.log(`\n${'─'.repeat(50)}`);
if(failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
