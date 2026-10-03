/**
 * Test: 28.09.2026, репорт игрока — "поиграл в казино (двор), накопил опыт/уровень в игре,
 * вышел, зашёл снова — опыт/уровень не сохранился".
 *
 * Корень (расследовано агентом-исследователем, подтверждено чтением кода):
 * 1. dvor.js._addExp() увеличивал this._data[game].exp и клал его в udata['dvor_games_data']
 *    через _saveData() — но САМА отправка на сервер шла ИСКЛЮЧИТЕЛЬНО через общий 500мс-дебаунс
 *    автосейва (player-save.js.queuePlayerSave(), сработавший на udata Proxy). Никакого форс-
 *    флаша сразу после начисления не было нигде в game/dvor/*.js (кроме одного вызова в
 *    dvor-blackjack.js перед ОПЛАТОЙ партии — это защищает баланс, не опыт).
 * 2. Единственная страховка — periodic flush (30с) и visibilitychange/pagehide, а последнее уже
 *    задокументировано в этом же проекте (skills.js) как ненадёжное в VK-вебвью: асинхронный
 *    запрос часто не успевает долететь до реального закрытия вкладки.
 * 3. Гарантированный (не вероятностный) путь потери найден в bank.js._refreshBalanceAfterPurchase():
 *    любая покупка валюты за донат вызывала suspendPlayerSave() (блокирует БУДУЩИЕ автосейвы, но
 *    НЕ отправляет уже накопленные несохранённые изменения), затем ЦЕЛИКОМ заменяла window.udata
 *    свежим снимком с сервера (users.get) и помечала его markPlayerDataFresh() — то есть любой
 *    ещё не отправленный udata['dvor_games_data'] (казино-эксп) терялся безвозвратно, а не просто
 *    откладывался.
 *
 * Фикс — тем же паттерном, что уже используется перед boss/zone/yashik/blackjack-запросами:
 * форсировать flushPlayerSave() (а) сразу после начисления экспы в _addExp(), (б) ДО, а не после
 * suspendPlayerSave() в bank.js._refreshBalanceAfterPurchase().
 *
 * Run: node tests/dvor-exp-flush-before-loss.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const dvor = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor.js'), 'utf-8');
const bank = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bank.js'), 'utf-8');

console.log('\nTest 1: dvor.js._addExp() форсирует flushPlayerSave() сразу после _saveData()');
{
    const start = dvor.indexOf('_addExp(game, n){');
    const end   = dvor.indexOf('\n    }', start);
    const body  = dvor.slice(start, end);

    assert(/this\._saveData\(\);/.test(body), '_saveData() по-прежнему вызывается (кладёт свежий JSON в udata)');
    const saveDataIdx  = body.indexOf('this._saveData();');
    const flushIdx     = body.indexOf("flushPlayerSave('dvor_addExp:' + game);");
    assert(flushIdx > -1, 'flushPlayerSave(\'dvor_addExp:\'+game) присутствует в теле _addExp()');
    assert(flushIdx > saveDataIdx, 'flushPlayerSave() вызывается ПОСЛЕ _saveData() (иначе улетел бы ещё не обновлённый снимок)');
    assert(/if\(window\.flushPlayerSave\) flushPlayerSave/.test(body), 'вызов защищён проверкой window.flushPlayerSave (модуль может быть не установлен в тестовом/раннем окружении)');
}

console.log('\nTest 2: bank.js._refreshBalanceAfterPurchase() флашит накопленные изменения ДО suspendPlayerSave()');
{
    const start = bank.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const end   = bank.indexOf('\n\thideBank()', start);
    const body  = bank.slice(start, end);

    const flushIdx   = body.indexOf("flushPlayerSave('bank_purchase_pending:' + currency);");
    const suspendIdx = body.indexOf("suspendPlayerSave('bank_purchase_pending:' + currency);");
    assert(flushIdx > -1, 'flushPlayerSave(\'bank_purchase_pending:\'+currency) присутствует');
    assert(suspendIdx > -1, 'suspendPlayerSave(\'bank_purchase_pending:\'+currency) по-прежнему присутствует (не удалён)');
    assert(flushIdx > -1 && suspendIdx > -1 && flushIdx < suspendIdx,
        'flushPlayerSave() вызывается РАНЬШЕ suspendPlayerSave() — иначе уже накопленный несохранённый прогресс (например, казино-эксп) блокируется от отправки, а затем window.udata целиком заменяется серверным снимком и прогресс теряется безвозвратно');
    assert(/if\(window\.flushPlayerSave\) flushPlayerSave/.test(body), 'вызов защищён проверкой window.flushPlayerSave');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
