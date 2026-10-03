/**
 * Сервер выбирает награду, а клиент лишь показывает его результат. Этот тест сверяет
 * порядок строк и значения таблиц, чтобы подсветка не указывала на чужую награду.
 * Run: node tests/gambling-reward-contracts.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const poker = JSON.parse(read('server/json/poker_config.json'));
const dice = JSON.parse(read('server/json/dice_config.json'));
const pokerScreen = read('_client/src/game/dvor/dvor-poker-screen.js');
const diceGame = read('_client/src/game/dvor/dvor-dice-game.js');
const blackjack = JSON.parse(read('server/json/blackjack_config.json'));
const blackjackScreen = read('_client/src/game/dvor/dvor-blackjack.js');
const rouletteServer = read('server/core/controllers/roulette.php');
const rouletteScreen = read('_client/src/game/dvor/dvor-roulette-screen.js');

let passed = 0;
function assert(condition, message) {
    if (!condition) throw new Error(message);
    console.log('  ✅ ' + message);
    passed++;
}

console.log('\nПокер: строки и серверные награды');
// 26.09.2026: COMBO_ROW_ORDER (массив квотированных строк ['royal_flush', ...]) заменён на
// COMBO_ROW_POS — объект с точными координатами каждой строки, ключи — голые идентификаторы
// (royal_flush: {...}), без кавычек — проверяем наличие ключа объекта, а не строкового литерала.
const pokerOrder = ['royal_flush', 'straight_flush', 'four_of_a_kind', 'full_house', 'flush', 'straight', 'three_of_a_kind', 'two_pair', 'pair', 'high_card'];
for (const combo of pokerOrder) assert(new RegExp(combo + ':\\s*\\{').test(pokerScreen), combo + ' есть в порядке подсветки');
assert(poker.combos.flush.type === 'stew' && poker.combos.flush.amt === 15, 'флеш выдаёт 15 тушёнки по таблице');
// 26.09.2026: призы покерных комбинаций переведены с roulette_spichki на poker_spichki
// (poker.resolve() начисляет их сам, сервер-авторитетно) — тест обновлён вслед за фиксом.
assert(poker.combos.straight.type === 'poker_spichki' && poker.combos.straight.amt === 300 && poker.combos.straight.sp === 300, 'стрит выдаёт 300 спичек покера по таблице');

console.log('\nЗарики: серверные комбинации сопоставляются с индексами таблицы');
assert(dice.table.length === 18, 'серверная таблица зариков содержит все 18 строк');
assert(/TABLE\.findIndex\(t => t\.v === r\.v && t\.n === r\.n\)/.test(diceGame), 'клиент ищет строку зариков по значениям, которые вернул сервер');

console.log('\nБлэкджек: для каждой серверной выплаты есть строка');
for (const rank of Object.keys(blackjack.payouts)) assert(blackjackScreen.includes("'" + rank + "'"), rank + ' имеет строку выплаты');

console.log('\nРулетка: серверная награда передаётся в экран без локального ролла');
assert(/this\._resolveRouletteNewScreen\(idx, !!res\.jackpot, res\.reward, res\.clientRewards \|\| \[\]\);/.test(read('_client/src/game/dvor/dvor-roulette.js')), 'экран получает reward и slotIdx от сервера');
assert(/private \$SPIN_SLOTS/.test(rouletteServer), 'сервер хранит таблицу секторов');
assert(/const SLOTS = \[/.test(rouletteScreen), 'экран использует таблицу подписей секторов');

console.log(`\n✅ All ${passed} reward-contract checks passed`);
