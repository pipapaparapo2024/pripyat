/**
 * Test: 26.09.2026, КРИТИЧЕСКИЙ репорт, подтверждён живыми логами — "платёж прошёл, но
 * награда пропала". Полная цепочка событий, восстановленная по логам:
 *
 * 1. VK-вебхук (universal_pay.php.order_status_change) честно начисляет coins 3 → 20003,
 *    saveUserResult подтверждает успех.
 * 2. Клиентский bank.js._refreshBalanceAfterPurchase() ещё не успел подтянуть свежий баланс
 *    (webhook VK — отдельный асинхронный сервер-серверный запрос, может прийти позже клиентского
 *    события VKWebAppShowOrderBoxResult) — window.udata['coins'] в браузере ВСЁ ЕЩЁ старое (3).
 * 3. Игрок (или periodic-автосейв) вызывает ЛЮБОЕ users.save — например,
 *    dev_panel.js._maxDvorLevels() → saveDevChanges() → TS.php('users.save', {udata_json:
 *    JSON.stringify(udata)}) — со старым udata.coins=3 внутри.
 * 4. Сервер (users.php.save(), coins в whitelist $allowed, без monotonic-guard) послушно
 *    ЗАТИРАЕТ честно начисленные 20003 обратно на 3 — деньги реально потеряны в БД, не только
 *    на экране.
 *
 * Много legit-мест клиента до сих пор легитимно УМЕНЬШАЮТ coins/stew/cigarettes локально перед
 * users.save (base.js апгрейды, gangs.js донат, hapuga.js, vassilich.js, dev_panel.js) — поэтому
 * server-side "запретить уменьшение" сломал бы их все. Правильный фикс — на клиенте: пока
 * баланс после покупки ещё не подтверждён, ПРИОСТАНОВИТЬ любой users.save (тем же механизмом
 * suspendPlayerSave/resumePlayerSave, что уже используется для bosses.attack и др.).
 *
 * dev_panel.js.saveDevChanges() — ОТДЕЛЬНАЯ от player-save.js реализация сохранения, которая
 * раньше вообще не проверяла suspend — добавлен геттер isPlayerSaveSuspended() специально для
 * таких внешних потребителей.
 *
 * Run: node tests/bank-purchase-save-suspend-overwrite-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const playerSave = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'player-save.js'), 'utf-8');
const bank        = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bank.js'), 'utf-8');
const devPanel    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: player-save.js — isPlayerSaveSuspended() экспортирован и выставлен на window');
{
    assert(/export function isPlayerSaveSuspended\(\)\{/.test(playerSave), 'функция isPlayerSaveSuspended() определена и экспортирована');
    assert(/return saveSuspended > 0;/.test(playerSave), 'возвращает реальное внутреннее состояние приостановки (не заглушка)');
    assert(/window\.isPlayerSaveSuspended = isPlayerSaveSuspended;/.test(playerSave), 'выставлена на window — доступна другим модулям, не только этому файлу');
}

console.log('\nTest 2: bank.js._refreshBalanceAfterPurchase() приостанавливает автосейв на время ожидания');
{
    const start = bank.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const end   = bank.indexOf('\n\thideBank()', start);
    const body  = bank.slice(start, end);

    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('bank_purchase_pending:' \+ currency\);/.test(body),
        'вызывает suspendPlayerSave() ДО первой попытки опроса баланса');
    assert(/const _finish = \(\) => \{ if\(window\.resumePlayerSave\) resumePlayerSave\('bank_purchase_pending:' \+ currency\); \};/.test(body),
        '_finish() снимает приостановку через resumePlayerSave()');
    assert(/_finish\(\);/.test(body), '_finish() реально вызывается (не просто объявлена)');
    // Критично: resume должен сработать НА ЛЮБОМ исходе (успех после N попыток, ошибка сети,
    // некорректный ответ сервера) — иначе автосейв замрёт навсегда при сбое.
    const finishCalls = (body.match(/_finish\(\);/g) || []).length;
    assert(finishCalls >= 3, '_finish() вызывается на нескольких путях завершения (успех/ошибка/некорректный ответ), не только на happy path — нашли вызовов: ' + finishCalls);
}

console.log('\nTest 3: dev_panel.js.saveDevChanges() проверяет isPlayerSaveSuspended() и откладывает сохранение вместо перезаписи');
{
    const start = devPanel.indexOf('const _attemptDevSave = () => {');
    const end   = devPanel.indexOf('\n    const saveDevChanges', start);
    const body  = devPanel.slice(start, end);

    assert(/if\(window\.isPlayerSaveSuspended && isPlayerSaveSuspended\(\)\)\{/.test(body),
        'проверяет window.isPlayerSaveSuspended() перед отправкой');
    assert(/saveTimer = setTimeout\(_attemptDevSave, 500\);/.test(body),
        'если приостановлено — откладывает попытку через именованную функцию (не отправляет старый снимок)');
    // Комментарий рядом сам объясняет, ПОЧЕМУ arguments.callee не используется — исключаем
    // строки-комментарии из проверки, иначе это же объяснение ловит само себя.
    const devPanelCodeOnly = devPanel.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert(!/arguments\.callee/.test(devPanelCodeOnly), 'arguments.callee НЕ используется в коде (запрещён в strict mode ES-модулей — сломал бы отложенный повтор)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
