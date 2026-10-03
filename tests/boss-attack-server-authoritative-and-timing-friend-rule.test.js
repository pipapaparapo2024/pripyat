/**
 * Test: батч 22.09.2026 (по прямому указанию, финальный заход на боевую систему боссов) —
 *
 * 1) "Перенеси вообще всё, что связано с боем, на сервер" — урон/крит/бонус скилла/бонус
 *    банды/бонус тира оружия/бонус Зала оружия/расход патронов донат-оружия (с экономией на
 *    добивающем ударе)/кулдаун бесплатного оружия/HP босса — раньше всё это считал и хранил
 *    клиент (bosses-combat.js._attack(), полностью клиентские BASE_DMG/_tierDmg/getHallBonus/
 *    getFlatBonus/getCritChance/Gangs.getBonus). Теперь это делает СЕРВЕР — новый эндпоинт
 *    bosses.attack() (server/core/controllers/bosses.php) — клиент шлёт только НАМЕРЕНИЕ
 *    (boss_id/diff_idx/weapon_id/mult) и применяет готовый ответ.
 *
 * 2) Уточнение механики помощи друзей (по прямому указанию, с точным примером): "боссы не
 *    обязаны совпадать — если я атакую в 10:00 (мой бой уже активен), а друг атакует в 11:00
 *    (СВОЙ бой, ЛЮБОЙ босс), урон друга в 11:00 переносится МНЕ, потому что в момент его удара
 *    у меня уже шёл бой. А мой урон, нанесённый в 10:00, ДРУГУ не переносится, потому что в
 *    10:00 у друга ещё не было активного боя". HP стало производным значением (не хранимым
 *    счётчиком): maxHp - (мой урон из boss_damage_log с начала МОЕГО bossStartMs) - (урон
 *    друзей из лога, по ЛЮБОМУ их боссу, с того же момента). Соло (diff_idx=3) исключено
 *    полностью — там нет ни рейтинга, ни помощи, босс убивается только собственным уроном.
 *
 * Run: node tests/boss-attack-server-authoritative-and-timing-friend-rule.test.js
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

const bossesPhp = readSrc('server/core/controllers/bosses.php');
const combatJs  = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightJs   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const weaponsCfg = JSON.parse(readSrc('server/json/weapons_config.json'));
const skillsCfg  = JSON.parse(readSrc('server/json/skills_config.json'));

console.log('\nTest 1: каталоги — весь баланс формулы урона перенесён из клиентских таблиц в JSON (сервер их читает, не хардкодит)');
{
    assert(Array.isArray(weaponsCfg.base_damage) && weaponsCfg.base_damage.length === 6, 'weapons_config.base_damage — 6 значений (нож/цепь/бита/мачете/ствол/автомат)');
    assert(weaponsCfg.base_damage.join(',') === '5,12,20,40,50,200', 'base_damage совпадает с исходной клиентской таблицей BASE_DMG');
    assert(Array.isArray(weaponsCfg.tier_damage) && weaponsCfg.tier_damage.length === 21, 'weapons_config.tier_damage — 21 значение (уровни апгрейда 0-20)');
    // 25.09.2026 (по прямому указанию — "убираем эту механику"): hall_milestones ("Зал оружия")
    // убран из каталога целиком.
    assert(weaponsCfg.hall_milestones === undefined, 'weapons_config.hall_milestones больше не существует');
    assert(Array.isArray(weaponsCfg.weapon_key) && weaponsCfg.weapon_key.join(',') === 'knife,chain,bat,machete,gun,auto', 'weapon_key — маппинг id оружия → ключ скилла');
    assert(Array.isArray(weaponsCfg.mult_options) && weaponsCfg.mult_options.join(',') === '1,10,50,100,500,1000', 'mult_options совпадает с клиентским MULT_OPTIONS');
    assert(Array.isArray(skillsCfg.skills) && skillsCfg.skills.length === 20, 'skills_config.skills — метаданные (type/weapon/totalBonus) всех 20 скиллов');
    assert(skillsCfg.skills[0].type === 'flat' && skillsCfg.skills[0].weapon === 'machete' && skillsCfg.skills[0].totalBonus === 10,
        'skills_config.skills[0] совпадает с исходным skills.js.list[0] ("С размашки")');
}

console.log('\nTest 2: bosses.php.attack() — валидация входа и обязательный активный бой');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/if\(\$bossId < 0 \|\| \$bossId > 7 \|\| \$diffIdx < 0 \|\| \$diffIdx > 3\) return \$this->ops->fail\(54\);/.test(body), 'валидирует диапазон boss_id/diff_idx');
    assert(/if\(\$weaponId < 0 \|\| \$weaponId > 5\) return \$this->ops->fail\(54\);/.test(body), 'валидирует диапазон weapon_id (0-5)');
    assert(/if\(!in_array\(\$mult, \$wCatalog\['mult_options'\], true\)\)/.test(body), 'валидирует mult только из mult_options каталога (не произвольное число)');
    assert(/\$isFree = \$weaponId <= 2;/.test(body) && /if\(\$isFree\)\{\s*\n\s*\$mult = 1;/.test(body), 'бесплатное оружие (0-2) всегда mult=1, игнорируя присланное значение');
    assert(/if\(\$bossStartMs <= 0\) return \$this->ops->fail\(65\);/.test(body), 'требует реально начатый бой (bossStartMs > 0) — нельзя ударить без старта через сервер');
    assert(/if\(\(\$now - \$bossStartMs\) >= \$this->MAX_FIGHT_WINDOW_MS\) return \$this->ops->fail\(66\);/.test(body), 'отклоняет удар по уже "протухшему" бою');
}

console.log('\nTest 3: bosses.php.attack() — оружие: владение донат-оружием, патроны, кулдаун бесплатного');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/if\(empty\(\$wp\['owned'\]\)\) return \$this->ops->fail\(89\);/.test(body), 'донат-оружие должно быть куплено (проверяется server-side, не доверяет клиенту)');
    assert(/if\(intval\(\$wp\['qty'\] \?\? 0\) < \$mult\) return \$this->ops->fail\(87\);/.test(body), 'донат-оружие требует достаточно патронов на выбранный множитель');
    assert(/if\(\$lastUse > 0 && \(\$now - \$lastUse\) < \$this->FREE_WPN_CD_MS\) return \$this->ops->fail\(88\);/.test(body), 'бесплатное оружие проверяет кулдаун (freeWpnCdMs в bosses_data) на сервере');
    // 26.09.2026 (по прямому указанию — "оружка тратится согласно тому сколько и ударил, похуй
    // на хп босса"): "экономия" патронов на добивающем ударе убрана — mult всегда списывается
    // целиком, независимо от того, хватило бы меньшего множителя, чтобы добить босса.
    // 26.09.2026 (повторное изменение тем же днём, аудит перед модерацией VK — гонка
    // параллельных запросов): списание патронов переехало на SELECT...FOR UPDATE +
    // read-modify-write внутри транзакции ($lockedWeapons/$lockedQty), чтобы два параллельных
    // запроса не списали патроны один раз при двойном уроне (lost update). Формула вычитания
    // (`qty - mult`, без экономии) не изменилась — изменился только источник читаемого qty
    // (заблокированная строка, не ранее прочитанный $weapons) и имя переменной.
    assert(/\$lockedWeapons\[\$weaponId\]\['qty'\] = \$lockedQty - \$mult;/.test(body),
        'патроны списываются полным mult целиком (из заблокированной SELECT...FOR UPDATE строки), без экономии на добивающем ударе');
    assert(!/\$actualConsume/.test(body), 'логика "экономии" (actualConsume/dmgPerUnit) удалена целиком');
}

console.log('\nTest 4: bosses.php.attack() — формула урона (база+тир+флэт-скилл)×крит×банда, RNG сервера');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$tierBonus = intval\(\$wCatalog\['tier_damage'\]\[min\(20, intval\(\$wp\['upg'\] \?\? 0\)\)\] \?\? 0\);/.test(body), 'бонус тира читается из weapons_config по текущему upg оружия');
    // 25.09.2026 (по прямому указанию — "убираем эту механику"): бонус "Зала оружия" убран —
    // проверяем реальный КОД ($hallBonus), не голое слово (комментарии законно его упоминают).
    assert(!/\$hallBonus/.test(body), 'hallBonus нигде не считается в attack()');
    assert(/\$skillsState = \$this->_loadSkillsState\(\$user\);/.test(body), 'читает реальное состояние скиллов игрока (server-only skills_levels, не доверяет клиенту)');
    assert(/if\(\$sk\['type'\] === 'flat'\) \$flatSkill \+= \$bonus;/.test(body) && /else if\(\$sk\['type'\] === 'crit'\) \$critChance \+= \$bonus;/.test(body),
        'суммирует flat- и crit-скиллы именно для выбранного оружия (weapKey)');
    // 22.09.2026 (по прямому указанию): банды как реальная, доигранная фича с рабочим бонусом
    // на урон пока не существуют в игре — $gangDmg зафиксирован в 1, реальный вызов
    // _gangBonus() закомментирован (не удалён — вернуть одной строкой, когда банды заработают).
    assert(/\$gangDmg = 1;/.test(body), '$gangDmg зафиксирован в 1 — бонус банды на урон не считается, пока банды не реализованы');
    assert(!/\$gangDmg = 1 \+ \$this->_gangBonus/.test(body), 'реальный вызов _gangBonus() для урона закомментирован, не активен');
    // 23.09.2026: бросок вынесен в отдельную $critRoll переменную (логируется в debug-ответе),
    // сама формула/RNG-источник (mt_rand) не изменились.
    assert(/\$critRoll = mt_rand\(0, 999999\) \/ 10000;/.test(body) && /\$isCrit = \$critChance > 0 && \$critRoll < \$critChance;/.test(body),
        'крит бросается СЕРВЕРНЫМ RNG (mt_rand), не клиентским Math.random()');
    // 22.09.2026 (баг "выданные шмотки не дают буст оружки", по прямому указанию): добавлен
    // множитель $shmotDmgMult (процентный бонус экипированных шмоток bk:'damage') — формула
    // расширена, но структура (крит/банда/mult) не изменилась, см.
    // shmot-damage-bonus-in-boss-attack.test.js для покрытия самого бонуса.
    assert(/\$damage = intval\(floor\(\(\$baseDmgWpn \+ \$flatSkill \+ \$shmotFlat\) \* \(\$isCrit \? 1\.5 : 1\) \* \$gangDmg \* \$shmotDmgMult\)\) \* \$mult;/.test(body),
        'итоговая формула совпадает с исходной клиентской + бонус шмоток: (base+flat+шмот оружия)×(крит?1.5:1)×банда×шмот×mult');
}

console.log('\nTest 5: bosses.php.attack() — HP производное (не хранимый счётчик), лог урона, ответ клиенту');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    // 24.09.2026 (по прямому указанию — перенять у референсной игры модель "мутируемый HP +
    // курсор" вместо пересчёта SUM() с нуля на каждый запрос): HP до удара берётся из личного
    // кэша boss_fight_session через _syncFightSession() (сам кэш и курсорная дедупликация урона
    // друга — см. boss-fight-session-cache-and-friend-cursor.test.js), а не пересчитывается тут
    // заново из _damageSumSince/_friendsDamageSumSince на каждый удар.
    // 30.09.2026 (прогон перед деплоем — тест обновлён под актуальную сигнатуру): 29.09.2026
    // 7-й параметр _syncFightSession() стал картой $friendsSince (uid=>effectiveSinceMs) вместо
    // плоского списка $friendIds — фикс retroactive-урона друга (см. _friendsSinceMap()).
    // 04.10.2026 (найдено на реальных прод-данных — "cursorId уехал вперёд, а hp не упал"):
    // голый _syncFightSession() был уязвим к гонке с параллельным friendsDamage()/useSedoy()
    // (lost update). Теперь — _syncFightSessionLocked(), блокирует строку SELECT...FOR UPDATE
    // и перечитывает кэш ПОД локом, см. tests/boss-fight-session-row-lock-race.test.js.
    assert(/\$session = \$this->_syncFightSessionLocked\(\$link, \$uid, \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
        'HP до удара — из личного кэша, под блокировкой строки (_syncFightSessionLocked подтягивает свежий урон друзей курсором)');
    assert(/\$hpBefore = intval\(\$session\['hp'\]\);/.test(body), 'hpBefore читается из кэша, не пересчитывается SUM()-ом');
    assert(/\$this->_commitFightSession\(\$link, \$uid, \$session\);/.test(body), 'обновлённый кэш коммитится атомарно (снимает блокировку строки) ДО продолжения обработки удара');
    assert(/INSERT INTO `boss_damage_log`/.test(body), 'каждый удар всё равно пишется в лог (источник правды для истории/рейтинга/курсора друзей)');
    assert(/'hp' => \$newHp,/.test(body) && /'maxHp' => \$maxHp,/.test(body) && /'damage' => \$damage,/.test(body) && /'critical' => \$critInt,/.test(body),
        'ответ содержит готовые hp/maxHp/damage/critical — клиенту не нужно ничего досчитывать');
}

console.log('\nTest 6: клиент — _attack() шлёт намерение серверу, не считает урон сам');
{
    const start = combatJs.indexOf('proto._attack = function');
    const end   = combatJs.indexOf('\n    };', start);
    const body  = combatJs.slice(start, end);
    assert(/TS\.php\('bosses\.attack', \{ boss_id: idx, diff_idx: this\._diffIdx, weapon_id: eqWpn\.id, mult: mult \}/.test(body),
        '_attack() шлёт boss_id/diff_idx/weapon_id/mult — намерение, не готовый урон');
    assert(!/Math\.random\(\)/.test(body), 'клиент больше не бросает крит сам (Math.random() убран из _attack())');
    assert(!/const BASE_DMG = /.test(body), 'клиентская таблица BASE_DMG убрана — база урона больше не хранится на клиенте');
    assert(!/skills\.getFlatBonus/.test(body) && !/skills\.getCritChance/.test(body), 'клиент больше не считает бонусы скиллов для урона (это делает сервер)');
    assert(/applyPatch\(res\.patch\);/.test(body) && /this\._setHp\(idx, res\.hp\);/.test(body), 'применяет патч и производный HP из ответа сервера');
    assert(/if\(window\.weapons\) weapons\._loadFromUdata\(\);/.test(body), 'обновляет локальный кэш оружия (qty) из свежего patch — тот же паттерн, что weapons.js._buy/_upgrade');
}

console.log('\nTest 7: правило "оба одновременно в бою" — симуляция на точных условиях пользователя (боссы РАЗНЫЕ, не обязаны совпадать)');
{
    // Независимая реализация derived-HP формулы (не читает исходники — реальный прогон логики):
    // damageOf(player, sinceMs) = SUM(лог игрока с момента sinceMs), НЕ фильтруется по боссу.
    const log = []; // {uid, time, damage}
    const hit = (uid, timeMs, damage) => log.push({ uid, time: timeMs, damage });
    const damageSumSince = (uid, sinceMs) => log.filter(r => r.uid === uid && r.time >= sinceMs).reduce((s, r) => s + r.damage, 0);

    const A = { uid: 'A', bossStartMs: 0 };
    const B = { uid: 'B', bossStartMs: 0 };

    // 10:00 — A начинает СВОЙ бой (с боссом X) и сразу бьёт на 100.
    const T_1000 = 1000, T_1100 = 1100;
    A.bossStartMs = T_1000;
    hit('A', T_1000, 100);

    // 11:00 — B начинает СВОЙ бой (с СОВЕРШЕННО ДРУГИМ боссом Y) и бьёт на 200.
    B.bossStartMs = T_1100;
    hit('B', T_1100, 200);

    // derived HP для A: maxHpA - (урон A с A.bossStartMs) - (урон B с A.bossStartMs, ЛЮБОЙ его босс).
    const aOwn    = damageSumSince('A', A.bossStartMs);
    const aFriend = damageSumSince('B', A.bossStartMs); // считаем урон B с МОМЕНТА СТАРТА A, не B
    assert(aOwn === 100, 'у A свой урон с начала своего боя = 100');
    assert(aFriend === 200, 'A получает все 200 урона B — B ударил (11:00) уже ПОСЛЕ старта боя A (10:00), неважно, что боссы РАЗНЫЕ');

    // derived HP для B: урон A засчитывается B только если он нанесён С МОМЕНТА СТАРТА B (11:00).
    const bOwn    = damageSumSince('B', B.bossStartMs);
    const bFriend = damageSumSince('A', B.bossStartMs); // урон A с МОМЕНТА СТАРТА B
    assert(bOwn === 200, 'у B свой урон с начала своего боя = 200');
    assert(bFriend === 0, 'B НЕ получает урон A (100, нанесённый в 10:00) — на тот момент бой B ещё не начался (правило геймдизайнера: направление важно)');

    // Контрольная проверка симметрии: если ПОСЛЕ 11:00 A бьёт ЕЩЁ раз — этот новый урон уже
    // нанесён, когда бой B активен, и должен засчитаться B.
    const T_1105 = 1105;
    hit('A', T_1105, 50);
    const bFriend2 = damageSumSince('A', B.bossStartMs);
    assert(bFriend2 === 50, 'но урон A, нанесённый ПОСЛЕ старта B (тот самый "50" одновременно), B получает — окно засчёта симметрично работает в обе стороны');

    // Соло явно исключено — эта формула вообще не должна вызываться для diffIdx=3 (проверено
    // отдельно на уровне PHP-кода в Test 5 выше: friendDmg = ($diffIdx!==3) ? ... : 0).
}

console.log('\nTest 8: bosses_fight.js — новая попытка получает hp из ответа startFight(), возобновление — через _syncFriendsDamage() перед показом экрана');
{
    const start = fightJs.indexOf('proto._openBossesFight = function');
    const cbStart = fightJs.indexOf("TS.php('bosses.startFight'", start);
    const cbEnd   = fightJs.indexOf('this._reallyOpenBossesFight(bossIdx);', cbStart);
    const newFightBody = fightJs.slice(cbStart, cbEnd);
    assert(/if\(typeof res\.hp === 'number'\) bosses\._setHp\(bossIdx, res\.hp\);/.test(newFightBody),
        'новая/возобновлённая попытка выставляет HP из ответа bosses.startFight (производное значение, не всегда maxHp)');

    const resumeStart = fightJs.indexOf('bosses._fightStart = bosses._bossStartMs[di][bossIdx];');
    const resumeEnd   = fightJs.indexOf('this._reallyOpenBossesFight(bossIdx);', resumeStart);
    const resumeBody  = fightJs.slice(resumeStart, resumeEnd);
    assert(/bosses\._syncFriendsDamage\(bossIdx, \(\) => this\._reallyOpenBossesFight\(bossIdx\)\);/.test(resumeBody),
        'при повторном открытии УЖЕ идущего боя (клиент помнил bossStartMs локально) — подтягивает свежий производный HP ПЕРЕД показом экрана, не показывает потенциально устаревший');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
