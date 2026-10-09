/** Regression tests for VK friends consent, session token and leaderboard activation.
 * Run: node tests/friends-session-reconnect-and-leaderboard.test.js */
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(ok, message){
  if(ok){ console.log('  ✅', message); passed++; }
  else { console.error('  ❌ FAIL:', message); failed++; }
}
const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, '_client/src/index.js'), 'utf8');
const preloader = fs.readFileSync(path.join(root, '_client/src/game/preloader.js'), 'utf8');
const leaderboard = fs.readFileSync(path.join(root, '_client/src/game/svod/svod-leaderboard.js'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, '_client/src/game/onboarding/onboarding-popup.js'), 'utf8');
const users = fs.readFileSync(path.join(root, 'server/core/controllers/users.php'), 'utf8');

console.log('\n1) Разделены постоянное согласие и токен текущей сессии');
assert(/window\._friendsScopeReady = false;/.test(index), 'готовность списка друзей инициализируется отдельно от VK_token');
assert(/_continueWithoutFriends\(\)[\s\S]{0,240}window\._friendsScopeReady = false;/.test(preloader), 'новая сессия не выдаёт себя за уже загруженный список');
assert(/_loadFriends\(onDone\)[\s\S]{0,500}window\._friendsScopeReady = false;/.test(preloader), 'перед запросом состояние загрузки сбрасывается');
assert(/window\.my_friends = ids;[\s\S]{0,120}window\._friendsScopeReady = true;/.test(preloader), 'готовность выставляется только после получения id друзей, играющих в приложении');
assert(/\.catch\(e => \{\s*window\._friendsScopeReady = false;/.test(preloader), 'сбой VK API не оставляет ложный успешный статус');

console.log('\n2) Согласие и список сохраняются навсегда в БД');
assert(/TS\.php\('users\.setFriendsCache', \{friends:ids\}/.test(preloader), 'после VK API подтверждённый список друзей сохраняется на сервере');
assert(/function setFriendsCache\(\)/.test(users), 'серверный endpoint кэша друзей реализован');
assert(/friends_scope_granted[\s\S]{0,160}error\(403\)/.test(users.slice(users.indexOf('function setFriendsCache'))), 'запись кэша разрешена только после сохранённого согласия');
assert(/String\(udata\['friends_scope_granted'\][\s\S]{0,500}window\._friendsScopeReady = true;/.test(preloader), 'после перезапуска сохранённый список сразу готов без Bridge (оптимистичный кэш из БД)');
// 02.10.2026 (баг найден по прямому репорту — "иконки друзей не отображаются, хотя разрешение
// уже есть"): сохранённое согласие раньше означало "врём, что всё готово" БЕЗ реального запроса
// VK_token этой сессии — _resolveVkUsers()/users.get потом работал без access_token и не
// возвращал фото никого. Теперь оба места (фоновый waitForOnboarding() после загрузки И явный
// клик по вкладке «Друзья» через _showFriendsScopePrompt()) тихо зовут _requestFriendsScope() —
// VK отдаёт токен для уже разрешённого scope БЕЗ системного диалога, поэтому это не нарушает
// правило 2.6.3, но даёт рабочий VK_token на сессию.
// 09.10.2026 (отказ модерации ОК, п.1 — "предложение в фоне на каждой сессии", правило 2.6.3):
// этот тихий авто-вызов теперь ограничен isVk() — предположение "VK резолвит без диалога"
// верно ТОЛЬКО для настоящего VK, у ОК-Launcher нет гарантии той же памяти о гранте (см.
// tests/ok-moderation-background-friends-scope-gate.test.js для полного разбора). Окно
// увеличено (1700→7500) — докблок про isVk()-гейт заметно удлинил расстояние до вызова.
assert(/friends_scope_granted'\] \|\| '0'\) === '1'\)\{[\s\S]{0,7500}if\(isVk\(\)\) this\._requestFriendsScope\(\(\) => \{\}\);[\s\S]{0,20}return;/.test(preloader), 'фоновая проверка после загрузки тихо обновляет VK_token сессии на VK (теперь за isVk()-гейтом, не безусловно)');
assert(/if\(hasSavedConsent\)\{[\s\S]{0,400}this\._requestFriendsScope\(\(\) => \{\}\);[\s\S]{0,20}return;/.test(preloader), 'повторный вызов при сохранённом согласии тоже тихо обновляет VK_token (а не просто врёт "готово")');
assert(!/if\(hasSavedConsent\)\{\s*window\._friendsScopeReady = true;\s*window\.dispatchEvent\(new Event\('pripyat:friends-connected'\)\);\s*return;/.test(preloader), 'старый баговый шорткат (готово без реального запроса токена) удалён');

console.log('\n3) Финал обучения вызывает разрешение только при отсутствии согласия');
assert(/needsFriendsPermission[\s\S]{0,180}this\._finish\(\);[\s\S]{0,140}pripyat:friends-permission-request/.test(onboarding), '«Продолжить» завершает обучение и запускает запрос только новому игроку');
assert(/pripyat:friends-permission-request[\s\S]{0,300}friends_scope_granted[\s\S]{0,100}return;[\s\S]{0,120}_requestFriendsScope/.test(preloader), 'обработчик блокирует повторное системное окно по флагу БД');
assert(!/pripyat:onboarding-done[^\n]+_showFriendsScopePrompt/.test(preloader), 'после onboarding-done нет второго автоматического предложения');

console.log('\n4) Кнопка «Друзья» работает после перезагрузки');
assert(/tabCfg\.secondScope === 'friends' && !window\._friendsScopeReady/.test(leaderboard), 'кнопка проверяет факт загрузки друзей, а не просто наличие launch-token');
assert(/_showFriendsScopePrompt\(\{force:true, reconnect:true\}\)/.test(leaderboard), 'кнопка запускает пользовательский диалог обновления');
assert(/const refreshFriends = \(\) => setScope\('friends'\);[\s\S]{0,120}pripyat:friends-connected/.test(leaderboard), 'после загрузки кнопка автоматически открывает список друзей');
assert(/subSecond\.interactive = true; subSecond\.buttonMode = true;/.test(leaderboard), 'саб-вкладка физически кликабельна в PIXI');

console.log(`\n${'─'.repeat(50)}`);
if(failed){ console.error(`❌ ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`✅ All ${passed} tests passed`);
