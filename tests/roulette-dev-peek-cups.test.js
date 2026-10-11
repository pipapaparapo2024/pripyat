/**
 * Test: 11.10.2026 (по прямому указанию, после репорта "если не угадал, стаканчик с шариком
 * не появляется") — roulette.php намеренно НЕ отдаёт раскладку мини-игры "9 стаканчиков"
 * клиенту (10.10.2026, ТЗ "игроки не должны видеть под каким стаканчиком куш/связка" +
 * debug-leak фикс), значит нет штатного способа отличить "куша не было в ЭТОЙ раскладке"
 * (не каждая игра, kush_counter/kush_threshold — пока счётчик не дошёл до порога) от реального
 * бага показа другого стаканчика. Добавлен чисто диагностический dev-only permit
 * users.devPeekRouletteCups() (в users.php, не roulette.php — тот же приём, что уже применён у
 * toggleDevKeyring() для другого roulette-домена поля) + кнопка в дев-панели.
 *
 * Run: node tests/roulette-dev-peek-cups.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersPhp   = read('server/core/controllers/users.php');
const devPanelJs = read('_client/src/game/shell/overlays/dev_panel.js');

console.log('\n1) users.php — devPeekRouletteCups() зарегистрирован и защищён _requireDevUser()');
{
    assert(/'devPeekRouletteCups'/.test(usersPhp), "'devPeekRouletteCups' добавлен в \$this->permits");
    assert(/function devPeekRouletteCups\(\)\{/.test(usersPhp), 'функция определена');
    const start = usersPhp.indexOf('function devPeekRouletteCups(){');
    const end   = usersPhp.indexOf('\n        }', start);
    const body  = usersPhp.slice(start, end);
    assert(/if\(!\$this->_requireDevUser\(\)\) return;/.test(body), 'первой же строкой проверяет _requireDevUser() — не доступно обычным игрокам');
    assert(/\$this->ops->loadUser\(\)/.test(body), 'читает полную строку через Gameops::loadUser()');
    assert(/\$this->ops->j\(\$user, 'roulette_cups', null\)/.test(body), "читает server-only поле 'roulette_cups' через Gameops::j()");
    assert(!/saveUser/.test(body), 'чисто диагностика — ничего не сохраняет (saveUser не вызывается)');
    assert(/in_array\('__prize_choice__', \$cups, true\)/.test(body), 'не путает ожидающий выбор "забрать/рискнуть" с уже открытой раскладкой стаканчиков');
    assert(/array_search\('kush', \$cups, true\)/.test(body), 'находит индекс куша тем же array_search(strict), что и pickCup()');
    assert(/array_search\('keyring', \$cups, true\)/.test(body), 'находит индекс связки ключей тоже');
}

console.log('\n2) dev_panel.js — кнопка "Стаканчики — где шарик" вызывает users.devPeekRouletteCups и понятно показывает результат');
{
    assert(/Стаканчики — где шарик/.test(devPanelJs), 'кнопка подписана понятно');
    assert(/proto\._peekRouletteCups = function\(\)\{/.test(devPanelJs), '_peekRouletteCups определён');
    const start = devPanelJs.indexOf('proto._peekRouletteCups = function(){');
    const end   = devPanelJs.indexOf('\n    };', start);
    const body  = devPanelJs.slice(start, end);
    assert(/TS\.php\('users\.devPeekRouletteCups', \{\}/.test(body), 'вызывает правильный permit без лишних параметров');
    assert(/if\(!res \|\| !res\.open\)/.test(body), 'явно обрабатывает случай "мини-игра сейчас не открыта"');
    assert(/res\.kushIdx/.test(body) && /res\.keyringIdx/.test(body), 'читает оба индекса из ответа — куш и связку');
    assert(/notify\.showResult/.test(body), 'показывает результат игроку через стандартный toast (notify.showResult), не просто в консоль');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
