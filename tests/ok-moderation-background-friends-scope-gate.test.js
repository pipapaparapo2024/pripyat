/**
 * Test: 09.10.2026, отказ модерации ОК п.1 — "При запуске игры в каждой сессии возникает
 * предложение, вызываемое в фоне" (правило vk.com mini-apps-rules п.2.6.3: предложение в фоне
 * не раньше 2-го запуска и не чаще раза в 30 дней, либо явная инициатива игрока).
 *
 * Аудит нашёл единственный правдоподобный источник: preloader.js._scheduleFriendsScopePrompt()
 * вызывается на КАЖДОЙ сессии (после прелоадера), и если udata['friends_scope_granted']==='1'
 * (игрок хоть раз согласился), автоматически, БЕЗ клика игрока, зовёт
 * bridge.sendPromise('VKWebAppGetAuthToken', {scope:'friends'}) — без platform-гейта и без
 * ограничения по частоте. Комментарий в коде объяснял это тем, что для НАСТОЯЩЕГО VK такой
 * повтор резолвится мгновенно и без системного диалога (VK помнит грант). Но ОК рендерит это же
 * Mini App через СВОЙ Launcher (перехватывает ВСЕ Bridge-вызовы, см. modules/iap.js докблок) —
 * нет гарантии, что его реализация помнит прежний грант так же, как настоящий VK; тихий
 * автозапрос на каждой сессии — именно то, что запрещает правило 2.6.3.
 *
 * Фикс: тихий автозапрос ограничен isVk() — на ОК список друзей просто не подключается
 * автоматически (игрок может подключить explicitly кликом — тот путь, _showFriendsScopePrompt
 * ({force:true}), не затронут этой правкой).
 *
 * Run: node tests/ok-moderation-background-friends-scope-gate.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'preloader.js'), 'utf-8');

console.log('\nTest 1: preloader.js импортирует isVk() из modules/platform.js');
{
    assert(/import \{ isVk \} from '\.\.\/modules\/platform\.js';/.test(src), 'импорт isVk() присутствует');
}

console.log('\nTest 2: автоматический (без клика) запрос VKWebAppGetAuthToken для уже согласившихся игроков ограничен isVk()');
{
    const start = src.indexOf('_scheduleFriendsScopePrompt(){');
    assert(start !== -1, '_scheduleFriendsScopePrompt() найден');
    // Граница по сигнатуре СЛЕДУЮЩЕЙ функции (с параметром), а не по голой подстроке
    // '_showFriendsScopePrompt(' — та встречается РАНЬШЕ внутри же поясняющего комментария
    // ("...тот путь не затронут"), что обрезало бы body ДО самой проверяемой строки кода.
    const end = src.indexOf('_showFriendsScopePrompt(options', start);
    const body = src.slice(start, end);
    assert(/if\(isVk\(\)\) this\._requestFriendsScope\(\(\) => \{\}\);/.test(body),
        'автозапрос _requestFriendsScope() теперь ВНУТРИ if(isVk()) — не вызывается безусловно для любой площадки');
    assert(!/^\s*this\._requestFriendsScope\(\(\) => \{\}\);\s*$/m.test(body),
        'безусловный (не внутри if) вызов _requestFriendsScope() в этом блоке больше не существует');
}

console.log('\nTest 3: explicit-клик игрока (force:true) НЕ затронут этой правкой — продолжает работать на любой площадке');
{
    const start = src.indexOf('_showFriendsScopePrompt(options = {}){');
    assert(start !== -1, '_showFriendsScopePrompt() найден');
    const end = src.indexOf('_buildFriendsScopeModal(){', start);
    const body = src.slice(start, end);
    assert(/if\(options\.force\)\{ this\._buildFriendsScopeModal\(\); return; \}/.test(body),
        'force:true (явный клик игрока — кнопка «Друзья»/вкладка свода) по-прежнему показывает попап немедленно, без isVk()-гейта — это не "фоновое" предложение, инициировано игроком');
    assert(!/isVk/.test(body), '_showFriendsScopePrompt() НЕ ссылается на isVk() — гейт применён только к ТИХОМУ авто-реконнекту в _scheduleFriendsScopePrompt(), не к explicit-пути');
}

console.log('\nTest 4: _scheduleFriendsScopePrompt() по-прежнему вызывается на каждой сессии (это ОК — сам факт проверки флага не показывает UI; показ диалога — только внутри if(isVk()))');
{
    assert(/this\._scheduleFriendsScopePrompt\(\);/.test(src), '_scheduleFriendsScopePrompt() вызывается из основного потока загрузки (не удалён целиком — только сам автозапрос Bridge ограничен)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
