/**
 * Test: 18.09.2026 — SERVER-AUTHORITATIVE ПОКЕР. Раньше списание фишки/тушёнки, весовой RNG
 * комбинации (_pokerRoll), генерация карт под неё (_pokerGenerateHandForCombo), честная
 * замена карт и итоговая оценка руки (_evaluatePokerHand) считались ПРЯМО В БРАУЗЕРЕ
 * (dvor-poker-game.js) — читер мог напрямую подставить this._pokerHand с рояль-флешем и
 * вызвать _resolvePokerNewScreen() из консоли, либо просто вызвать dvor._give('shmot', 999)
 * напрямую. Теперь раздача/замена/итог — три отдельных запроса к серверу (poker.deal/swap/
 * resolve, server/core/controllers/poker.php). Активная раздача хранится в служебном поле
 * udata['poker_session'] — НЕ в whitelist users.php (как dice_session/yashik_session/
 * roulette_cups/skills_levels), клиент физически не может подделать её через users.save.
 *
 * Run: node tests/poker-server-authoritative.test.js
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

const pokerJs      = readSrc('_client/src/game/dvor/dvor-poker.js');
const pokerGameJs  = readSrc('_client/src/game/dvor/dvor-poker-game.js');
const pokerScreenJs= readSrc('_client/src/game/dvor/dvor-poker-screen.js');
const dvorJs       = readSrc('_client/src/game/dvor.js');
const pokerPhp     = readSrc('server/core/controllers/poker.php');
const registrySrc  = readSrc('server/core/models/registry.php');
const usersPhp     = readSrc('server/core/controllers/users.php');
const migrate20    = readSrc('server/migrate20.php');
const catalogJson  = JSON.parse(readSrc('server/json/poker_config.json'));

console.log('\nTest 1: сервер — контроллер Poker зарегистрирован и реализует deal/swap/resolve');
{
    assert(/'classes'\s*=>\s*array\([^)]*'poker'/.test(registrySrc.replace(/\n/g, '')),
        "'poker' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс)");
    // 22.09.2026: 'openBag' добавлен в permits (server-authoritative открытие сумки) —
    // см. tests/roulette-poker-spichki-open-server-authoritative.test.js.
    // 25.09.2026 (регресс найден повторным прогоном тестов): 'getSession' добавлен — точка
    // восстановления раздачи после перезагрузки/смены вкладки, см.
    // dvor-session-resume-poker-dice-blackjack.test.js.
    assert(/permits\s*=\s*\['deal', 'swap', 'resolve', 'openBag', 'getSession'\]/.test(pokerPhp), 'Poker.permits — deal/swap/resolve/openBag/getSession');
    assert(/function deal\(\)/.test(pokerPhp), 'метод deal() существует');
    assert(/function swap\(\)/.test(pokerPhp), 'метод swap() существует');
    assert(/function resolve\(\)/.test(pokerPhp), 'метод resolve() существует');
}

console.log('\nTest 2: poker_session НЕ в client-writable whitelist (ключевая защита от чита)');
{
    // 19.09.2026: сужено до массива $allowed — 'poker_session' легитимно упоминается ещё и в
    // users.resetSession() ('poker_session' => null), проверка по всему файлу стала ложно-отрицательной.
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(!/'poker_session'/.test(allowedMatch ? allowedMatch[1] : ''),
        "'poker_session' сознательно НЕ добавлен в \$allowed users.php — клиент не может подделать раздачу через users.save");
    assert(/'poker_chips'/.test(usersPhp), "'poker_chips' остаётся в whitelist (валюта покупки фишек за донат, не сама раздача)");
    assert(/'dvor_daily'/.test(usersPhp), "'dvor_daily' остаётся в whitelist (низкий риск — тот же уровень, что и у cards_free/dice_free флагов)");
}

console.log('\nTest 3: миграция 20 создаёт служебное поле poker_session');
{
    assert(/\$col = 'poker_session';/.test(migrate20), 'миграция нацелена на колонку poker_session');
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col` \$def/.test(migrate20), 'использует ALTER TABLE ADD COLUMN (тот же паттерн, что migrate18/19)');
    assert(/TEXT DEFAULT NULL/.test(migrate20), 'тип TEXT (JSON-блоб, как dice_session/yashik_session/skills_levels)');
    assert(/stalker_migrate20_2026/.test(migrate20), 'миграция защищена секретным ключом в URL');
}

console.log('\nTest 4: каталог poker_config.json совпадает построчно со старой клиентской таблицей комбинаций');
{
    // 19.09.2026 (по прямому указанию, после проверки что все 13×4 файла карт реально лежат
    // на сервере в images/покер масть */): колода расширена с 8 (семёрка-туз) до полных 13
    // рангов (двойка-туз) — раньше 2-6 никогда не выпадали, хотя картинки для них были готовы.
    assert(catalogJson.ranks.length === 13 && catalogJson.ranks[0] === 'двойка' && catalogJson.ranks[12] === 'туз',
        'ranks — полная колода из 13 значений от двойки до туза');
    assert(catalogJson.suits.length === 4, 'suits — 4 масти');
    const expectUpto = {royal_flush:0.10, straight_flush:0.20, four_of_a_kind:0.35, full_house:0.42,
        flush:0.82, straight:1.07, three_of_a_kind:2.57, two_pair:4.57, pair:14.57, high_card:100.0};
    for(const row of catalogJson.roll_table){
        assert(row.upto === expectUpto[row.key], 'roll_table.' + row.key + '.upto === ' + expectUpto[row.key] + ' (1-в-1 со старым клиентским _pokerRoll)');
    }
    assert(catalogJson.combos.royal_flush.type === 'shmot' && catalogJson.combos.royal_flush.amt === 1, 'royal_flush → одна недостающая вещь Игромана');
    assert(catalogJson.combos.three_of_a_kind.sp === 300 && catalogJson.combos.high_card.sp === 50, 'sp (спички) для three_of_a_kind/high_card совпадают со старым клиентом');
    assert(catalogJson.play_cost_stew === 5 && catalogJson.daily_stew_limit === 25, 'цена игры (5 тушёнки) и дневной лимит (25) совпадают со старым клиентом');
    assert(catalogJson.exp_reward === 2500 && catalogJson.cig_reward === 1000, 'exp/cig награда за партию совпадает со старым клиентом (_give(exp,2500)/_give(cig,1000))');
}

