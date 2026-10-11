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
 * 11.10.2026, тем же днём — живой репорт "кнопка не работает": notify.showResult() добавляет
 * свой popup в root.layer2_mc, а _devWinTickerFn (см. dev_panel.js._openDevPanel()) КАЖДЫЙ кадр
 * принудительно поднимает devWin обратно на самый верх этого же слоя, пока панель открыта —
 * любой toast, показанный, пока панель не закрыта, оказывается визуально погребён под почти
 * непрозрачным фоном панели уже на следующем кадре. Результат выводится текстом ПРЯМО В
 * ПАНЕЛИ (this._cupsPeekTxt, часть content-контейнера дев-панели) вместо notify.showResult.
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
    // 11.10.2026 (репорт "кнопка не работает" — см. докблок выше): notify.showResult() визуально
    // погребён под devWin на следующем же кадре (_devWinTickerFn поднимает панель каждый тик,
    // пока она открыта) — результат должен идти в текст ВНУТРИ панели, не во внешний toast.
    assert(!/notify\.showResult/.test(body), '_peekRouletteCups БОЛЬШЕ НЕ использует notify.showResult (его бы перекрыло панелью на следующем кадре)');
    assert(/this\._cupsPeekTxt\.text = /.test(body), 'результат пишется в this._cupsPeekTxt.text — переживает собственный z-order панели');
}

console.log('\n3) dev_panel.js — this._cupsPeekTxt реально создан и добавлен в скроллируемый content дев-панели (не отдельным слоем поверх)');
{
    const rowIdx = devPanelJs.indexOf("_row('Стаканчики — где шарик'");
    assert(rowIdx !== -1, 'строка с кнопкой найдена');
    const chunk = devPanelJs.slice(rowIdx, rowIdx + 1200);
    assert(/const cupsPeekTxt = new PIXI\.Text\('', \{/.test(chunk), 'текстовый readout создаётся рядом с кнопкой (пустая строка по умолчанию)');
    assert(/content\.addChild\(cupsPeekTxt\);/.test(chunk), 'readout добавлен именно в content (скроллируемый контейнер дев-панели, тот же z-order, что и сама панель) — не в win/root.layer2_mc напрямую');
    assert(/this\._cupsPeekTxt = cupsPeekTxt;/.test(chunk), 'ссылка сохранена на this — доступна из _peekRouletteCups() в другом методе прототипа');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
