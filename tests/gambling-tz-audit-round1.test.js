/**
 * Test: первый раунд правок азартных игр по ТЗ (карты/покер/шмотки).
 *
 * 1) shmot.giveRandom(n) — раньше вызывался (dvor.js `case 'shmot'`), но метода не
 *    существовало вовсе — награда одеждой молча проваливалась (покер рояль-флеш,
 *    зарики 4×6, карты AA/KK/QQ). Теперь метод есть и выдаёт n случайных ещё не
 *    купленных предметов.
 *
 * 2) Карты — баг "Короли прокают быстро и не дают награду": живая игра
 *    (dvor-blackjack.js) читала пити-пороги из this._data.blackjack (100-200/50-100/
 *    200-500 — в сотни раз меньше ТЗ), хотя в this._data.cards уже лежали ПРАВИЛЬНЫЕ
 *    пороги (70000-90000/8000-12000/90000-110000), просто на мёртвом коде. Теперь
 *    живая игра переключена на this._data.cards с верными диапазонами; отдельный
 *    неверный bucket `blackjack` в dvor.js убран целиком.
 *
 * 3) Покер — комбинация теперь выбирается весовой рулеткой (_pokerRoll, проценты
 *    строго из ТЗ: 0.10% рояль-флеш ... 85.43% старшая карта) вместо честной
 *    комбинаторной оценки реально розданных карт (которая физически не могла давать
 *    проценты из ТЗ). После выбора комбинации карты на экране ПЕРЕГЕНЕРИРУЮТСЯ так,
 *    чтобы реально соответствовать этой комбинации (_pokerGenerateHandForCombo) —
 *    самосогласованность с _evaluatePokerHand проверена отдельно эмпирически
 *    (5000 прогонов на комбинацию, 100% совпадение).
 *
 * Run: node tests/gambling-tz-audit-round1.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const shmotSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const dvorSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor.js'), 'utf-8');
const bjSrc    = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');
const pokerGameSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8');
const pokerPhpSrc  = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'poker.php'), 'utf-8');
const pokerConfig  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'json', 'poker_config.json'), 'utf-8'));
function rollUpto(key){ return pokerConfig.roll_table.find(r => r.key === key).upto; }

// 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов — редизайн вдогонку
// server-authoritative миграции 17-18.09.2026): client-side shmot.giveRandom(n), введённый
// этим самым раундом правок как временный фикс "награда одеждой молча проваливалась", сам стал
// дырой безопасности — клиент мог выставить себе owned=true локально и сохранить это через
// users.save(). Полностью убран; РЕАЛЬНАЯ выдача теперь только на сервере через
// grantShmotFromSource()/grantShmotById() (gameops.php) — см. blackjack-server-authoritative,
// poker.php/dice.php/roulette.php. Независимое подтверждение — casino-loot-policy.test.js
// "Клиент не способен случайно выдать одежду" (giveRandom(n){ и case 'shmot' в dvor.js оба
// отсутствуют).
console.log('\nTest 1: shmot.giveRandom(n) убран — выдача одежды теперь только server-authoritative');
{
    assert(!/giveRandom\(n\)\{/.test(shmotSrc), 'метод giveRandom(n) удалён из класса Shmot (клиент больше не может сам выдать себе одежду)');
    assert(!/case 'shmot':/.test(dvorSrc), 'ветка dvor.js case \'shmot\' (вызывавшая giveRandom) тоже убрана');
    const gameopsSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'models', 'gameops.php'), 'utf-8');
    assert(/function grantShmotFromSource\(&\$user, \$source\)\{/.test(gameopsSrc),
        'взамен — серверный grantShmotFromSource() (случайный пул по source)');
    assert(/function grantShmotById\(&\$user, \$id\)\{/.test(gameopsSrc),
        'и grantShmotById() (конкретный предмет, привязанный к рангу/достижению)');
}

console.log('\nTest 2: dvor.js — bucket blackjack с неверными порогами убран, cards — единственный источник AA/KK/QQ');
{
    assert(!/blackjack:\{ exp:0, qq:0, qq_t:0, kk:0, kk_t:0, aa:0, aa_t:0 \}/.test(dvorSrc), 'дефолтный blackjack-bucket с нулевыми порогами убран');
    assert(!/this\._data\.blackjack\.qq_t.*this\._rand\(50, 100\)/.test(dvorSrc), 'реseed blackjack.qq_t (50-100) убран');
    assert(!/this\._data\.blackjack\.kk_t.*this\._rand\(100, 200\)/.test(dvorSrc), 'реseed blackjack.kk_t (100-200) убран');
    assert(!/this\._data\.blackjack\.aa_t.*this\._rand\(200, 500\)/.test(dvorSrc), 'реseed blackjack.aa_t (200-500) убран');
    assert(/cards:\s*\{ exp:0, aa:0, aa_t:r\(90000,110000\), kk:0, kk_t:r\(70000,90000\), qq:0, qq_t:r\(8000,12000\) \}/.test(dvorSrc),
        'cards-bucket с верными порогами по ТЗ остаётся источником истины');
}

// 18.09.2026 (перенос Блэкджека на сервер, см. tests/blackjack-server-authoritative.test.js для
// полной проверки): pity-счётчики AA/KK/QQ переехали ЦЕЛИКОМ с this._data.cards (client-writable
// dvor_games_data — читер мог форсировать пару через users.save) на server-only
// blackjack_session (server/core/controllers/blackjack.php). this._data.cards на клиенте
// остаётся ТОЛЬКО источником exp/уровня (низкий риск, не сам pity) — раздел ТЗ про "верные
// диапазоны, не в сотни раз меньше" теперь актуален для premium_range в blackjack_config.json.
console.log('\nTest 3: блэкджек — pity-диапазоны AA/KK/QQ точно по ТЗ, теперь на сервере (не this._data.cards/blackjack)');
{
    const bjPhpSrc    = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
    const bjConfig    = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'json', 'blackjack_config.json'), 'utf-8'));

    assert(JSON.stringify(bjConfig.premium_range) === JSON.stringify({qq:[8000,12000], kk:[70000,90000], aa:[90000,110000]}),
        'диапазоны пити в blackjack_config.json — точно по ТЗ (было в сотни раз меньше в старом мёртвом bucket this._data.blackjack)');
    assert(!/this\._data\.blackjack\b/.test(bjSrc), 'клиент больше не читает из неверного this._data.blackjack (как и раньше)');
    // (упоминание this._data.cards.aa/kk/qq остаётся только в шапке-комментарии файла как
    // историческая справка про ДО-миграционное состояние — не в счёт, проверяем реальный код).
    assert(!/const bj = this\._data\.cards;/.test(bjSrc), 'клиент больше не читает pity-объект из this._data.cards вовсе — это теперь server-only blackjack_session');
    assert(/_loadSession\(\$user, \$catalog\)/.test(bjPhpSrc), 'сервер сам управляет pity через собственную сессию, не через client-writable dvor_games_data');
}

console.log('\nTest 4: dvor-blackjack.js — achievements/телеметрия чинятся заодно (gameType и combo id)');
{
    assert(/achievements\.onDvorGame\('cards', \{ combo: bestRank \? COMBO_CODE\[bestRank\] : null \}\)/.test(bjSrc),
        'onDvorGame теперь вызывается с типом "cards" (было "blackjack" — ветки для такого типа не существует) и реальным combo id');
}

// 18.09.2026 (перенос Покера на сервер, см. tests/poker-server-authoritative.test.js для полной
// проверки): весь RNG-контур из Test 5/6/7 ниже (_pokerRoll, _pokerGenerateHandForCombo,
// _evaluatePokerHand, честная замена карты) переехал ЦЕЛИКОМ в server/core/controllers/poker.php
// — читер мог напрямую подставить this._pokerHand и вызвать _resolvePokerNewScreen() из
// консоли, минуя весовые проценты ТЗ вообще. Проценты и вся комбинаторная логика теперь
// проверяются на СЕРВЕРНОЙ копии кода (server/json/poker_config.json + poker.php), клиент —
// только оркестрирует три запроса (deal/swap/resolve) и не содержит RNG вовсе.
console.log('\nTest 5: покер — комбинация выбирается весовой рулеткой (server/json/poker_config.json) с процентами из ТЗ');
{
    assert(rollUpto('royal_flush') === 0.10, '0.10% рояль-флеш (roll_table в poker_config.json)');
    assert(rollUpto('pair') === 14.57, 'кумулятивный порог перед high_card соответствует 10% на пару (14.57-4.57)');
    // Примечание: честная оценка руки (_evaluateHand) в resolve() СНОВА присутствует —
    // по прямому и более позднему указанию пользователя смена карт в покере честная
    // и может увести итог от изначально розданного по весам (см. Test 6/7 ниже).
}

console.log('\nTest 6: покер — раздача по-прежнему задаётся весовым броском (проценты по ТЗ), теперь на сервере');
{
    // 23.09.2026 (максимальное логирование, превентивно): _rollCombo()/_generateHandForCombo()
    // получили доп. параметры/возврат ($trace, [$hand,$attempt+1]) для debug-трассировки — сама
    // весовая логика розыгрыша/генерации не изменилась, только собирается лог по ходу.
    assert(/_rollCombo\(\$catalog, \$comboTrace\)/.test(pokerPhpSrc), 'deal() задаёт стартовую комбинацию весовым roll при раздаче');
    assert(/_generateHandForCombo\(\$catalog, \$targetCombo\)/.test(pokerPhpSrc), 'карты сразу раскладываются под эту комбинацию');
    assert(/private function _generateHandForCombo\(\$catalog, \$comboKey\)\{/.test(pokerPhpSrc), '_generateHandForCombo определён на сервере');
    assert(/if\(\$this->_evaluateHand\(\$catalog, \$hand\) === \$comboKey\) return \[\$hand, \$attempt \+ 1\];/.test(pokerPhpSrc),
        'генератор проверяет самосогласованность с реальным оценщиком руки перед тем как её вернуть');
    // По прямому указанию пользователя (реверс более раннего решения): в ПОКЕРЕ смена
    // карт — честная и случайная, и МОЖЕТ увести итог от изначально розданной по весам
    // комбинации. resolve() поэтому обязан пересчитывать итог по факту финальной руки.
    const resolveStart = pokerPhpSrc.indexOf('function resolve(){');
    const resolveEnd   = pokerPhpSrc.indexOf('\n        }', pokerPhpSrc.indexOf('$this->ops->ok', resolveStart));
    const resolveBody  = pokerPhpSrc.slice(resolveStart, resolveEnd);
    assert(/\$combo = \$this->_evaluateHand\(\$catalog, \$session\['hand'\]\);/.test(resolveBody),
        'resolve() честно пересчитывает комбинацию по финальной руке на столе (не по зафиксированному при раздаче target)');

    // Клиент больше НЕ содержит этого RNG вовсе — только просит сервер и применяет ответ.
    assert(!/proto\._pokerRoll\s*=/.test(pokerGameSrc), 'клиент не содержит _pokerRoll (удалён вместе со старой FLA-панелью)');
    assert(!/proto\._pokerGenerateHandForCombo\s*=/.test(pokerGameSrc), 'клиент не содержит _pokerGenerateHandForCombo');
    assert(!/proto\._evaluatePokerHand\s*=/.test(pokerGameSrc), 'клиент не содержит _evaluatePokerHand');
    assert(/this\._pokerHand\s*=\s*res\.hand;/.test(pokerGameSrc), 'рука приходит из ответа сервера (poker.deal)');
}

console.log('\nTest 7: покер — смена честная и случайная, меняет ТОЛЬКО выбранную карту, но МОЖЕТ поменять итог (теперь на сервере)');
{
    const swapStart = pokerPhpSrc.indexOf('function swap(){');
    const swapEnd   = pokerPhpSrc.indexOf('\n        }', pokerPhpSrc.indexOf('$this->ops->ok', swapStart));
    const swapBody  = pokerPhpSrc.slice(swapStart, swapEnd);
    assert(!/_generateHandForCombo/.test(swapBody),
        'не перегенерирует ВСЮ руку под комбинацию (визуально выглядело как смена всех 5 карт разом)');
    assert(/\$replacement = \$cand;\s*\n\s*break;/.test(swapBody),
        'берёт первую же случайную непротиворечивую замену — без проверки на сохранение target-комбинации');
    assert(!/targetCombo/.test(swapBody), 'не сверяется с зафиксированным при раздаче target — смена честная');
    assert(/\$session\['hand'\]\[\$idx\] = \$replacement;/.test(swapBody), 'меняет только выбранную карту (idx), не всю руку');

    // Клиент — простой прокси: индекс на сервер, карту из ответа в состояние.
    const clientSwapBody = pokerGameSrc.match(/proto\._togglePokerSwap = function\(idx\)\{([\s\S]*?)\n    \};/)[1];
    assert(/TS\.php\('poker\.swap', \{idx: idx\}/.test(clientSwapBody), 'клиент шлёт idx на сервер, не подбирает карту сам');
    assert(/this\._pokerHand\[idx\] = res\.card;/.test(clientSwapBody), 'клиент применяет карту из ответа сервера');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
