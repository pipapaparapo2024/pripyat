/**
 * Test: 22.09.2026 (обнаружено при добавлении попапа подтверждения стоимости, см.
 * dvor-poker-bag.js._reallyOpenPokerBag / dvor-roulette-buy.js._reallyOpen внутри
 * _openRouletteCaseScreen) — списание 150 roulette_spichki при открытии покерной "сумки" и
 * кейса рулетки шло ЦЕЛИКОМ на клиенте: udata['roulette_spichki'] = (have - cost).toString(),
 * без единого запроса к серверу. Тот же класс дыры, что уже закрыт для оружия/шмоток/хаты
 * (см. hata.php.buy(), Правило №9 CLAUDE.md) — игрок мог вызвать эту логику из консоли
 * браузера с произвольным cost или пропустить списание вовсе.
 *
 * Фикс: новые server-authoritative методы poker.openBag() и roulette.openCase()
 * (server/core/controllers/poker.php, server/core/controllers/roulette.php) по стандартному
 * паттерну Gameops (образец — hata.php.buy()) — сервер сам проверяет баланс и списывает
 * roulette_spichki, возвращает patch; клиент вызывает их вместо прямой мутации udata.
 * Сама выдача наград (exp/сигареты/заначка/монеты, this._give(...)) по-прежнему считается
 * на клиенте — не в фокусе этого шага (тот же уровень риска, что и уровень покера).
 *
 * Run: node tests/roulette-poker-spichki-open-server-authoritative.test.js
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

console.log('\nTest 1: poker.php — permits содержит openBag, метод списывает roulette_spichki через Gameops::deduct');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): 'getSession' добавлен — точка
    // восстановления раздачи после перезагрузки/смены вкладки, см.
    // dvor-session-resume-poker-dice-blackjack.test.js.
    assert(/\$this->permits = \['deal', 'swap', 'resolve', 'openBag', 'getSession'\];/.test(pokerPhp), "permits содержит 'openBag'");
    const start = pokerPhp.indexOf('function openBag(){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf('$this->ops->ok(', start));
    assert(start !== -1, 'метод openBag() существует');
    const body = pokerPhp.slice(start, end);
    assert(/\$cost = 150;/.test(body), 'цена совпадает с клиентской (150 голубых спичек)');
    // 27.09.2026 (устаревший тест, найдено полным прогоном): openBag() списывал ЧУЖУЮ валюту
    // roulette_spichki (спички рулетки) вместо poker_spichki (спички покера) — реальный баг,
    // исправлено, см. поле-специфичный tests/poker-bag-currency-matches-poker-spichki.test.js.
    assert(/if\(!\$this->ops->deduct\(\$user, 'poker_spichki', \$cost\)\) return \$this->ops->fail\(50\);/.test(body),
        'списание идёт через Gameops::deduct (проверяет баланс, отклоняет при нехватке — код 50, тот же, что и у hata.php)');
    assert(/\$this->ops->saveUser\(\$user\)/.test(body), 'изменение сохраняется на сервере');
    // 23.09.2026: patchCurrencies() расширен доп. полями (exp/cigarettes/stash_count/coins/
    // coins_earned) — та же сумка/кейс теперь ещё и начисляет награду на сервере (см.
    // tests/roulette-case-poker-bag-server-reward.test.js), валюта сумки по-прежнему
    // первый ключ в списке.
    assert(/patchCurrencies\(\$user, \['poker_spichki', /.test(body), 'возвращает patch с новым балансом poker_spichki (и остальных полей награды)');
}

console.log('\nTest 2: roulette.php — permits содержит openCase, метод списывает roulette_spichki через Gameops::deduct');
{
    // 24.09.2026: добавлен permit 'claimPrize' (несвязанной правкой) — расширение списка, не регресс.
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): 'buyPoints' добавлен 26.09.2026
    // (по прямому указанию — аудит "покупка поинтов зариков/рулетки за рубли напрямую вызывает
    // users.save") — тест не обновили, не регресс.
    // 29.09.2026: 'claimKeyring' удалён из permits (был эксплойтом — вызываемым напрямую из
    // консоли без реального выигрыша сектора, см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo)).
    assert(/\$this->permits = \['status', 'spin', 'claimPrize', 'openMinigame', 'pickCup', 'openCase', 'buyPoints'\];/.test(roulettePhp), "permits содержит 'openCase'");
    const start = roulettePhp.indexOf('function openCase(){');
    const end   = roulettePhp.indexOf('\n    }', roulettePhp.indexOf('$this->ops->ok(', start));
    assert(start !== -1, 'метод openCase() существует');
    const body = roulettePhp.slice(start, end);
    assert(/\$cost = 150;/.test(body), 'цена совпадает с клиентской (150 голубых спичек), та же, что у poker.openBag()');
    assert(/if\(!\$this->ops->deduct\(\$user, 'roulette_spichki', \$cost\)\) return \$this->ops->fail\(50\);/.test(body),
        'списание идёт через Gameops::deduct (проверяет баланс, отклоняет при нехватке — код 50)');
    assert(/\$this->ops->saveUser\(\$user\)/.test(body), 'изменение сохраняется на сервере');
    // 23.09.2026: patchCurrencies() расширен доп. полями (exp/cigarettes/stash_count/coins/
    // coins_earned) — та же сумка/кейс теперь ещё и начисляет награду на сервере (см.
    // tests/roulette-case-poker-bag-server-reward.test.js), roulette_spichki по-прежнему
    // первый ключ в списке.
    assert(/patchCurrencies\(\$user, \['roulette_spichki', /.test(body), 'возвращает patch с новым балансом roulette_spichki (и остальных полей награды)');
}

console.log('\nTest 3: dvor-poker-bag.js — _reallyOpenPokerBag больше не мутирует udata напрямую, вызывает poker.openBag через TS.php');
{
    assert(!/udata\['roulette_spichki'\] = \(have - cost\)\.toString\(\);/.test(pokerBagJs),
        'старая client-side мутация udata убрана из dvor-poker-bag.js');
    const start = pokerBagJs.indexOf('proto._reallyOpenPokerBag = function');
    const end   = pokerBagJs.indexOf('\n    };', pokerBagJs.indexOf('});', start));
    assert(start !== -1, '_reallyOpenPokerBag найден');
    const body = pokerBagJs.slice(start, end);
    assert(/TS\.php\('poker\.openBag', \{\}, \(res\) => \{/.test(body), 'вызывает poker.openBag с нормальным success-callback');
    assert(/applyPatch\(res\.patch\);/.test(body), 'применяет patch только после подтверждения сервера');
    assert(/err && err\.code === 50/.test(body), 'обрабатывает код 50 (недостаточно спичек) адресным сообщением');
    assert(/this\._pokerBagReqInFlight/.test(body), 'защита от повторного клика во время запроса (in-flight guard)');
}

console.log('\nTest 4: dvor-poker-bag.js — импортирует applyPatch');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/.test(pokerBagJs),
        'путь импорта корректный относительно game/dvor/');
}

console.log('\nTest 5: dvor-roulette-buy.js — _reallyOpen больше не мутирует udata напрямую, вызывает roulette.openCase через TS.php');
{
    assert(!/udata\['roulette_spichki'\] = \(have - cost\)\.toString\(\);/.test(rouletteBuyJs),
        'старая client-side мутация udata убрана из dvor-roulette-buy.js');
    const start = rouletteBuyJs.indexOf('const _reallyOpen = () => {');
    const end   = rouletteBuyJs.indexOf('\n            };', start);
    assert(start !== -1, '_reallyOpen найден');
    const body = rouletteBuyJs.slice(start, end);
    assert(/TS\.php\('roulette\.openCase', \{\}, \(res\) => \{/.test(body), 'вызывает roulette.openCase с нормальным success-callback');
    assert(/applyPatch\(res\.patch\);/.test(body), 'применяет patch только после подтверждения сервера');
    assert(/err && err\.code === 50/.test(body), 'обрабатывает код 50 (недостаточно спичек) адресным сообщением');
    assert(/this\._roulCaseReqInFlight/.test(body), 'защита от повторного клика во время запроса (in-flight guard)');
}

console.log('\nTest 6: dvor-roulette-buy.js — импортирует applyPatch');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/.test(rouletteBuyJs),
        'путь импорта корректный относительно game/dvor/');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
