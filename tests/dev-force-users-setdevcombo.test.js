/**
 * Test: 25.09.2026, dev-панель — единый эндпоинт users.setDevCombo для форса комбинаций во
 * всех 4 казино-играх (по прямому указанию — "хочу тестировать все азартные игры").
 *
 * setDevCombo() валидирует game против allowedGames (['dice','poker','blackjack','roulette']),
 * пишет server-only поле dev_force_<game> НАПРЯМУЮ через saveData() — в обход client-writable
 * whitelist $allowed (тот же приём, что devGrantShmot()/setDevFlag()). combo пишется как есть,
 * без валидации содержимого — сама игра (dice.php/poker.php/blackjack.php/roulette.php)
 * валидирует и гасит флаг при следующей раздаче/броске/спине.
 *
 * Плюс регресс-гвард на инфраструктуру вокруг: permit зарегистрирован, 4 новых server-only поля
 * добавлены в resetSession()/дефолт нового игрока/сброс аккаунта (иначе "сброшенный" аккаунт
 * навсегда застрял бы с висящим форс-флагом).
 *
 * Run: node tests/dev-force-users-setdevcombo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');

console.log('\nTest 1: permit "setDevCombo" зарегистрирован в $this->permits');
{
    assert(/\$this->permits = \[[^\]]*'setDevCombo'[^\]]*\];/.test(usersSrc), "'setDevCombo' есть в permits");
}

console.log('\nTest 2: setDevCombo() — валидирует game против allowedGames, отклоняет неизвестную игру');
{
    const start = usersSrc.indexOf('function setDevCombo(){');
    assert(start !== -1, 'setDevCombo() найден');
    const end = usersSrc.indexOf('\n        }', start);
    const body = usersSrc.slice(start, end);

    assert(/\$allowedGames = \['dice', 'poker', 'blackjack', 'roulette'\];/.test(body), 'ровно 4 разрешённые игры');
    assert(/if\(!in_array\(\$game, \$allowedGames, true\)\) return \$this->registry\['tools'\]->error\(54\);/.test(body),
        'строгая проверка in_array(..., true) — отклоняет неизвестную игру ошибкой 54');
}

console.log('\nTest 3: setDevCombo() — пишет dev_force_<game> НАПРЯМУЮ через saveData(), в обход client-writable whitelist');
{
    const start = usersSrc.indexOf('function setDevCombo(){');
    const end = usersSrc.indexOf('\n        }', start);
    const body = usersSrc.slice(start, end);

    assert(/\$field = 'dev_force_' \. \$game;/.test(body), 'имя поля строится как dev_force_<game>');
    assert(/\$update = \['id' => \$this->registry\['uid'\], \$field => \$combo\];/.test(body), 'update содержит только id + это поле');
    assert(/\$result = \$this->registry\['udb'\]->saveData\(\$this->registry\['utb'\], \$update\);/.test(body),
        'прямой saveData() (как devGrantShmot/setDevFlag), а не generic save() через whitelist');
}

console.log('\nTest 4: 4 новых server-only поля добавлены в resetSession() (иначе сброс сессии оставит висящий форс-флаг)');
{
    const start = usersSrc.indexOf('function resetSession(){');
    assert(start !== -1, 'resetSession() найден');
    const end = usersSrc.indexOf('\n        }', start);
    const body = usersSrc.slice(start, end);
    ['dev_force_dice', 'dev_force_poker', 'dev_force_blackjack', 'dev_force_roulette'].forEach(f => {
        assert(body.includes(`'${f}'`), `resetSession() сбрасывает ${f}`);
    });
}

console.log('\nTest 5: дефолт нового игрока — 4 поля инициализированы пустой строкой (не Gameops::i()-ловушка при первом же чтении)');
{
    ["'dev_force_dice'      => '',", "'dev_force_poker'     => '',", "'dev_force_blackjack' => '',", "'dev_force_roulette'  => '',"].forEach(line => {
        assert(usersSrc.includes(line), `дефолт-инициализация содержит: ${line.trim()}`);
    });
}

console.log('\nTest 6: полный сброс аккаунта (resetAllPlayers / _defaultResetUdata) тоже покрывает все 4 поля');
{
    assert(usersSrc.includes("'dev_force_dice'=>'','dev_force_poker'=>'','dev_force_blackjack'=>'','dev_force_roulette'=>'',"),
        '_defaultResetUdata()/resetAllPlayers содержит все 4 поля с пустым дефолтом');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
