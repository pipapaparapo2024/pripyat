/** Regression test for persisted VK friends consent and the HUD button.
 * Run: node tests/friends-scope-consent-persistence.test.js */
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(ok, message){
  if(ok){ console.log('  ✅', message); passed++; }
  else { console.error('  ❌ FAIL:', message); failed++; }
}
const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, '_client/src/game/interface.js'), 'utf8');
const preloader = fs.readFileSync(path.join(root, '_client/src/game/preloader.js'), 'utf8');
const gate = fs.readFileSync(path.join(root, '_client/src/modules/friends-scope-gate.js'), 'utf8');
const users = fs.readFileSync(path.join(root, 'server/core/controllers/users.php'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'server/migrate44.php'), 'utf8');
const leaderboard = fs.readFileSync(path.join(root, '_client/src/game/svod/svod-leaderboard.js'), 'utf8');

console.log('\n1) Кнопка друзей следует сохранённому согласию');
assert(/friendsBtn\.x = 20; friendsBtn\.y = 100; friendsBtn\.scale\.set\(0\.040\)/.test(ui), 'у кнопки точные x=20, y=100 и scale=0.040');
assert(/String\(udata\['friends_scope_granted'\] \|\| '0'\) === '1'/.test(ui), 'видимость кнопки проверяет серверный флаг');
assert(/friendsBtn\.visible = !granted/.test(ui), 'после согласия кнопка скрывается');
assert(/pripyat:friends-scope-granted/.test(ui), 'кнопка обновляется в текущей сессии без перезагрузки');

console.log('\n2) Согласие фиксируется только после VK Bridge');
assert(/VKWebAppGetAuthToken[\s\S]{0,1000}_persistFriendsScopeGranted/.test(preloader), 'серверное сохранение происходит после успешного VK Bridge');
assert(/TS\.php\('users\.setFriendsScopeGranted'/.test(preloader), 'клиент вызывает узкий серверный endpoint');
assert(/function setFriendsScopeGranted\(\)/.test(users), 'серверный endpoint реализован');
assert(/'setFriendsScopeGranted'/.test(users.match(/\$this->permits\s*=\s*\[[^;]+/s)[0]), 'endpoint включён в permits');
assert(/\$user\['friends_scope_granted'\] = 1;/.test(users), 'endpoint сохраняет только флаг согласия текущего пользователя');
assert(/patchCurrencies\(\$user, \['friends_scope_granted'\]\)/.test(users), 'новый флаг возвращается клиенту patch-ответом');
assert(/ADD COLUMN `friends_scope_granted` TINYINT\(1\) NOT NULL DEFAULT 0/.test(migration), 'миграция добавляет постоянную колонку со значением по умолчанию «нет»');
assert(/hasFriendsScopeGrantedLocal/.test(gate) && /_persistFriendsScopeGranted\(\)/.test(preloader), 'старое локальное согласие переносится в БД без нового запроса VK');

console.log('\n3) Имена в рейтингах белые');
// 08.10.2026 (фикс пикселизации текста): fontSize:13×scale(0.954) заменены на итоговый
// fontSize:12 без scale (13×0.954≈12 — практически та же видимая величина).
assert(/fontFamily:'Southbank LT', fontSize:12, fill:'#ffffff'/.test(leaderboard), 'имена игроков во всех вкладках рейтинга рендерятся белым, fontSize:12 (13×0.954)');

console.log(`\n${'─'.repeat(50)}`);
if(failed){ console.error(`❌ ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`✅ All ${passed} tests passed`);
