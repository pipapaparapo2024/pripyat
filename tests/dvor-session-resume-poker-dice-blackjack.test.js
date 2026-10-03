/**
 * Test: 25.09.2026, по прямому указанию — "во время игры в покер, в зарики и в любые другие
 * игры, я заметил, что когда у игрока есть выбор, если в этот момент открыть другую вкладку
 * или перезагрузить браузер, выбор сбрасывается, и его игра уничтожается... такого быть не
 * должно".
 *
 * Диагностика (см. server/core/controllers/{poker,dice,blackjack}.php): деньги/фишки/попытка
 * уже списывались СИНХРОННО в момент deal()/start() и раздача честно сохранялась в
 * poker_session/dice_session/blackjack_session на сервере — но (1) deal()/start() никогда не
 * проверяли, что раздача УЖЕ активна, перед тем как перезаписать её новой (повторное списание +
 * потеря старой раздачи без результата), и (2) клиент держал состояние раздачи ТОЛЬКО в
 * обычных JS-полях объекта Dvor (this._pokerState/_diceState/_bjPlaying) — они не переживают
 * пересоздание объекта (перезагрузка страницы, новая вкладка), и клиент никогда не читал
 * poker_session/dice_session/blackjack_session обратно, чтобы восстановить экран.
 *
 * Фикс — тот же паттерн, что уже применён для bosses.php.startFight() (идемпотентность):
 *  1) deal()/start() проверяют существующую активную сессию ДО списания — если она уже есть,
 *     просто возвращают её же (patch без изменений, hand/rolls из сессии), ничего не списывая
 *     и не перегенерируя.
 *  2) Новый метод getSession() (poker/dice) / расширенный status() (blackjack, уже вызывается
 *     при каждом открытии экрана) — без побочных эффектов, отдаёт активную раздачу клиенту.
 *  3) Клиент при первом открытии экрана за загрузку страницы вызывает getSession/использует
 *     status() и, если раздача активна, полностью восстанавливает визуальное состояние (карты/
 *     кости, остаток смен) — без анимации (она чисто косметическая).
 *
 * Run: node tests/dvor-session-resume-poker-dice-blackjack.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const pokerPhp     = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'poker.php'), 'utf-8');
const dicePhp      = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');
const blackjackPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
const pokerJs      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker.js'), 'utf-8');
const pokerGameJs  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8');
const diceJs       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice.js'), 'utf-8');
const diceGameJs   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');
const bjJs         = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');

console.log('\n=== ПОКЕР ===');

console.log('\nTest 1: poker.php — getSession() зарегистрирован в permits и не имеет побочных эффектов');
{
    assert(/\$this->permits = \['deal', 'swap', 'resolve', 'openBag', 'getSession'\];/.test(pokerPhp), "'getSession' добавлен в permits");
    const start = pokerPhp.indexOf('function getSession(){');
    assert(start !== -1, 'метод getSession() существует');
    const end = pokerPhp.indexOf('\n        }', start);
    const body = pokerPhp.slice(start, end);
    assert(!/saveUser|deduct\(|json_encode\(\$session/.test(body), 'getSession() не сохраняет/списывает — чисто читает состояние');
    assert(/empty\(\$session\['active'\]\)\)\{[\s\S]*?'active' => false/.test(body), 'если раздачи нет — active:false');
    assert(/'active' => true,[\s\S]*?'hand' => \$session\['hand'\]/.test(body), 'если раздача активна — возвращает hand/swapsUsed/swapsAllowed');
}

console.log('\nTest 2: poker.php.deal() — идемпотентен: активная раздача не перезаписывается новой');
{
    const start = pokerPhp.indexOf('function deal(){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf('$catalog = $this->_catalog();', start));
    const body  = pokerPhp.slice(start, end);
    assert(/\$existingSession = \$this->_loadSession\(\$user\);/.test(body), 'deal() перечитывает текущую сессию до списания/раздачи');
    assert(/if\(is_array\(\$existingSession\) && !empty\(\$existingSession\['active'\]\)\)\{/.test(body), 'проверяет active ДО списания валюты');
    assert(/'resumed' => true,/.test(body), 'возвращает флаг resumed:true при восстановлении вместо новой раздачи');
    // Идемпотентная ветка должна вернуться (return;) ДО первого deduct() — иначе решение выше косметическое.
    const idemIdx   = body.indexOf('$existingSession = $this->_loadSession($user);');
    const deductIdx = body.indexOf('deduct($user,');
    assert(idemIdx !== -1 && deductIdx !== -1 && idemIdx < deductIdx, 'проверка активной сессии стоит РАНЬШЕ первого списания валюты');
}

console.log('\nTest 3: dvor-poker.js — при первом открытии экрана запрашивает getSession, если раздача не отслежена локально');
{
    assert(/if\(!this\._pokerSessionChecked\)\{/.test(pokerJs), 'проверяется один раз за загрузку страницы (флаг _pokerSessionChecked)');
    assert(/this\._pokerRestoreSession\(\);/.test(pokerJs), '_openPokerScreen вызывает _pokerRestoreSession()');
}

console.log('\nTest 4: dvor-poker-game.js — _pokerRestoreSession полностью восстанавливает UI без анимации тасовки');
{
    const start = pokerGameJs.indexOf('proto._pokerRestoreSession = function(){');
    assert(start !== -1, '_pokerRestoreSession определён');
    const end = pokerGameJs.indexOf('\n    };', start);
    const body = pokerGameJs.slice(start, end);
    assert(/TS\.php\('poker\.getSession', \{\}/.test(body), 'зовёт poker.getSession');
    assert(/this\._pokerHand\s*=\s*res\.hand;/.test(body), 'восстанавливает руку из ответа');
    assert(/this\._pokerState\s*=\s*1;/.test(body), 'выставляет state=1 (раздача идёт)');
    assert(/this\._pokerUpdateCards\(\);/.test(body), 'перерисовывает карты сразу (без тасовки)');
    assert(!/_runPokerShuffleAnimation/.test(body), 'НЕ запускает косметическую анимацию тасовки при восстановлении');
}

console.log('\n=== ЗАРИКИ ===');

console.log('\nTest 5: dice.php — getSession() зарегистрирован в permits и не имеет побочных эффектов');
{
    // 27.09.2026 (плановая чистка тестов): изначально (25.09.2026) permits оканчивался на
    // 'getSession'. Позже (см. dice-roulette-buy-points-server-authoritative.test.js) добавлен
    // отдельный, не связанный с этим фиксом permit 'buyPoints' (покупка dice_points за рубли,
    // серверно-авторитетно) — проверяем только что 'getSession' присутствует в массиве, не
    // требуем от него быть последним/единственным дополнением.
    assert(/\$this->permits = \[('[^']+',\s*)*'getSession'(,\s*'[^']+')*\];/.test(dicePhp), "'getSession' добавлен в permits");
    const start = dicePhp.indexOf('function getSession(){');
    assert(start !== -1, 'метод getSession() существует');
    const end = dicePhp.indexOf('\n        }', start);
    const body = dicePhp.slice(start, end);
    assert(!/saveUser|json_encode\(\$session/.test(body), 'getSession() не сохраняет — чисто читает состояние');
}

console.log('\nTest 6: dice.php.start() — идемпотентен: активный бросок не перебрасывается заново');
{
    const start = dicePhp.indexOf('function start(){');
    const end   = dicePhp.indexOf('\n        }', dicePhp.indexOf('$now = intval(round(microtime', start));
    const body  = dicePhp.slice(start, end);
    assert(/if\(is_array\(\$session\['active'\] \?\? null\)\)\{/.test(body), 'проверяет active ДО списания стоимости');
    assert(/'resumed' => true,/.test(body), 'возвращает флаг resumed:true при восстановлении');
    const idemIdx = body.indexOf("if(is_array($session['active'] ?? null)){");
    const deductIdx = body.indexOf('dice_free_ts');
    assert(idemIdx !== -1 && deductIdx !== -1 && idemIdx < body.indexOf("if(\$freeAvailable){"), 'проверка активного броска стоит РАНЬШЕ решения о списании');
}

console.log('\nTest 7: dvor-dice.js — при первом открытии экрана запрашивает getSession, если бросок не отслежен локально');
{
    assert(/if\(this\._diceState !== 1 && !this\._diceSessionChecked\)\{/.test(diceJs), 'проверяется один раз за загрузку страницы');
    assert(/this\._diceRestoreSession\(\);/.test(diceJs), '_openDiceScreen вызывает _diceRestoreSession()');
}

console.log('\nTest 8: dvor-dice-game.js — _diceRestoreSession восстанавливает кости без анимации броска');
{
    const start = diceGameJs.indexOf('proto._diceRestoreSession = function(){');
    assert(start !== -1, '_diceRestoreSession определён');
    const end = diceGameJs.indexOf('\n    };', start);
    const body = diceGameJs.slice(start, end);
    assert(/TS\.php\('dice\.getSession', \{\}/.test(body), 'зовёт dice.getSession');
    assert(/this\._diceRolls\s*=\s*res\.rolls;/.test(body), 'восстанавливает кости из ответа');
    assert(/this\._diceState\s*=\s*1;/.test(body), 'выставляет state=1 (бросок идёт)');
    assert(!/_runDiceThrowAnimation/.test(body), 'НЕ запускает косметическую анимацию броска при восстановлении');
}

console.log('\n=== БЛЭКДЖЕК ===');

console.log('\nTest 9: blackjack.php.status() — теперь сообщает активную раздачу (уже вызывается при каждом открытии экрана)');
{
    const start = blackjackPhp.indexOf('function status(){');
    assert(start !== -1, 'status() существует');
    const end = blackjackPhp.indexOf('\n        }', blackjackPhp.indexOf('$this->ops->ok($state);', start));
    const body = blackjackPhp.slice(start, end);
    assert(/\$active = \$session\['active'\] \?\? null;/.test(body), 'читает active из сессии');
    assert(/\$state\['active'\] = \[/.test(body), 'кладёт активную раздачу (hand/swapsUsed/swapsAllowed) в ответ, если она есть');
    assert(/\$state\['active'\] = null;/.test(body), 'active:null явно, если раздачи нет');
}

console.log('\nTest 10: blackjack.php.deal() — идемпотентен: активная раздача не перезаписывается новой');
{
    const start = blackjackPhp.indexOf('function deal(){');
    const end   = blackjackPhp.indexOf('function swap(){');
    const body  = blackjackPhp.slice(start, end);
    assert(/if\(is_array\(\$session\['active'\] \?\? null\)\)\{/.test(body), 'проверяет active ДО списания рубля/бесплатной попытки');
    assert(/'resumed' => true,/.test(body), 'возвращает флаг resumed:true при восстановлении');
    const idemIdx  = body.indexOf("if(is_array(\$session['active'] ?? null)){");
    const deductIdx = body.indexOf("deduct(\$user, 'coins'");
    assert(idemIdx !== -1 && deductIdx !== -1 && idemIdx < deductIdx, 'проверка активной раздачи стоит РАНЬШЕ списания рубля');
}

console.log('\nTest 11: dvor-blackjack.js — _syncBlackjackDailyStatus восстанавливает раздачу через res.active');
{
    const syncStart = bjJs.indexOf('proto._syncBlackjackDailyStatus = function(){');
    const syncEnd   = bjJs.indexOf('\n    };', syncStart);
    const syncBody  = bjJs.slice(syncStart, syncEnd);
    assert(/if\(res\.active && !this\._bjPlaying\) this\._bjRestoreSession\(res\.active\);/.test(syncBody),
        'если сервер вернул активную раздачу и клиент ещё не в игре — восстанавливает её');

    const start = bjJs.indexOf('proto._bjRestoreSession = function(active){');
    assert(start !== -1, '_bjRestoreSession определён');
    const end = bjJs.indexOf('\n    };', start);
    const body = bjJs.slice(start, end);
    assert(/this\._bjPlaying = true;/.test(body), 'выставляет _bjPlaying=true');
    assert(/const \[rank2, rank3\] = active\.hand;/.test(body), 'реальные карты (слоты 2/3) берутся из активной серверной раздачи');
    assert(/const card0 = dealDecorative\(\[card2, card3\]\);/.test(body), 'декоративные карты (слоты 0/1) генерируются заново — не персистятся, чисто косметика');
    assert(/if\(this\._bjSwapsLeft > 0\)\{\s*this\._activateSwapMode\(\);\s*\} else \{[\s\S]*?this\._resolveBlackjack\(\);/.test(body),
        'если смены ещё остались — активирует режим замены, иначе сразу подводит итог');
}

console.log('\n=== ОБЩЕЕ: swapsLeft учитывает swapsUsed восстановленной раздачи ===');

console.log('\nTest 12: все три клиента считают остаток смен как swapsAllowed-swapsUsed (не просто swapsAllowed)');
{
    assert(/this\._pokerSwapsLeft = Math\.max\(0, intval_\(res\.swapsAllowed\) - intval_\(res\.swapsUsed\)\);/.test(pokerGameJs),
        'покер: swapsLeft = swapsAllowed - swapsUsed при deal()');
    assert(/this\._diceSwapsLeft = Math\.max\(0, \(parseInt\(res\.swapsAllowed,10\)\|\|0\) - \(parseInt\(res\.swapsUsed,10\)\|\|0\)\);/.test(diceGameJs),
        'зарики: swapsLeft = swapsAllowed - swapsUsed при start()');
    assert(/this\._bjSwapsLeft = Math\.max\(0, \(parseInt\(res\.swapsAllowed,10\)\|\|0\) - \(parseInt\(res\.swapsUsed,10\)\|\|0\)\);/.test(bjJs),
        'блэкджек: swapsLeft = swapsAllowed - swapsUsed при deal()');
    // Серверные "свежие" ответы deal()/start() явно возвращают swapsUsed:0 — иначе формула
    // выше сломала бы обычную (не восстановленную) раздачу.
    assert(/'swapsAllowed' => \$swapsAllowed, 'swapsUsed' => 0,/.test(pokerPhp), 'poker.deal() (свежая раздача) явно возвращает swapsUsed:0');
    assert(/'swapsAllowed' => \$swapsAllowed, 'swapsUsed' => 0,/.test(dicePhp), 'dice.start() (свежий бросок) явно возвращает swapsUsed:0');
    assert(/'swapsAllowed' => \$swapsAllowed, 'swapsUsed' => 0,/.test(blackjackPhp), 'blackjack.deal() (свежая раздача) явно возвращает swapsUsed:0');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
