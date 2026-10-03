/**
 * Test: подсветка выигранной строки в таблице наград (напечатанной на фоне экрана)
 * вместо общего текстового попапа — по просьбе пользователя ("все награды есть на
 * фоновой картинке, сделай подсвечивание, я потом подправлю координаты").
 *
 * Координаты строк сняты по факту напечатанных на фоновых PNG таблиц (poker_screen.png —
 * "ТАБЛИЦА КОМБИНАЦИЙ", блекджек страница.png — "ТАБЛИЦА ВЫПЛАТ", зарики страница.png —
 * таблица из 18 строк) — приблизительные, для точной подгонки будет использован
 * универсальный редактор позиций (заранее предупреждено в комментариях кода).
 *
 * У рулетки отдельного печатного списка нет (список — само колесо) — акцентом на
 * результате служит уже существующий клин-подсветка сектора (sectorHighlight). Изначально
 * мигал масштабом красный маркер-точка попадания, но по прямому указанию пользователя
 * ("должна мигать не красная точка, а вот эта выделенная зона") мигание (alpha yoyo)
 * перенесено на сам клин — точка теперь просто статично отмечает место стрелки.
 *
 * Run: node tests/gambling-reward-highlight.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const pokerScreenSrc = fs.readFileSync(path.join(root, 'dvor-poker-screen.js'), 'utf-8');
const pokerGameSrc   = fs.readFileSync(path.join(root, 'dvor-poker-game.js'), 'utf-8');
const bjSrc          = fs.readFileSync(path.join(root, 'dvor-blackjack.js'), 'utf-8');
const diceScreenSrc  = fs.readFileSync(path.join(root, 'dvor-dice-screen.js'), 'utf-8');
const diceGameSrc    = fs.readFileSync(path.join(root, 'dvor-dice-game.js'), 'utf-8');
const roulScreenSrc  = fs.readFileSync(path.join(root, 'dvor-roulette-screen.js'), 'utf-8');

console.log('\nTest 1: покер — подсветка строки таблицы комбинаций');
{
    assert(/this\._pokerComboHighlight = comboHighlight;/.test(pokerScreenSrc), 'Graphics-подсветка создаётся на экране покера');
    assert(/const COMBO_ROW_POS = \{/.test(pokerScreenSrc), 'таблица позиций строк по combo-ключам');
    assert(/proto\._pokerShowComboHighlight = function\(combo\)\{/.test(pokerScreenSrc), 'метод показа подсветки определён');
    // 26.09.2026: формула (база+шаг+офсет) заменена на точный замер редактором позиций по
    // каждой из 10 строк отдельно — единый размер рамки 257×37 для всех.
    assert(/const COMBO_ROW_W = 257, COMBO_ROW_H = 37;/.test(pokerScreenSrc), 'единый размер рамки подсветки 257×37 (снят редактором позиций)');
    // 18.09.2026: подбор/оценка комбинации переехали на сервер (poker.php) — клиент теперь
    // подсвечивает строку по res.combo из ответа poker.resolve, а не по локально посчитанной
    // переменной combo. См. tests/poker-server-authoritative.test.js для полной проверки переноса.
    assert(/this\._pokerShowComboHighlight\(res\.combo\);/.test(pokerGameSrc), '_resolvePokerNewScreen вызывает подсветку по комбинации из ответа сервера');
}

console.log('\nTest 2: карты — подсветка строки таблицы выплат (по рангу пары)');
{
    assert(/this\._bjComboHighlight = comboHighlight;/.test(bjSrc), 'Graphics-подсветка создаётся на экране карт');
    assert(/const BJ_ROW_Y = \{/.test(bjSrc), 'таблица Y-координат строк по рангу (туз/король/дама/.../__nonpair)');
    assert(/proto\._bjShowComboHighlight = function\(rank\)\{/.test(bjSrc), 'метод показа подсветки определён');
    assert(/this\._bjShowComboHighlight\(bestRank\);/.test(bjSrc), '_resolveBlackjack вызывает подсветку (включая непарный случай — __nonpair fallback)');
}

console.log('\nTest 3: зарики — подсветка строки таблицы наград (по индексу TABLE)');
{
    assert(/this\._diceComboHighlight = comboHighlight;/.test(diceScreenSrc), 'Graphics-подсветка создаётся на экране зариков');
    // 22.09.2026 (по прямому указанию — "не получается формулой, лучше поточечно"): формула
    // заменена явным массивом из 18 чисел (значения те же, что формула давала раньше).
    assert(/const DICE_ROW_Y = \[/.test(diceScreenSrc),
        '18 Y-координат строк — явный массив (было формулой, группы по 3, шаг 22px внутри / 27px между группами)');
    assert(/proto\._diceShowComboHighlight = function\(rowIndex\)\{/.test(diceScreenSrc), 'метод показа подсветки определён');
    // 15.09.2026: теперь ищет ВСЕ совпадающие индексы (массив), не только первый/лучший.
    // 18.09.2026: подбор комбинаций переехал на сервер (dice.php) — клиент теперь строит
    // hitIndices из res.rewards, а не считает сам. См. tests/dice-multiple-simultaneous-combos.test.js
    // и tests/dice-server-authoritative-rng.test.js для полной проверки обеих частей.
    assert(/const hitIndices = \(res\.rewards \|\| \[\]\)/.test(diceGameSrc),
        '_resolveDiceNewScreen собирает МАССИВ индексов строк из res.rewards (не один hitIdx) для подсветки');
    assert(/this\._diceShowComboHighlight\(hitIndices\);/.test(diceGameSrc), 'подсветка вызывается со всеми найденными попаданиями разом');
    assert(/this\._diceShowComboHighlight\(0\);/.test(diceGameSrc), 'подсветка вызывается и для гарантированного пити-приза (строка 4×6, индекс 0)');
}

// 23.09.2026 (по прямому указанию — "убери подсвечивание для игры рулетку"): клин-подсветка
// сектора убран из игры целиком (Test 4 раньше проверял именно её) — см.
// tests/roulette-sector-highlight-removed.test.js для полной проверки удаления.
console.log('\nTest 4: рулетка — красная точка-маркер по-прежнему не пульсирует масштабом (регресс-гвард)');
{
    assert(!/\.to\(this\._roulRewardMarker\.scale, \{x:2\.2, y:2\.2/.test(roulScreenSrc),
        'красная точка-маркер по-прежнему не пульсирует масштабом');
    assert(/proto\._resolveRouletteNewScreen = function\(idx, isJack, reward, clientRewards\)\{([\s\S]*?)\n    \};/.test(roulScreenSrc), '_resolveRouletteNewScreen найден');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
