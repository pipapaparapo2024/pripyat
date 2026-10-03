/**
 * Test: 28.09.2026 (репорт: «на мобильной версии не обновляется список друзей», топ
 * «Друзья» показывает только самого игрока) — preloader.js._loadFriends().
 *
 * Корень бага (исходный): friends.get/friends.getAppUsers вызывались токеном VK_token, который
 * получал scope 'friends' ТОЛЬКО в retry-ветке initTimer() — а эта ветка срабатывает лишь если
 * utils.getServerTime сам падает, что почти никогда не случается. Мобильное приложение VK в
 * этом случае не показывает системный диалог сам — friends.get просто падает с ошибкой доступа,
 * window.my_friends никогда не устанавливается полным списком.
 *
 * 02.10.2026 (ОБНОВЛЕНО под архитектуру после фикса модерации VK 30.09.2026, см.
 * tests/vk-moderation-fixes-30-09-2026.test.js): прямые вызовы VKWebAppGetAuthToken из
 * initTimer()/onGetToken() убраны целиком — правило 2.6.3 dev.vk.com запрещает фоновый запрос
 * scope без явного действия игрока. Осталась ОДНА точка входа — _requestFriendsScope() —
 * вызываемая из _showFriendsScopePrompt() (клик игрока по кнопке «Разрешить» или уже
 * сохранённое согласие) и из _scheduleFriendsScopePrompt().waitForOnboarding() (тихий повторный
 * запрос токена для уже согласившегося игрока). Исходный ЗАМЫСЕЛ теста — "friends.get никогда
 * не вызывается без подтверждённого scope, и подключение друзей не теряется молча" —
 * сохраняется, но проверяется на новой структуре кода.
 *
 * Run: node tests/mobile-friends-scope-before-friends-get.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const preloaderJs = fs.readFileSync(path.join(root, '_client/src/game/preloader.js'), 'utf-8');

console.log('\nTest 1: initTimer()/onGetToken() БОЛЬШЕ НЕ запрашивают scope "friends" напрямую (фоновый запрос запрещён правилом 2.6.3) — друзья грузятся только через единую точку входа');
{
    const timerStart = preloaderJs.indexOf('initTimer(retry = false){');
    const timerEnd   = preloaderJs.indexOf('\n\tinitLinks(){');
    const timerBody  = preloaderJs.slice(timerStart, timerEnd);
    assert(timerStart !== -1 && timerEnd !== -1, 'initTimer() найден в файле');
    assert(!/VKWebAppGetAuthToken/.test(timerBody), 'initTimer() не вызывает VKWebAppGetAuthToken (ни в основной ветке, ни в retry/catch)');

    const tokenStart = preloaderJs.indexOf('onGetToken(data){');
    const tokenEnd   = preloaderJs.indexOf('\n\t_continueWithoutFriends(){');
    const tokenBody  = preloaderJs.slice(tokenStart, tokenEnd);
    assert(tokenStart !== -1 && tokenEnd !== -1, 'onGetToken() найден в файле');
    assert(!/VKWebAppGetAuthToken/.test(tokenBody), 'onGetToken() не вызывает VKWebAppGetAuthToken напрямую');
    assert(!/this\._loadFriends\(/.test(tokenBody), 'onGetToken() не вызывает _loadFriends() напрямую (нет друзей без подтверждённого scope)');
}

console.log('\nTest 2: _requestFriendsScope() — единственная точка входа, запрашивает scope "friends" и вызывает _loadFriends() ТОЛЬКО после успешного ответа VKWebAppGetAuthToken (friends.get никогда не вызывается без подтверждённого scope)');
{
    const start = preloaderJs.indexOf('_requestFriendsScope(done){');
    const end   = preloaderJs.indexOf('\n\t_persistFriendsScopeGranted(');
    const body  = preloaderJs.slice(start, end);
    assert(start !== -1 && end !== -1, '_requestFriendsScope() найден целиком');
    assert(/VKWebAppGetAuthToken/.test(body), '_requestFriendsScope() вызывает VKWebAppGetAuthToken');
    assert(/scope:\s*['"]friends['"]/.test(body), 'запрашивается именно scope "friends"');

    const thenIdx  = body.indexOf('.then(');
    const catchIdx = body.indexOf('.catch(');
    assert(thenIdx !== -1 && catchIdx !== -1 && thenIdx < catchIdx, '.then() идёт перед .catch()');
    const thenBlock  = body.slice(thenIdx, catchIdx);
    const catchBlock = body.slice(catchIdx);
    assert(/this\._loadFriends\(/.test(thenBlock), '.then() (успешный токен) ведёт к вызову _loadFriends()');
    assert(!/this\._loadFriends\(/.test(catchBlock), '.catch() (отказ/ошибка токена) НЕ вызывает _loadFriends() — friends.get не дёргается без scope (это и есть фикс мобильного бага)');
}

console.log('\nTest 3: единая точка входа действительно используется и при явном клике игрока, и при тихом восстановлении токена для уже согласившегося');
{
    const promptStart = preloaderJs.indexOf('_showFriendsScopePrompt(options = {}){');
    const promptEnd   = preloaderJs.indexOf('\n\t_requestFriendsScope(done){');
    const promptBody  = preloaderJs.slice(promptStart, promptEnd);
    assert(promptStart !== -1 && promptEnd !== -1, '_showFriendsScopePrompt() найден целиком');
    assert(/this\._requestFriendsScope\(/.test(promptBody), '_showFriendsScopePrompt() вызывает this._requestFriendsScope()');

    const scheduleStart = preloaderJs.indexOf('_scheduleFriendsScopePrompt(){');
    const scheduleEnd   = preloaderJs.indexOf('\n\t_showFriendsScopePrompt(options = {}){');
    const scheduleBody  = preloaderJs.slice(scheduleStart, scheduleEnd);
    assert(scheduleStart !== -1 && scheduleEnd !== -1, '_scheduleFriendsScopePrompt() найден целиком');
    assert(/this\._requestFriendsScope\(/.test(scheduleBody), '_scheduleFriendsScopePrompt()/waitForOnboarding() вызывает this._requestFriendsScope() для уже согласившегося игрока');
}

console.log('\nTest 4: _loadFriends() содержит реальные вызовы friends.get/friends.getAppUsers и по-прежнему устанавливает window.my_friends');
{
    const start = preloaderJs.indexOf('_loadFriends(onDone){');
    const end   = preloaderJs.indexOf('\n\tinitJSON(data){');
    const body  = preloaderJs.slice(start, end);
    assert(start !== -1 && end !== -1, '_loadFriends() найден целиком');
    assert(/method:\s*"friends\.get"/.test(body), 'вызывает friends.get');
    assert(/method:\s*'friends\.getAppUsers'/.test(body), 'вызывает friends.getAppUsers');
    assert(/window\.my_friends\s*=\s*ids;/.test(body), 'устанавливает window.my_friends');
    assert(/TS\.php\("users\.get"/.test(body), 'после друзей всё равно вызывает users.get (как раньше)');
}

console.log('\nTest 5: аудит-требование (сужение scope до "friends", без wall/photos/groups) остаётся зелёным — фикс не расширил запрошенные права');
{
    assert(/scope:\s*['"]friends['"]/.test(preloaderJs), 'scope "friends" присутствует');
    assert(!/wall,photos,groups/.test(preloaderJs), 'wall,photos,groups не запрашиваются');
    assert(!/"friends,wall,photos,groups"/.test(preloaderJs), 'старая широкая строка scope отсутствует');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