console.log('\nTest 5: poker.php.deal() — списание фишки/тушёнки с дневным лимитом, честный весовой ролл');
{
    const start = pokerPhp.indexOf('function deal(){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf('$this->ops->ok', start));
    const body  = pokerPhp.slice(start, end);

    assert(/deduct\(\$user, 'poker_chips', 1\)/.test(body), 'при use_chip=true списывает ровно 1 фишку через Gameops::deduct (не может уйти в минус)');
    assert(/return \$this->ops->fail\(79\)/.test(body), 'недостаточно фишек → код 79');
    assert(/\$pokerUsed >= intval\(\$catalog\['daily_stew_limit'\]\)/.test(body), 'проверяет дневной лимит игр за тушёнку из каталога, не хардкод');
    assert(/return \$this->ops->fail\(80\)/.test(body), 'дневной лимит исчерпан → код 80');
    assert(/deduct\(\$user, 'stew', intval\(\$catalog\['play_cost_stew'\]\)\)/.test(body), 'цена партии за тушёнку берётся из каталога, не хардкод');
    assert(/return \$this->ops->fail\(81\)/.test(body), 'недостаточно тушёнки → код 81');
    assert(/_rollCombo\(\$catalog, \$comboTrace\)/.test(body), 'катает весовую комбинацию через сервер (не принимает от клиента)');
    assert(/_generateHandForCombo\(\$catalog, \$targetCombo\)/.test(body), 'генерирует честную руку под выпавшую комбинацию');
    // 24.09.2026: добавлен JSON_UNESCAPED_UNICODE (баг с кириллицей рангов, см.
    // poker-blackjack-session-unescaped-unicode-cyrillic-ranks.test.js) — сама запись не изменилась.
    assert(/\$user\['poker_session'\] = json_encode\(\$session, JSON_UNESCAPED_UNICODE\)/.test(body), 'сохраняет активную раздачу в poker_session');
}

console.log('\nTest 6: poker.php.swap() — честная случайная замена, лимит смен проверяется сервером');
{
    const start = pokerPhp.indexOf('function swap(){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf('$this->ops->ok', start));
    const body  = pokerPhp.slice(start, end);

    assert(/empty\(\$session\['active'\]\)\) return \$this->ops->fail\(82\)/.test(body), 'нет активной раздачи → код 82 (нельзя менять карту без deal())');
    assert(/intval\(\$session\['swapsUsed'\]\) >= intval\(\$session\['swapsAllowed'\]\)/.test(body), 'проверяет реально израсходованные смены по серверной сессии, не по данным клиента');
    assert(/return \$this->ops->fail\(83\)/.test(body), 'смены закончились → код 83');
    assert(/\$sameAsOld = \(\$cand\['rank'\] === \$old\['rank'\] && \$cand\['suit'\] === \$old\['suit'\]\);[\s\S]*?if\(\$sameAsOld\) continue;/.test(body), 'новая карта гарантированно отличается от старой (честная замена, как в клиентском _togglePokerSwap)');
}

console.log('\nTest 7: poker.php.resolve() — награда считается по РЕАЛЬНОЙ финальной руке на столе, не по изначальному target');
{
    const start = pokerPhp.indexOf('function resolve(){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf('$this->ops->ok', start));
    const body  = pokerPhp.slice(start, end);

    assert(/empty\(\$session\['active'\]\)\) return \$this->ops->fail\(82\)/.test(body), 'нет активной раздачи → код 82 (нельзя завершить партию без deal())');
    assert(/_evaluateHand\(\$catalog, \$session\['hand'\]\)/.test(body), 'оценивает ИТОГОВУЮ руку из session (после всех swap), не изначальный targetCombo');
    assert(/\$session\['active'\] = false/.test(body), 'помечает раздачу завершённой — повторный resolve той же раздачи невозможен');
    assert(body.includes("grantShmotFromSource($user, 'poker')"), 'шмот выдаётся сервером из пула покера');
    assert(body.includes("$this->_grantWeaponReward($user, $c['type'], $c['amt']);"), 'оружие начислено сервером');
}

console.log('\nTest 8: клиент dvor-poker-game.js — deal/swap/resolve асинхронные, зовут сервер, RNG удалён');
{
    assert(pokerGameJs.includes("import { applyPatch } from '../../modules/patch.js';"), 'импортирует applyPatch');
    assert(!/proto\._evaluatePokerHand\s*=/.test(pokerGameJs), '_evaluatePokerHand (клиентская оценка руки) удалена целиком');
    assert(!/proto\._pokerGenerateHandForCombo\s*=/.test(pokerGameJs), '_pokerGenerateHandForCombo (клиентская генерация под комбинацию) удалена целиком');
    assert(!/_pokerPayAndResolve/.test(pokerGameJs), '_pokerPayAndResolve (мёртвый код старого API) удалён целиком');
    assert(!/Math\.random\(\)\*100/.test(pokerGameJs), 'клиентский весовой ролл (Math.random()*100, старый _pokerRoll) удалён');

    assert(/TS\.php\('poker\.deal', \{use_chip: useChip\}/.test(pokerGameJs), '_playPokerNewScreen шлёт use_chip на сервер');
    assert(/TS\.php\('poker\.swap', \{idx: idx\}/.test(pokerGameJs), '_togglePokerSwap шлёт idx на сервер');
    assert(/TS\.php\('poker\.resolve', \{\}/.test(pokerGameJs), '_resolvePokerNewScreen зовёт сервер без параметров');

    assert(/applyPatch\(res\.patch\)/.test(pokerGameJs), 'применяет патч сервера при раздаче');
    assert(/this\._pokerHand\s*=\s*res\.hand;/.test(pokerGameJs), 'рука берётся из ответа сервера, а не генерируется на клиенте');
    // 25.09.2026 (регресс найден повторным прогоном тестов): формула изменена на
    // swapsAllowed-swapsUsed — если deal() вернул уже АКТИВНУЮ (восстановленную) раздачу, а не
    // свежую, swapsUsed может быть >0, см. dvor-session-resume-poker-dice-blackjack.test.js.
    assert(/this\._pokerSwapsLeft\s*=\s*Math\.max\(0,\s*intval_\(res\.swapsAllowed\)\s*-\s*intval_\(res\.swapsUsed\)\);/.test(pokerGameJs), 'лимит смен = swapsAllowed - swapsUsed (учитывает восстановленную раздачу)');
    assert(/this\._pokerHand\[idx\] = res\.card;/.test(pokerGameJs), 'при замене карта берётся из ответа сервера');
    assert(/this\._pokerSwapsLeft = res\.swapsLeft;/.test(pokerGameJs), 'остаток смен после swap синхронизируется с сервером');
}

console.log('\nTest 9: ошибки сервера (fail-коды 79-83) обрабатываются на клиенте адресными сообщениями');
{
    assert(/err && err\.code === 79/.test(pokerGameJs), 'код 79 (нет фишек) обрабатывается отдельно');
    assert(/err && err\.code === 80/.test(pokerGameJs), 'код 80 (дневной лимит) обрабатывается отдельно');
    assert(/err && err\.code === 81/.test(pokerGameJs), 'код 81 (недостаточно тушёнки) обрабатывается отдельно');
    assert(/err && err\.code === 83/.test(pokerGameJs), 'код 83 (смены закончились) обрабатывается на клиенте при swap');
}

console.log('\nTest 10: гонка «незавершённая раздача + повторный ИГРАТЬ» — resolve ждём ДО начала нового deal (не параллельно)');
{
    const start = pokerGameJs.indexOf('proto._playPokerNewScreen = function(useChip){');
    const end   = pokerGameJs.indexOf('\n    };', pokerGameJs.indexOf('doDeal();\n        }\n', start));
    const body  = pokerGameJs.slice(start, end);
    assert(/this\._pokerConfirmNewScreen\(\(\) => \{/.test(body),
        'при незавершённой раздаче (_pokerState===1) doDeal() вызывается ТОЛЬКО из onDone-колбэка resolve, не сразу — иначе deal() перезапишет poker_session раньше, чем resolve() успеет его прочитать на сервере');
}

console.log('\nTest 11: старая FLA-панель покера (_getPokerSlots/_pokerRoll/_playPoker/_resolvePoker) удалена, использования в dvor.js зачищены');
{
    assert(!/proto\._getPokerSlots/.test(pokerJs), '_getPokerSlots удалена из dvor-poker.js');
    assert(!/proto\._pokerRoll\s*=/.test(pokerJs), '_pokerRoll удалена из dvor-poker.js');
    assert(!/proto\._playPoker\s*=/.test(pokerJs), '_playPoker (старая панель) удалена из dvor-poker.js');
    assert(!/proto\._resolvePoker\s*=/.test(pokerJs), '_resolvePoker (старая панель) удалена из dvor-poker.js');
    assert(!/proto\._pokerShuffleDeck/.test(pokerJs), '_pokerShuffleDeck (использовалась только старым RNG-фолбэком) удалена');

    assert(!/this\._playPoker\(\)/.test(dvorJs), 'dvor.js._bindGamePanels() больше не привязывает удалённый _playPoker() к poker_panel.butt_deal');
    assert(!/this\._getPokerSlots\(/.test(dvorJs), 'dvor.js._initPanel() больше не вызывает удалённую _getPokerSlots()');
}

console.log('\nTest 12: экран покера (dvor-poker-screen.js) не переписывался — UI-слой не тронут переносом RNG на сервер');
{
    assert(/proto\._buildPokerScreen = function\(\)/.test(pokerScreenJs), '_buildPokerScreen (построение экрана) на месте — миграция не трогала визуальный слой');
    assert(/proto\._updatePokerCardVisual = function\(idx\)/.test(pokerScreenJs), '_updatePokerCardVisual (отрисовка карты) на месте — используется и деалом, и свапом после миграции');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
