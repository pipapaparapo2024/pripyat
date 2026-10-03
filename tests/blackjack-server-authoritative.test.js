/**
 * Test: 18.09.2026 — SERVER-AUTHORITATIVE БЛЭКДЖЕК ("Карты", игра 4/4, последняя из
 * непереведённых систем экономики). Раньше списание рубля/бесплатной попытки, скрытый
 * pity-счётчик AA/KK/QQ (this._data.cards.aa/kk/qq — часть client-writable dvor_games_data),
 * честная раздача пары и честная замена карты считались ПРЯМО В БРАУЗЕРЕ (dvor-blackjack.js) —
 * читер мог подделать pity-счётчики через users.save и форсировать гарантированную пару тузов
 * (10000 сигарет + шмотка) в каждой партии. Теперь раздача/замена/итог — три отдельных запроса
 * (blackjack.deal/swap/resolve, server/core/controllers/blackjack.php). Pity-счётчики и признак
 * "бесплатная попытка сегодня уже использована" хранятся в НОВОМ служебном поле
 * blackjack_session — НЕ в whitelist users.php (как dice_session/poker_session/skills_levels),
 * клиент физически не может подделать его через users.save.
 *
 * Run: node tests/blackjack-server-authoritative.test.js
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

const bjSrc        = readSrc('_client/src/game/dvor/dvor-blackjack.js');
const bjPhp        = readSrc('server/core/controllers/blackjack.php');
const registrySrc  = readSrc('server/core/models/registry.php');
const usersPhp     = readSrc('server/core/controllers/users.php');
const migrate21    = readSrc('server/migrate21.php');
const catalogJson  = JSON.parse(readSrc('server/json/blackjack_config.json'));

console.log('\nTest 1: сервер — контроллер Blackjack зарегистрирован и реализует deal/swap/resolve');
{
    assert(/'classes'\s*=>\s*array\([^)]*'blackjack'/.test(registrySrc.replace(/\n/g, '')),
        "'blackjack' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс)");
    // 24.09.2026: добавлен permit 'status' (лёгкий эндпоинт для чтения dailyState без раздачи) —
    // расширение списка, не регресс исходных трёх.
    assert(/permits\s*=\s*\['status', 'deal', 'swap', 'resolve'\]/.test(bjPhp), 'Blackjack.permits — status/deal/swap/resolve');
    assert(/function deal\(\)/.test(bjPhp), 'метод deal() существует');
    assert(/function swap\(\)/.test(bjPhp), 'метод swap() существует');
    assert(/function resolve\(\)/.test(bjPhp), 'метод resolve() существует');
}

console.log('\nTest 2: blackjack_session НЕ в client-writable whitelist (ключевая защита от чита)');
{
    // 19.09.2026: сужено до массива $allowed — 'blackjack_session' легитимно упоминается ещё и в
    // users.resetSession() ('blackjack_session' => null), проверка по всему файлу стала ложно-отрицательной.
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(!/'blackjack_session'/.test(allowedMatch ? allowedMatch[1] : ''),
        "'blackjack_session' сознательно НЕ добавлен в \$allowed users.php — клиент не может подделать pity/раздачу через users.save");
    assert(/'dvor_games_data'/.test(usersPhp), "'dvor_games_data' остаётся в whitelist (там же живёт exp/уровень блэкджека — низкий риск, не сам pity)");
}

console.log('\nTest 3: миграция 21 создаёт служебное поле blackjack_session');
{
    assert(/\$col = 'blackjack_session';/.test(migrate21), 'миграция нацелена на колонку blackjack_session');
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col` \$def/.test(migrate21), 'использует ALTER TABLE ADD COLUMN (тот же паттерн, что migrate19/20)');
    assert(/TEXT DEFAULT NULL/.test(migrate21), 'тип TEXT (JSON-блоб, как dice_session/poker_session)');
    assert(/stalker_migrate21_2026/.test(migrate21), 'миграция защищена секретным ключом в URL');
}

console.log('\nTest 4: каталог blackjack_config.json совпадает построчно со старой клиентской логикой');
{
    assert(catalogJson.ranks.length === 8 && catalogJson.ranks[0] === 'семерка' && catalogJson.ranks[7] === 'туз',
        'ranks — те же 8 значений, что в старом клиентском RANKS');
    assert(JSON.stringify(catalogJson.premium_ranks) === JSON.stringify(['туз','король','дама']), 'premium_ranks совпадает со старым PREMIUM_RANKS');
    assert(catalogJson.premium_map['дама'] === 'qq' && catalogJson.premium_map['король'] === 'kk' && catalogJson.premium_map['туз'] === 'aa',
        'premium_map совпадает со старым PREMIUM_MAP');
    assert(JSON.stringify(catalogJson.premium_range.qq) === JSON.stringify([8000,12000])
        && JSON.stringify(catalogJson.premium_range.kk) === JSON.stringify([70000,90000])
        && JSON.stringify(catalogJson.premium_range.aa) === JSON.stringify([90000,110000]),
        'premium_range (пороги пити по ТЗ) совпадает 1-в-1 со старым PREMIUM_RANGE');
    assert(JSON.stringify(catalogJson.premium_order) === JSON.stringify([['qq','дама'],['kk','король'],['aa','туз']]),
        'premium_order (приоритет дамы→короли→тузы) совпадает со старым PREMIUM_ORDER');
    assert(JSON.stringify(catalogJson.swaps_by_level) === JSON.stringify([{min_level:60,swaps:2},{min_level:20,swaps:1},{min_level:0,swaps:0}]),
        'swaps_by_level совпадает со старой формулой lvl>=60?2:lvl>=20?1:0');
    assert(catalogJson.play_cost_coins === 1, 'цена платной партии — 1 рубль, как в старом клиенте');
    assert(catalogJson.payouts['туз'].cig === 10000 && catalogJson.payouts['туз'].shmot === true, 'выплата за тузов совпадает со старым PAYOUTS');
    // 26.09.2026 (по прямому указанию — "за 77/99 должен выдаваться опыт, а не авторитет"):
    // payouts.девятка/семерка переведены с resp на exp (1000/300) — см. blackjack.php.resolve().
    assert(catalogJson.payouts['девятка'].exp === 1000 && !catalogJson.payouts['девятка'].shmot, 'выплата за девятки (опыт, без шмотки) совпадает с текущим PAYOUTS');
    assert(catalogJson.payouts['семерка'].exp === 300 && !catalogJson.payouts['семерка'].shmot, 'выплата за семерки (опыт, без шмотки) совпадает с текущим PAYOUTS');
    assert(catalogJson.consolation_cig === 30, 'утешительный приз (нет пары) — 30 сигарет, как в старом клиенте');
}

console.log('\nTest 5: blackjack.php.deal() — бесплатная попытка/списание рубля, честный весовой pity, гарантированная пара');
{
    const start = bjPhp.indexOf('function deal(){');
    const end   = bjPhp.indexOf('\n        }', bjPhp.indexOf('$this->ops->ok', start));
    const body  = bjPhp.slice(start, end);

    // 24.09.2026: логика сброса переехала в общий хелпер _dailyState() (используется и
    // status(), и deal()) — сама проверка по дате внутри сессии не изменилась, просто вынесена.
    assert(/\$dailyState = \$this->_dailyState\(\$session\);/.test(body), 'дневной сброс бесплатной попытки идёт через _dailyState() (дата внутри сессии, не client-writable флаг)');
    assert(/\(\$session\['dailyDate'\] \?\? null\) !== \$today/.test(bjPhp), '_dailyState() (общий хелпер) по-прежнему сравнивает dailyDate внутри сессии с сегодняшней датой');
    assert(/deduct\(\$user, 'coins', \$cost\)/.test(body), 'при платной партии списывает ровно play_cost_coins через Gameops::deduct (не может уйти в минус)');
    assert(/return \$this->ops->fail\(84\)/.test(body), 'недостаточно рублей → код 84');
    assert(/foreach\(\$catalog\['premium_order'\] as \$row\)/.test(body), 'форсированный ранг определяется по premium_order из каталога, не хардкод');
    // 23.09.2026: добавлен &$trace параметр (собирает attempt-by-attempt лог для debug-ответа) —
    // сигнатура вызова расширилась третьим аргументом, сама честная раздача не изменилась.
    assert(/_dealRealPair\(\$catalog, \$forcedRank, \$dealTrace\)/.test(body), 'раздаёт честную пару под forcedRank через сервер, не принимает от клиента');
    // 24.09.2026: добавлен JSON_UNESCAPED_UNICODE (баг с кириллицей рангов, см.
    // poker-blackjack-session-unescaped-unicode-cyrillic-ranks.test.js) — сама запись не изменилась.
    assert(/\$user\['blackjack_session'\] = json_encode\(\$session, JSON_UNESCAPED_UNICODE\)/.test(body), 'сохраняет активную раздачу и pity-счётчики в blackjack_session');
}

console.log('\nTest 6: blackjack.php._dealRealPair() — премиум-пара структурно невозможна без forcedRank, гарантирована с ним');
{
    const start = bjPhp.indexOf('private function _dealRealPair(');
    const end   = bjPhp.indexOf('\n        }', start);
    const body  = bjPhp.slice(start, end);
    assert(/\$first\s*=\s*\$forcedRank \?: \$this->_pickRank\(\$RANKS\);/.test(body), 'первая карта — forcedRank, если задан, иначе честный случайный ранг');
    // 23.09.2026: условие теперь сохраняется в $rejected для trace-лога перед continue —
    // логика (без forcedRank совпадение по премиум-рангу отбраковывается) не изменилась.
    assert(/\$rejected\s*=\s*\(!\$forcedRank && \$rank === \$first && in_array\(\$rank, \$PREMIUM, true\)\);/.test(body) && /if\(\$rejected\) continue;/.test(body),
        'без forcedRank — случайное совпадение по премиум-рангу явно исключается (обычные пары остаются честным шансом)');
}

console.log('\nTest 7: blackjack.php.swap() — честная замена только слотов 2/3, лимит смен и запрет самофарма премиум-пары проверяются сервером');
{
    const start = bjPhp.indexOf('function swap(){');
    const end   = bjPhp.indexOf('\n        }', bjPhp.indexOf('$this->ops->ok', start));
    const body  = bjPhp.slice(start, end);

    assert(/if\(\$idx !== 2 && \$idx !== 3\) return \$this->ops->fail\(54\);/.test(body), 'принимает замену только для слотов 2/3 (единственные, что формируют пару)');
    assert(/if\(!is_array\(\$active\)\) return \$this->ops->fail\(85\);/.test(body), 'нет активной раздачи → код 85 (нельзя менять карту без deal())');
    assert(/intval\(\$active\['swapsUsed'\]\) >= intval\(\$active\['swapsAllowed'\]\)/.test(body), 'проверяет реально израсходованные смены по серверной сессии, не по данным клиента');
    assert(/return \$this->ops->fail\(86\);/.test(body), 'смены закончились → код 86');
    // 23.09.2026: те же условия теперь сохраняются в $rejectOld/$rejectMatch для trace-лога
    // перед continue — сами гарантии не изменились (см. bj-swap-rank-only-no-suits.test.js).
    assert(/\$rejectOld\s*=\s*\(\$rank === \$oldRank\);/.test(body) && /if\(\$rejectOld\) continue;/.test(body),
        'новый ранг гарантированно отличается от старого в этом же слоте');
    assert(/\$rejectMatch\s*=\s*\(\$rank === \$otherRank && in_array\(\$rank, \$PREMIUM, true\) && \$rank !== \$forcedRank\);/.test(body) && /if\(\$rejectMatch\) continue;/.test(body),
        'нельзя случайно СОБРАТЬ чужую (не выбитую) премиум-пару сменой — защита от самофарма AA/KK/QQ сохранена');
}

console.log('\nTest 8: blackjack.php.resolve() — награда по РЕАЛЬНОЙ финальной паре, pity считается использованным по факту РАЗДАЧИ');
{
    const start = bjPhp.indexOf('function resolve(){');
    const end   = bjPhp.indexOf('\n        }', bjPhp.indexOf('$this->ops->ok', start));
    const body  = bjPhp.slice(start, end);

    assert(/if\(!is_array\(\$active\)\) return \$this->ops->fail\(85\);/.test(body), 'нет активной раздачи → код 85 (нельзя завершить партию без deal())');
    assert(/\$bestRank\s*=\s*\(\$hand\[0\] === \$hand\[1\]\) \? \$hand\[0\] : null;/.test(body), 'оценивает ИТОГОВУЮ пару из session (после всех swap), не изначальный forcedRank');
    assert(/if\(\$forcedKey\)\{\s*\n\s*\$session\[\$forcedKey\] = 0;/.test(body),
        'если порог был выбит — сбрасывается по факту РАЗДАЧИ, даже если игрок сам сломал пару сменой и не получил награду');
    assert(/foreach\(\$catalog\['premium_map'\] as \$rank => \$key\)\{\s*\n\s*\$session\[\$key\] = intval\(\$session\[\$key\] \?\? 0\) \+ 1;/.test(body),
        'если ни один порог не был выбит — накапливаются счётчики всех трёх комбинаций сразу');
    assert(/\$session\['active'\] = null;/.test(body), 'помечает раздачу завершённой — повторный resolve той же раздачи невозможен');
    // 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов): шмот блэкджека НЕ
    // выбирается случайно из пула через grantShmotFromSource($user,'blackjack') — у каждого
    // premium-ранга (AA/KK/QQ) есть СВОЙ конкретный предмет в blackjack_config.json
    // (premium_shmot: {"туз":67,"король":89,"дама":68}), и выдаётся именно он, через
    // grantShmotById(). grantShmotFromSource() специально документирована в gameops.php как
    // "для случайного пула без привязки к рангу" — для AA/KK/QQ там же прямо написан
    // противоположный случай: "грантShmotById() ... нужен там, где награда привязана к
    // комбинации (AA/KK/QQ), а не должна выбираться случайно из пула источника". Независимое
    // подтверждение того же дизайна — casino-loot-policy.test.js: "AA/KK/QQ привязаны к
    // предметам Картёжника" / "Карты выдают конкретный предмет на сервере".
    assert(/\$shmotId = \$catalog\['premium_shmot'\]\[\$bestRank\] \?\? null;/.test(body),
        'id предмета берётся по КОНКРЕТНОМУ рангу из premium_shmot (не случайный пул)');
    assert(/\$shmotGranted = \$shmotId === null \? null : \$this->ops->grantShmotById\(\$user, \$shmotId\);/.test(body),
        'шмот выдаётся сервером через grantShmotById — конкретный предмет, привязанный к выбитому рангу');
}

console.log('\nTest 9: клиент dvor-blackjack.js — deal/swap/resolve асинхронные, зовут сервер, RNG и pity удалены');
{
    assert(bjSrc.includes("import { applyPatch } from '../../modules/patch.js';"), 'импортирует applyPatch');
    assert(!/PREMIUM_RANGE/.test(bjSrc), 'PREMIUM_RANGE (пороги пити) удалён из клиента целиком — переехал в blackjack_config.json');
    assert(!/PREMIUM_MAP/.test(bjSrc), 'PREMIUM_MAP удалён из клиента целиком');
    assert(!/PREMIUM_ORDER/.test(bjSrc), 'PREMIUM_ORDER удалён из клиента целиком');
    assert(!/function dealRealPair/.test(bjSrc), 'dealRealPair() (честная раздача премиум-пары) удалена из клиента — теперь только на сервере');
    assert(!/this\._bjForcedRank/.test(bjSrc), 'клиент больше не хранит/использует forcedRank локально (сервер держит его внутри сессии)');

    assert(/TS\.php\('blackjack\.deal', \{\}/.test(bjSrc), '_playBlackjack шлёт запрос на сервер без параметров');
    assert(/TS\.php\('blackjack\.swap', \{idx: idx\}/.test(bjSrc), '_swapBlackjackCard шлёт idx на сервер');
    assert(/TS\.php\('blackjack\.resolve', \{\}/.test(bjSrc), '_resolveBlackjack зовёт сервер без параметров');

    assert(/applyPatch\(res\.patch\)/.test(bjSrc), 'применяет патч сервера');
    assert(/const \[rank2, rank3\] = res\.hand;/.test(bjSrc), 'реальная пара (слоты 2/3) берётся из ответа сервера, а не генерируется на клиенте');
    // 25.09.2026 (регресс найден повторным прогоном тестов): формула изменена на
    // swapsAllowed-swapsUsed — если deal() вернул уже АКТИВНУЮ (восстановленную) раздачу,
    // swapsUsed может быть >0, см. dvor-session-resume-poker-dice-blackjack.test.js.
    assert(/this\._bjSwapsLeft = Math\.max\(0, \(parseInt\(res\.swapsAllowed,10\)\|\|0\) - \(parseInt\(res\.swapsUsed,10\)\|\|0\)\);/.test(bjSrc), 'лимит смен = swapsAllowed - swapsUsed (учитывает восстановленную раздачу)');
    assert(/Array\.isArray\(res\.hand\) && res\.hand\.length === 2/.test(bjSrc) &&
        /this\._bjHand\[realIdx\] = \{rank: rank, suit: null\};/.test(bjSrc),
        'после замены обе реальные карты синхронизируются из полной серверной руки');
    assert(/this\._bjSwapsLeft = res\.swapsLeft;/.test(bjSrc), 'остаток смен после swap синхронизируется с сервером');
}

console.log('\nTest 10: декоративные карты (слоты 0/1) остаются клиентскими — RNG без экономики переносить не требовалось');
{
    assert(/function dealDecorative\(exclude\)/.test(bjSrc), 'dealDecorative() сохранена на клиенте (декоративные карты ни на что не влияют)');
    assert(/const card0 = dealDecorative\(\[card2, card3\]\);/.test(bjSrc), 'декоративная карта 0 по-прежнему генерируется локально после раздачи от сервера');
}

console.log('\nTest 11: ошибки сервера (fail-коды 84-86) обрабатываются на клиенте адресными сообщениями');
{
    assert(/err && err\.code === 84/.test(bjSrc), 'код 84 (недостаточно рублей) обрабатывается отдельно при раздаче');
    assert(/err && err\.code === 86/.test(bjSrc), 'код 86 (смены закончились) обрабатывается на клиенте при swap');
}

console.log('\nTest 12: dvor_games — общий счётчик партий "Двора" инкрементируется сервером и в покере, и в блэкджеке (как у Зариков)');
{
    assert(/\$user\['dvor_games'\] = \$this->ops->i\(\$user, 'dvor_games'\) \+ 1;/.test(bjPhp), 'blackjack.php.resolve() инкрементирует dvor_games (раньше это делал клиентский _give())');
    const pokerPhp = readSrc('server/core/controllers/poker.php');
    assert(/\$user\['dvor_games'\] = \$this->ops->i\(\$user, 'dvor_games'\) \+ 1;/.test(pokerPhp), 'poker.php.resolve() тоже инкрементирует dvor_games (согласованность с dice.php/blackjack.php)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
