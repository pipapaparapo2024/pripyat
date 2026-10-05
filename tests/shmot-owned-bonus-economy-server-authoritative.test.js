/**
 * Test: 28.09.2026 (по прямому указанию) — новая экономика бонусов шмота.
 *
 * Было: бонус давали только НАДЕТЫЕ вещи (equipped). Стало: бонус даёт сам факт получения
 * вещи (owned) — надевать необязательно. Бонусы от ВСЕХ владеемых предметов с одним и тем же
 * bk складываются (не только один предмет на категорию).
 *
 * Затронуто 3 типа бонуса:
 * 1) auto_flat/gun_flat/machete_flat/damage — урон оружия (bosses.php.attack(), уже считал по
 *    всему каталогу суммой — менялось только условие фильтра, см. отдельный
 *    shmot-damage-bonus-in-boss-attack.test.js).
 * 2) max_e — макс. энергия. Раньше считал и писал КЛИЕНТ (shmot.js._applyMaxEnergyBonus(),
 *    перезаписывал udata['max_energy'] целиком при каждой смене экипировки — стирал серверные
 *    начисления Василича/Хапуги/скиллов). Теперь сервер начисляет ДЕЛЬТУ один раз в момент
 *    получения вещи (Gameops::applyShmotOwnBonus()), вызывается из ВСЕХ 7 мест выдачи шмота.
 *    'max_energy' убрано из client-writable $allowed/$strictNumericFields в users.php.
 * 3) armor — мёртвый код (ни один предмет каталога не имеет bk:'armor', бонус нигде не
 *    читался) — удалён целиком (клиент + банда-бонус в zone.php), не мигрирован.
 *
 * Заодно (тот же класс дыры, найден по ходу): "Адреналин" (skills id:9, +1 max_energy за
 * уровень) тоже считал и писал КЛИЕНТ (skills.js.upgrade() callback) — перенесено на сервер
 * (skills.php.upgrade()).
 *
 * Run: node tests/shmot-owned-bonus-economy-server-authoritative.test.js
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
// Убирает строки-комментарии (// ...) перед текстовым поиском — иначе пояснительный
// комментарий вида "// 'max_energy' убрано отсюда" сам по себе матчится как "код ещё содержит
// упоминание max_energy" и даёт ложный provал.
function stripLineComments(src){ return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n'); }

const gameopsPhp     = readSrc('server/core/models/gameops.php');
const bossesPhp      = readSrc('server/core/controllers/bosses.php');
const rewardlinksPhp = readSrc('server/core/controllers/rewardlinks.php');
const yashikPhp      = readSrc('server/core/controllers/yashik.php');
const shmotPhp       = readSrc('server/core/controllers/shmot.php');
const usersPhp       = readSrc('server/core/controllers/users.php');
const skillsPhp      = readSrc('server/core/controllers/skills.php');
const zonePhp        = readSrc('server/core/controllers/zone.php');
const shmotJs        = readSrc('_client/src/game/shmot.js');
const skillsJs       = readSrc('_client/src/game/skills.js');
const catalog        = JSON.parse(readSrc('server/json/shmot_items.json'));

console.log('\nTest 1: Gameops::applyShmotOwnBonus() — общий хелпер, начисляет max_e-бонус предмета одной аддитивной дельтой');
{
    const start = gameopsPhp.indexOf('function applyShmotOwnBonus(&$user, $itemId){');
    assert(start !== -1, 'applyShmotOwnBonus() определён');
    const end = gameopsPhp.indexOf('\n    }', start);
    const body = gameopsPhp.slice(start, end);
    assert(/bk'\] \?\? ''\) === 'max_e'/.test(body), 'проверяет именно bk === \'max_e\'');
    assert(/\$this->add\(\$user, 'max_energy', intval\(\$it\['bv'\]\)\)/.test(body),
        'начисляет через Gameops::add() (та же аддитивная дельта, что vassilich.php/hapuga.php) — не перезаписывает поле целиком');
    assert(/energy_bonus_applied/.test(body),
        'нет маркера идемпотентности: повторная выдача или миграция может удвоить бонус');
}

console.log('\nTest 2: grantShmotFromSource() вызывает applyShmotOwnBonus() сразу после owned=true (покрывает blackjack/dice/poker×2/roulette)');
{
    const start = gameopsPhp.indexOf('function grantShmotFromSource(&$user, $source){');
    const end   = gameopsPhp.indexOf('\n    }', start);
    const body  = gameopsPhp.slice(start, end);
    const ownedIdx = body.indexOf("\$state[\$id]['owned'] = true;");
    const bonusIdx = body.indexOf('applyShmotOwnBonus');
    assert(ownedIdx !== -1 && bonusIdx !== -1 && ownedIdx < bonusIdx,
        'applyShmotOwnBonus($user, $id) вызывается ПОСЛЕ owned=true, тем же $id');
}

console.log('\nTest 3: остальные 6 прямых мест выдачи шмота (в обход grantShmotFromSource) тоже зовут applyShmotOwnBonus()');
{
    // bosses.php — 01.10.2026 (ревизия политики выдачи одежды казино/боссов, см.
    // tests/casino-loot-policy.test.js и tests/boss-shmot-drop-in-claim-kill.test.js): общий
    // пул (id0-40, $shmotState[$wonId]) убран из claimKill() целиком, остался только
    // персональный боссовый пул ($bossShmotState[$wonId], проверен ассертом ниже). Проверяем,
    // что общий пул не вернулся в каком-то другом виде, и что персональный пул (единственный
    // оставшийся источник шмота с боссов) по-прежнему зовёт applyShmotOwnBonus().
    assert(!/\$shmotState\[\$wonId\]\['owned'\] = true;/.test(bossesPhp),
        'bosses.php: общий пул (id0-40) не восстановлен — удалён ревизией 01.10.2026, не регрессия');
    assert(/if\(\$bossShmotItemId !== null\)\{\s*\n\s*\$shmotAmount\+\+;\s*\n\s*\$this->ops->applyShmotOwnBonus\(\$user, \$bossShmotItemId\);/.test(bossesPhp),
        'bosses.php: персональный пул босса (оба ветвления fragment/direct) — applyShmotOwnBonus по единой точке $bossShmotItemId');

    // rewardlinks.php
    assert(/\$shmotState\[\$itemId\]\['owned'\] = true;\s*\n\s*\$this->ops->applyShmotOwnBonus\(\$user, \$itemId\);/.test(rewardlinksPhp),
        'rewardlinks.php: applyShmotOwnBonus($user, $itemId) сразу после owned=true');

    // 05.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний 04.10.2026: yashik.php/
    // shmot.php получили SELECT...FOR UPDATE, вся бизнес-логика (включая owned=true/applyShmot-
    // OwnBonus) теперь идёт на залоченной копии $lockedUser, не на $user напрямую).
    // yashik.php — 2 места (lost_stash, обычный ящик)
    assert(/\$shmotArr\[\$lostStashItemId\]\['owned'\] = true;\s*\n\s*\$lockedUser\['shmot'\] = json_encode\(\$shmotArr\);\s*\n\s*\$this->ops->applyShmotOwnBonus\(\$lockedUser, \$lostStashItemId\);/.test(yashikPhp),
        'yashik.php: lost_stash — applyShmotOwnBonus($lockedUser, $lostStashItemId)');
    assert(/\$shmotArr\[\$shmotGranted\]\['owned'\] = true;\s*\n\s*\$lockedUser\['shmot'\] = json_encode\(\$shmotArr\);\s*\n\s*\$this->ops->applyShmotOwnBonus\(\$lockedUser, \$shmotGranted\);/.test(yashikPhp),
        'yashik.php: обычный ящик — applyShmotOwnBonus($lockedUser, $shmotGranted)');

    // shmot.php — прямая покупка в магазине
    assert(/\$shmot\[\$item_id\]\['owned'\] = true;\s*\n\s*\$lockedUser\['shmot'\] = json_encode\(\$shmot\);\s*\n\s*\$this->ops->applyShmotOwnBonus\(\$lockedUser, \$item_id\);/.test(shmotPhp),
        'shmot.php: покупка — applyShmotOwnBonus($lockedUser, $item_id)');
}

console.log('\nTest 4: max_energy убрано из client-writable списков в users.php (та же дыра — client-writable + перезапись стирала серверные начисления)');
{
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed найден');
    assert(!/'max_energy'/.test(stripLineComments(allowedMatch[1])), '\'max_energy\' НЕ входит в $allowed — клиент больше не может писать его через users.save');
    const strictMatch = usersPhp.match(/\$strictNumericFields = \[([\s\S]*?)\];/);
    assert(!!strictMatch, '$strictNumericFields найден');
    assert(!/'max_energy'/.test(stripLineComments(strictMatch[1])), '\'max_energy\' убрано и из $strictNumericFields (поле больше не client-writable, потолок не нужен)');
}

console.log('\nTest 5: "Адреналин" (skills id:9, +1 max_energy/уровень) перенесён на сервер');
{
    const start = skillsPhp.indexOf('function upgrade(){');
    const end   = skillsPhp.indexOf('\n        }', skillsPhp.indexOf('$this->ops->ok(', start));
    const body  = skillsPhp.slice(start, end);
    assert(/if\(\$sid === 9\) \$this->ops->add\(\$user, 'max_energy', 1\);/.test(body),
        'skills.php.upgrade(): id:9 начисляет +1 max_energy через Gameops::add()');
    assert(/patchCurrencies\(\$user, \['skills_levels', 'max_energy'\]\)/.test(body),
        'patch включает max_energy — клиент увидит новый максимум сразу через applyPatch()');
    assert(!/TIMERS\.ENERGY_MAX = newMax;\s*\n\s*udata\['max_energy'\] = String\(newMax\);/.test(skillsJs),
        'skills.js: клиентская запись TIMERS.ENERGY_MAX/udata[\'max_energy\'] для id:9 убрана — сервер теперь единственный писатель');
}

console.log('\nTest 6: shmot.js._applyMaxEnergyBonus() удалён целиком (раньше пересчитывал по equipped и перезаписывал поле)');
{
    assert(!/_applyMaxEnergyBonus/.test(stripLineComments(shmotJs)), '_applyMaxEnergyBonus не встречается больше в коде shmot.js (кроме поясняющего комментария об удалении) — ни определения, ни вызова');
}

console.log('\nTest 7: мёртвый код armor удалён (не мигрирован — не было ни одного предмета с bk:\'armor\' в каталоге)');
{
    assert(!/getTotalArmor/.test(shmotJs), 'Shmot.getTotalArmor() удалён из shmot.js');
    const gangBonusStart = zonePhp.indexOf('private function _gangBonus($user, $key){');
    const gangBonusEnd   = zonePhp.indexOf('\n        }', gangBonusStart);
    const gangBonusBody  = zonePhp.slice(gangBonusStart, gangBonusEnd);
    assert(!/'armor'/.test(stripLineComments(gangBonusBody)), '_gangBonus() в zone.php: ключ \'armor\' убран из обоих гангов (1 и 5) — вне поясняющего комментария');
    assert(/1 => \['damage'=>10\]/.test(gangBonusBody), 'ганг 1: damage-бонус сохранён, только armor убран');
    assert(/5 => \['damage'=>20\]/.test(gangBonusBody), 'ганг 5: damage-бонус сохранён, только armor убран');
}

console.log('\nTest 8: data-level guard — среди АКТИВНЫХ предметов (с полем cat — реально видны в игре, см. shmot.js) нет ни одного с bk:\'armor\'');
{
    // Каталог целиком (server/json/shmot_items.json) содержит 19 записей с bk:'armor' — но
    // это СТАРЫЕ id0-40 без поля 'cat' (базовый магазин, удалённый из клиента 23.09.2026,
    // тот же "мёртвый код", что уже пропускает cat-guard в bosses.php.attack() — см.
    // shmot-damage-bonus-in-boss-attack.test.js). Ни один игрок не может их получить или
    // увидеть. Проверяем именно АКТИВНУЮ часть каталога — она должна остаться пустой по armor,
    // иначе удаление Shmot.getTotalArmor()/_gangBonus('armor') выше стало бы регрессом.
    const activeItems = catalog.filter(it => 'cat' in it);
    assert(activeItems.length > 0, 'в каталоге есть активные (cat) предметы — тест имеет смысл');
    const activeArmorItems = activeItems.filter(it => it.bk === 'armor');
    assert(activeArmorItems.length === 0,
        'если это когда-нибудь перестанет быть true (кто-то добавит активный armor-предмет) — этот тест упадёт и напомнит, что armor больше не подключён нигде');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
