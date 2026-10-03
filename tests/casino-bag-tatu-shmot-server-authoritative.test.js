/**
 * Test: 25.09.2026 (по прямому указанию — "шмотки-награды из казино не доходят до игрока") —
 * дроп тату (шмотки) из открытия покерной "сумки" (poker.openBag) и кейса рулетки
 * (roulette.openCase) решался и СОХРАНЯЛСЯ на клиенте: dvor._give('shmot', 1) →
 * shmot.giveRandom() → users.save({shmot: ...}). Сервер (users.php._sanitizeShmot()) молча
 * отклонял такую запись (users.save не может сам выставить owned=true — это и есть защита от
 * читерства, см. "попытка эскалации owned/upg/qty через users.save" в error_log) — приз
 * физически никогда не доходил до игрока.
 *
 * Основные шмотки-награды казино (покер — рояль-флеш в resolve(), зарики — комбинация 4×6 в
 * resolve()) уже были переведены на Gameops::grantShmotFromSource() в прошлой сессии (см.
 * tests/poker-server-authoritative.test.js Test 7) — этот тест НЕ про них. Единственные
 * оставшиеся клиентские точки выдачи шмотки для покера/зариков/рулетки — дроп тату из
 * сумки/кейса (был захардкожен выключенным на клиенте, "Бета: выпадение тату отключено", так
 * что реального бага прямо сейчас не было — уязвимый код был просто недостижим) и мёртвая
 * ветка cr.type==='shmot' в старой авто-бот панели зариков (dvor-dice.js._playDice, сервер
 * никогда не шлёт type:'shmot' в clientRewards).
 *
 * Фикс: решение (роллится ли тату) и сама выдача переехали на сервер (poker.php.openBag(),
 * roulette.php.openCase()) — тот же паттерн Gameops::grantShmotFromSource(), что уже
 * применяется у боссов (bosses.php.claimKill()). Шанс дропа оставлен 0 (по прямому указанию —
 * фича по-прежнему выключена в бете, менять только архитектуру выдачи, не включать дроп) —
 * это безопасная no-op константа, поднять шанс потом можно одной строкой.
 *
 * Run: node tests/casino-bag-tatu-shmot-server-authoritative.test.js
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

const pokerPhp      = readSrc('server/core/controllers/poker.php');
const roulettePhp   = readSrc('server/core/controllers/roulette.php');
const pokerBagJs    = readSrc('_client/src/game/dvor/dvor-poker-bag.js');
const rouletteBuyJs = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');
const diceJs        = readSrc('_client/src/game/dvor/dvor-dice.js');

console.log('\nTest 1: poker.php.openBag() — тату решает и выдаёт сервер через grantShmotFromSource, не клиент');
{
    const start = pokerPhp.indexOf('function openBag(){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf('$this->ops->ok(', start));
    assert(start !== -1, 'метод openBag() существует');
    const body = pokerPhp.slice(start, end);

    assert(/\$tatuItemId = \(mt_rand\(1, 100\) <= \$tatuChancePct\) \? \$this->ops->grantShmotFromSource\(\$user, 'poker'\) : null;/.test(body),
        'ролл и выдача тату целиком на сервере через Gameops::grantShmotFromSource(\'poker\')');
    assert(/\$hasTatu = \$tatuItemId !== null;/.test(body), 'hasTatu вычисляется из реального результата выдачи, а не просто из ролла (пустой пул источника не считается выигрышем)');
    assert(/\$tatuChancePct = 0;/.test(body), 'шанс дропа тату оставлен 0 — фича по-прежнему выключена в бете, поменялась только архитектура выдачи');
    assert(/grantShmotFromSource\(\$user, 'poker'\)/.test(body) && body.indexOf('saveUser') > body.indexOf('grantShmotFromSource'),
        'выдача тату происходит ДО saveUser() — попадает в ту же атомарную запись, что и остальная награда сумки');
    assert(/patchCurrencies\(\$user, \[[^)]*'shmot'/.test(body), 'patch включает поле shmot — клиент увидит новую вещь через applyPatch(), не только валюту');
    assert(/\$this->ops->ok\(\['patch' => \$patch, 'reward' => \$reward, 'hasTatu' => \$hasTatu,/.test(body), 'ответ содержит hasTatu — клиент больше не решает это сам');
}

console.log('\nTest 2: roulette.php.openCase() — тату решает и выдаёт сервер через grantShmotFromSource, не клиент');
{
    const start = roulettePhp.indexOf('function openCase(){');
    const end   = roulettePhp.indexOf('\n    }', roulettePhp.indexOf('$this->ops->ok(', start));
    assert(start !== -1, 'метод openCase() существует');
    const body = roulettePhp.slice(start, end);

    assert(/\$tatuItemId = \(mt_rand\(1, 100\) <= \$tatuChancePct\) \? \$this->ops->grantShmotFromSource\(\$user, 'roulette'\) : null;/.test(body),
        'ролл и выдача тату целиком на сервере через Gameops::grantShmotFromSource(\'roulette\')');
    assert(/\$hasTatu = \$tatuItemId !== null;/.test(body), 'hasTatu вычисляется из реального результата выдачи');
    assert(/\$tatuChancePct = 0;/.test(body), 'шанс дропа тату оставлен 0 — фича по-прежнему выключена в бете');
    assert(/grantShmotFromSource\(\$user, 'roulette'\)/.test(body) && body.indexOf('saveUser') > body.indexOf('grantShmotFromSource'),
        'выдача тату происходит ДО saveUser()');
    assert(/patchCurrencies\(\$user, \[[^)]*'shmot'/.test(body), 'patch включает поле shmot');
    assert(/\$this->ops->ok\(\['patch' => \$patch, 'reward' => \$reward, 'hasTatu' => \$hasTatu,/.test(body), 'ответ содержит hasTatu');
}

console.log('\nTest 3: dvor-poker-bag.js — hasTatu берётся из ответа сервера, клиент больше не пишет шмотку сам');
{
    assert(!/this\._give\(['"]shmot['"]/.test(pokerBagJs), 'this._give(\'shmot\', ...) удалён целиком — больше нет client-writable записи владения шмоткой');
    assert(!/const hasTatu = false;/.test(pokerBagJs), 'клиентский хардкод hasTatu удалён — решение теперь только у сервера');
    assert(/this\._openPokerBagOpenedScreen\(res\.reward, res\.clientRewards \|\| \[\], !!res\.hasTatu\);/.test(pokerBagJs),
        'hasTatu прокидывается из ответа сервера (res.hasTatu) в экран результата');
    assert(/proto\._openPokerBagOpenedScreen = function\(reward, clientRewards, hasTatu\)\{/.test(pokerBagJs),
        '_openPokerBagOpenedScreen принимает hasTatu параметром, а не вычисляет сам');
    assert(/if\(res\.patch\.shmot !== undefined && window\.shmot && typeof shmot\._loadFromUdata === 'function'\)\{\s*shmot\._loadFromUdata\(\);/.test(pokerBagJs),
        'после applyPatch клиент перечитывает shmot из udata (тот же паттерн, что dvor-blackjack.js/dvor-poker-game.js/dvor-dice.js)');
}

console.log('\nTest 4: dvor-roulette-buy.js — hasTatu берётся из ответа сервера, клиент больше не пишет шмотку сам');
{
    assert(!/this\._give\(['"]shmot['"]/.test(rouletteBuyJs), 'this._give(\'shmot\', ...) удалён целиком');
    assert(!/const hasTatu = false;/.test(rouletteBuyJs), 'клиентский хардкод hasTatu удалён');
    assert(/this\._openRouletteCaseOpenedScreen\(!!res\.hasTatu, res\.reward, res\.clientRewards \|\| \[\]\);/.test(rouletteBuyJs),
        'hasTatu прокидывается из ответа сервера (res.hasTatu) в экран результата');
    assert(/if\(res\.patch\.shmot !== undefined && window\.shmot && typeof shmot\._loadFromUdata === 'function'\)\{\s*shmot\._loadFromUdata\(\);/.test(rouletteBuyJs),
        'после applyPatch клиент перечитывает shmot из udata');
}

console.log('\nTest 5: dvor-dice.js — мёртвая ветка cr.type===\'shmot\' → shmot.giveRandom() убрана из старой авто-бот панели');
{
    assert(!/cr\.type === ['"]shmot['"]/.test(diceJs), "ветка cr.type==='shmot' удалена — dice.php никогда не шлёт type:'shmot' в clientRewards (шмотка уже выдана сервером внутри applyCurrency())");
    assert(!/shmot\.giveRandom\(cr\.amt\)/.test(diceJs), 'shmot.giveRandom(cr.amt) по подсказке сервера удалён из dvor-dice.js');
}

console.log('\nTest 6: у покера/зариков основная шмотка-награда (не тату) уже была server-authoritative до этой правки — не регрессировало');
{
    assert(/\$shmotGranted = null;\s*\n\s*if\(\$c\['type'\] === 'shmot'\) \$shmotGranted = \$this->ops->grantShmotFromSource\(\$user, 'poker'\);/.test(pokerPhp),
        'poker.php.resolve() по-прежнему выдаёт royal_flush шмотку через grantShmotFromSource (не задето правкой openBag())');
    assert(/case 'shmot':\s*\n\s*for\(\$i = 0; \$i < \$amt; \$i\+\+\)\{\s*\n\s*\$id = \$this->ops->grantShmotFromSource\(\$user, 'dice'\);/.test(readSrc('server/core/controllers/dice.php')),
        'dice.php.resolve() по-прежнему выдаёт шмотку через grantShmotFromSource (не задето правкой)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
