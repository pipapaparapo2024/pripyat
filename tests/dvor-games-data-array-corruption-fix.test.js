/**
 * Test: 29.09.2026, репорт игрока — "поиграл немного в казино, перезагрузил страницу — уровень
 * игр и накопленный опыт пропали, вообще всё, что с уровнем связано". Уже второй репорт того же
 * симптома (первый чинили 28.09.2026 в dvor-exp-flush-before-loss.test.js — там был найден и
 * закрыт баг "экспа не долетала до сервера, потому что не было форс-флаша"), но проблема
 * осталась — потому что причина СОВСЕМ другая и не про тайминг отправки.
 *
 * Корень (аудит по прямому указанию, реальный запуск кода через vm, не текстовый grep):
 * PHP json_decode('{}', true) отдаёт ПУСТОЙ МАССИВ [] — от json_decode('[]', true) он в PHP
 * НЕОТЛИЧИМ (assoc-режим не различает "пустой объект" и "пустой список"). У свежего аккаунта
 * (или после сброса) колонка dvor_games_data пуста ('', NULL или '{}' — все три ветки
 * Database::trueJSON() сходятся к одному и тому же []), поэтому сервер отдаёт клиенту буквально
 * JS-массив [] в самом первом users.get().
 *
 * dvor.js._loadData():
 *   this._data = udata['dvor_games_data'] ? helper.safeParseJSON(...) : null;
 *   if(!this._data) this._data = this._defaultData();       // [] в JS truthy — не сработает!
 *   if(!this._data.poker) this._data.poker = def.poker;      // дописывает СВОЙСТВО на массив
 *   ...(то же для .cards/.dice/.roulette)...
 *
 * Работает для ЧТЕНИЯ (JS не запрещает свойства на массивах), но dvor.js._saveData() делает
 * `JSON.stringify(this._data)` — а у Array сериализуются ТОЛЬКО числовые индексы (0..length-1),
 * все 4 именованных свойства (poker/cards/dice/roulette) молча ВЫБРАСЫВАЮТСЯ. На сервер уходит
 * буквально строка "[]" — которая на следующей загрузке снова парсится в [] и воспроизводит тот
 * же баг. Итог: играть можно (в памяти this._data.poker.exp растёт нормально в течение сессии),
 * но КАЖДОЕ сохранение стирает прогресс обратно в "[]", и после любой перезагрузки уровень/опыт
 * всех 4 игр казино (покер/карты/зарики/рулетка) снова 0 — ровно симптом из репорта.
 *
 * Фикс (dvor.js._loadData()) — результат парсинга, оказавшийся МАССИВОМ (или вообще не
 * объектом), для этого поля считается испорченным состоянием и принудительно заменяется на
 * _defaultData(), а не молча донашивается как валидные данные.
 *
 * Проверено реальным запуском извлечённого кода (не текстовым совпадением) — воспроизводит
 * ровно сценарий из репорта: сервер отдаёт [], игрок набирает опыт, происходит сохранение,
 * страница "перезагружается" (повторный _loadData() из того же udata) — опыт должен остаться.
 *
 * Run: node tests/dvor-games-data-array-corruption-fix.test.js
 */
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── Извлекаем настоящий helper.safeParseJSON из universal_helper.js (не копия "на глаз" —
// иначе тест проверял бы свою собственную реализацию, а не реальный баг-путь). ──
const helperSrc = read('_client/src/modules/universal_helper.js');
let safeParseJSONBody;
{
    const s = helperSrc.indexOf('safeParseJSON(value, fallback){');
    const endMarker = '\n    }';
    const e = helperSrc.indexOf(endMarker, s);
    if (s === -1 || e === -1) throw new Error('safeParseJSON() не найден в universal_helper.js — тест устарел');
    // +endMarker.length — включить саму закрывающую скобку метода, иначе срез несбалансирован
    // по фигурным скобкам и падает с SyntaxError при исполнении.
    safeParseJSONBody = helperSrc.slice(s, e + endMarker.length);
}

// ── Извлекаем настоящие _rand/_defaultData/_loadData/_saveData из dvor.js — те же методы,
// что реально исполняются в игре, не переписанная копия. ──
const dvorSrc = read('_client/src/game/dvor.js');
let dvorMethodsSlice;
{
    const s = dvorSrc.indexOf('_rand(a, b){');
    const e = dvorSrc.indexOf("_saveData(){ udata['dvor_games_data'] = JSON.stringify(this._data); }", s);
    if (s === -1 || e === -1) throw new Error('_rand/_saveData не найдены в dvor.js — тест устарел, обновить маркеры');
    const end = dvorSrc.indexOf('\n', e) + 1; // включить всю строку _saveData() целиком (закрывающая скобка на ней же)
    dvorMethodsSlice = dvorSrc.slice(s, end);
}
if (!/if\(!this\._data \|\| Array\.isArray\(this\._data\) \|\| typeof this\._data !== 'object'\) this\._data = this\._defaultData\(\);/.test(dvorMethodsSlice)) {
    throw new Error('Array.isArray-гвард не найден в извлечённом куске _loadData() — тест устарел или фикс откатили');
}

// Один общий скрипт на контекст: helper и dvor создаются через var (не class/let) в ОДНОМ
// runInContext, чтобы не зависеть от разделения lexical-скоупа между несколькими отдельными
// вызовами runInContext — var/присвоенные объекты становятся обычными свойствами контекста,
// видимыми и внутри (как свободные идентификаторы udata/helper, которые реально использует
// dvor.js), и снаружи (ctx.dvor, ctx.helper) для проверок.
function makeDvorInContext(initialUdata){
    const ctx = { console: { log(){}, error(){} } };
    vm.createContext(ctx);
    ctx.udata = initialUdata;
    const script = 'var helper = new (class { ' + safeParseJSONBody + ' })();\n'
                 + 'var dvor = new (class { ' + dvorMethodsSlice + ' })();';
    vm.runInContext(script, ctx);
    return ctx; // ctx.dvor, ctx.udata, ctx.helper
}

console.log('\nTest 1: сервер отдаёт [] (свежий аккаунт) — _loadData() должен вернуть ОБЫЧНЫЙ ОБЪЕКТ, не массив с приклеенными свойствами');
{
    const ctx = makeDvorInContext({ dvor_games_data: [] }); // ровно то, что реально шлёт Database::trueJSON() для пустого/дефолтного значения
    ctx.dvor._loadData();
    assert(!Array.isArray(ctx.dvor._data), '_data — не массив (Array.isArray === false)');
    assert(typeof ctx.dvor._data === 'object' && ctx.dvor._data !== null, '_data — объект');
    assert(ctx.dvor._data.poker && ctx.dvor._data.poker.exp === 0, '_data.poker.exp инициализирован нулём');
    assert(ctx.dvor._data.cards && ctx.dvor._data.dice && ctx.dvor._data.roulette, '_data.cards/.dice/.roulette тоже присутствуют');
}

console.log('\nTest 2: воспроизведение репорта целиком — играем, сохраняем, "перезагружаем страницу", опыт должен сохраниться');
{
    const ctx = makeDvorInContext({ dvor_games_data: [] }); // первая загрузка свежего аккаунта — сервер отдаёт []
    ctx.dvor._loadData();

    // Игрок сыграл несколько раундов в зарики — то же самое, что делает dvor.js._addExp('dice', n)
    ctx.dvor._data.dice.exp += 7;
    ctx.dvor._saveData(); // ровно то, что кладёт в udata перед flushPlayerSave() на реальный сервер

    assert(typeof ctx.udata.dvor_games_data === 'string', '_saveData() кладёт строку в udata (то, что реально уходит в users.save)');
    assert(ctx.udata.dvor_games_data !== '[]', 'сохранённая строка — НЕ "[]" (баг: массив съедал все именованные поля при JSON.stringify)');
    assert(JSON.parse(ctx.udata.dvor_games_data).dice.exp === 7, 'опыт зариков (7) реально попал в сохранённую строку');

    // "Перезагрузка страницы" — новый инстанс Dvor в НОВОМ контексте, тот же udata (что вернул бы users.get())
    const ctxAfterReload = makeDvorInContext({ dvor_games_data: ctx.udata.dvor_games_data });
    ctxAfterReload.dvor._loadData();
    assert(ctxAfterReload.dvor._data.dice.exp === 7, 'опыт зариков (7) переживает "перезагрузку страницы" — это и есть репорт пользователя');
}

console.log('\nTest 3: обычный случай (сервер уже отдаёт нормальный объект с прогрессом) — регрессия не задета');
{
    const ctx = makeDvorInContext({ dvor_games_data: {
        poker: { exp: 42 },
        cards: { exp: 3, aa: 0, aa_t: 100000, kk: 0, kk_t: 80000, qq: 0, qq_t: 10000 },
        dice: { exp: 1, pity: 0, pity_t: 2000 },
        roulette: { exp: 5 },
    } });
    ctx.dvor._loadData();
    assert(ctx.dvor._data.poker.exp === 42, 'существующий прогресс покера (42) не затирается дефолтом');
    ctx.dvor._data.poker.exp += 1;
    ctx.dvor._saveData();
    assert(JSON.parse(ctx.udata.dvor_games_data).poker.exp === 43, 'приращение сверх существующего прогресса сохраняется корректно');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
