/**
 * Test: 30.09.2026, по прямому указанию — отказ модерации VK, п.1/3/6 (полный разбор — см.
 * ответ модератора в сессии). Три независимых фикса, каждый на своих файлах:
 *
 *  п.1 — VKWebAppGetAuthToken(scope:'friends') вызывался БЕЗ объяснения на КАЖДОЙ сессии
 *        (preloader.js) — нарушение правила 2.6.3 (не раньше 2-го запуска, не чаще раза в
 *        30 дней). Изначально (30.09.2026) оба тогдашних места вызова гейтились через
 *        shouldAskFriendsScope() из friends-scope-gate.js.
 *        02.10.2026 — АРХИТЕКТУРА ИЗМЕНИЛАСЬ: оба прежних места вызова схлопнуты в ОДНУ точку
 *        входа, _requestFriendsScope() (см. tests/mobile-friends-scope-before-friends-get.test.js,
 *        переписан тем же днём на той же архитектуре). Сам системный диалог VK по-прежнему не
 *        показывается фоново: единственный вызов VKWebAppGetAuthToken(scope:'friends') достижим
 *        только (а) через явный клик игрока в собственном модальном окне игры
 *        (_showFriendsScopePrompt(), гейтится shouldAskFriendsScope()) или (б) тихим обновлением
 *        токена для игрока, который согласие УЖЕ дал ранее (_scheduleFriendsScopePrompt(), поле
 *        friends_scope_granted='1' в БД) — для уже разрешённого scope VK не показывает системный
 *        диалог вовсе, поэтому правило 2.6.3 (которое именно про фоновый ДИАЛОГ) не применимо.
 *  п.3 — шеринг (boss_result.js/level_up.js) слал window.location.href — внутри Mini App это
 *        адрес iframe'а (pripyat-game.ru, сторонний домен + query сессии), а не vk.com.
 *        Заменено на захардкоженную каноническую ссылку.
 *  п.6 — фоновая музыка (PIXI.sound) и общий PIXI.Ticker не останавливались при сворачивании
 *        приложения — ни VKWebAppViewHide/ViewRestore, ни visibilitychange нигде не
 *        отслеживались. Добавлен modules/app-lifecycle.js, подключённый в index.js.
 *
 * Run: node tests/vk-moderation-fixes-30-09-2026.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');

console.log('\nTest 1 (п.1 — фоновый запрос scope friends): гейт существует и подключён в preloader.js через единую точку входа _requestFriendsScope()');
{
    const gate = read(path.join('modules', 'friends-scope-gate.js'));
    assert(/export function shouldAskFriendsScope/.test(gate), 'friends-scope-gate.js экспортирует shouldAskFriendsScope');
    assert(/export function markFriendsScopeAsked/.test(gate), 'friends-scope-gate.js экспортирует markFriendsScopeAsked');
    assert(/export function registerLaunch/.test(gate), 'friends-scope-gate.js экспортирует registerLaunch');
    assert(/count < 2/.test(gate), 'гейт блокирует запрос раньше 2-го запуска');
    assert(/THIRTY_DAYS_MS\s*=\s*30 \* 24 \* 60 \* 60 \* 1000/.test(gate), 'окно повторного запроса — 30 дней');

    const preloader = read(path.join('game', 'preloader.js'));
    assert(/import \{[^}]*\bshouldAskFriendsScope\b[^}]*\} from '\.\.\/modules\/friends-scope-gate\.js';/.test(preloader),
        'preloader.js импортирует shouldAskFriendsScope из гейта');
    assert(/import \{[^}]*\bmarkFriendsScopeAsked\b[^}]*\} from '\.\.\/modules\/friends-scope-gate\.js';/.test(preloader),
        'preloader.js импортирует markFriendsScopeAsked из гейта');

    // 02.10.2026: архитектура схлопнула прежние 2 места вызова в ОДНУ точку входа —
    // _requestFriendsScope(). Системный диалог VK всё равно не показывается фоново: сама функция
    // достижима только из гейтованных путей (проверяется ниже), без диалога для initTimer()/
    // onGetToken() — см. tests/mobile-friends-scope-before-friends-get.test.js.
    const scopeCallRegex = /bridge\.sendPromise\('VKWebAppGetAuthToken', \{app_id:parseInt\(vk_params\['vk_app_id'\]\), scope:'friends'\}\)/g;
    const calls = [...preloader.matchAll(scopeCallRegex)];
    assert(calls.length === 1, 'в preloader.js ровно 1 вызов VKWebAppGetAuthToken(scope:friends) — единая точка входа (было 2 раздельных места до 02.10.2026)');
    if (calls.length === 1) {
        const call = calls[0];
        const funcStart = preloader.lastIndexOf('_requestFriendsScope(done){', call.index);
        assert(funcStart !== -1 && funcStart < call.index, 'единственный вызов живёт внутри _requestFriendsScope()');
    }

    // initTimer()/onGetToken() не должны содержать вызов VKWebAppGetAuthToken вообще — ни в
    // основной ветке, ни в retry/catch (прежняя retry-ветка initTimer() была источником бага,
    // разобранного в mobile-friends-scope-before-friends-get.test.js, и убрана целиком).
    const timerStart = preloader.indexOf('initTimer(retry = false){');
    const timerEnd   = preloader.indexOf('\n\tinitLinks(){');
    assert(!/VKWebAppGetAuthToken/.test(preloader.slice(timerStart, timerEnd)),
        'initTimer() не вызывает VKWebAppGetAuthToken (фоновый запрос запрещён правилом 2.6.3)');

    // Единая точка входа должна быть достижима ТОЛЬКО из гейтованных путей:
    // 1) явный клик игрока в собственном модальном окне (_showFriendsScopePrompt), гейтится
    //    shouldAskFriendsScope() для ещё не согласившегося игрока;
    // 2) тихое обновление токена для УЖЕ согласившегося игрока (_scheduleFriendsScopePrompt) —
    //    для разрешённого ранее scope VK не показывает диалог, поэтому гейт здесь не обязателен.
    const promptStart = preloader.indexOf('_showFriendsScopePrompt(options = {}){');
    const promptEnd   = preloader.indexOf('\n\t_requestFriendsScope(done){');
    const promptBody  = preloader.slice(promptStart, promptEnd);
    assert(promptStart !== -1 && promptEnd !== -1, '_showFriendsScopePrompt() найден целиком');
    assert(/this\._requestFriendsScope\(/.test(promptBody), '_showFriendsScopePrompt() вызывает единую точку входа this._requestFriendsScope()');
    assert(/shouldAskFriendsScope\(\)/.test(promptBody), '_showFriendsScopePrompt() проверяет shouldAskFriendsScope() для нового запроса (не чаще раза в 30 дней, не раньше 2-го запуска)');

    const scheduleStart = preloader.indexOf('_scheduleFriendsScopePrompt(){');
    const scheduleEnd   = preloader.indexOf('\n\t_showFriendsScopePrompt(options = {}){');
    const scheduleBody  = preloader.slice(scheduleStart, scheduleEnd);
    assert(scheduleStart !== -1 && scheduleEnd !== -1, '_scheduleFriendsScopePrompt() найден целиком');
    assert(/this\._requestFriendsScope\(/.test(scheduleBody), '_scheduleFriendsScopePrompt() вызывает единую точку входа this._requestFriendsScope() для уже согласившегося игрока');

    assert((preloader.match(/markFriendsScopeAsked\(\);/g) || []).length >= 1, 'markFriendsScopeAsked() вызывается хотя бы при одном из путей запроса доступа');

    const indexJs = read('index.js');
    assert(/import \{ registerLaunch \} from '\.\/modules\/friends-scope-gate\.js';/.test(indexJs), 'index.js импортирует registerLaunch');
    assert(/registerLaunch\(\);/.test(indexJs), 'index.js вызывает registerLaunch() при старте сессии');
}

console.log('\nTest 2 (п.3 — сторонний домен в шеринге): shareLink — каноническая ссылка vk.com, не window.location.href');
{
    for (const file of [path.join('game', 'shell', 'popups', 'boss_result.js'), path.join('game', 'shell', 'popups', 'level_up.js')]) {
        const src = read(file);
        assert(!/const shareLink = window\.location/.test(src), file + ': больше не берёт shareLink из window.location.href');
        assert(/const shareLink = 'https:\/\/vk\.com\/app54574178_438953352';/.test(src), file + ': shareLink — захардкоженная ссылка на приложение vk.com/app54574178_438953352');
    }
}

console.log('\nTest 3 (п.6 — работа в фоне при сворачивании): app-lifecycle.js останавливает звук и тикер, подключён в index.js');
{
    const lifecycle = read(path.join('modules', 'app-lifecycle.js'));
    assert(/export function installAppLifecyclePause/.test(lifecycle), 'app-lifecycle.js экспортирует installAppLifecyclePause');
    assert(/PIXI\.sound\.pauseAll\(\)/.test(lifecycle), 'пауза останавливает PIXI.sound.pauseAll()');
    assert(/PIXI\.sound\.resumeAll\(\)/.test(lifecycle), 'возврат возобновляет PIXI.sound.resumeAll()');
    assert(/PIXI\.Ticker\.shared\.stop\(\)/.test(lifecycle), 'пауза останавливает PIXI.Ticker.shared.stop()');
    assert(/PIXI\.Ticker\.shared\.start\(\)/.test(lifecycle), 'возврат возобновляет PIXI.Ticker.shared.start()');
    assert(/e\.detail\.type === 'VKWebAppViewHide'/.test(lifecycle), 'подписка реагирует на VKWebAppViewHide');
    assert(/e\.detail\.type === 'VKWebAppViewRestore'/.test(lifecycle), 'подписка реагирует на VKWebAppViewRestore');
    assert(/document\.addEventListener\('visibilitychange'/.test(lifecycle), 'есть резервная подписка на visibilitychange (веб-версия)');

    const indexJs = read('index.js');
    assert(/import \{ installAppLifecyclePause \} from '\.\/modules\/app-lifecycle\.js';/.test(indexJs), 'index.js импортирует installAppLifecyclePause');
    assert(/installAppLifecyclePause\(\);/.test(indexJs), 'index.js вызывает installAppLifecyclePause() при старте сессии');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
