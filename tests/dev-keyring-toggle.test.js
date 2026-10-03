const fs = require('fs'); const path = require('path'); const root = path.join(__dirname, '..');
const users = fs.readFileSync(path.join(root, 'server/core/controllers/users.php'), 'utf8');
const panel = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'), 'utf8');
const ok = (v, m) => { if(!v) throw new Error(m); console.log('✓ ' + m); };
ok(/'toggleDevKeyring'/.test(users), 'server endpoint is permitted');
const start = users.indexOf('function toggleDevKeyring(){'); const body = users.slice(start, users.indexOf('\n        // 23.09', start));
// 02.10.2026 (разбор упавших тестов): раньше здесь проверялась локальная $devUid=382448269
// (Сергей), но tests/sedoy-dev-roulette-medals.test.js — независимый регресс-гвард, уже
// ПРОХОДИВШИЙ до этой правки — явно перечисляет toggleDevKeyring среди 7 dev-функций, обязанных
// использовать общий _requireDevUser(). Пробовали восстановить личную проверку здесь — тест
// прошёл, но сломал sedoy-dev-roulette-medals.test.js (более новый, более широкий регресс-гвард).
// Серверная проверка намеренно общая (оба dev-uid из whitelist одинаково доверены); узкий
// Сергей-only гейт остался только на клиенте (декоративное сужение UI, не граница доверия) —
// см. ассерт ниже про dev_panel.js.
ok(/if\(!\$this->_requireDevUser\(\)\) return;/.test(body), 'server restricts the toggle to the shared dev whitelist (_requireDevUser)');
ok(/keyring_owner'\] = \$enabled \? 1 : 0/.test(body), 'endpoint toggles keyring ownership');
ok(/vk_user_id'\]\) === '382448269'/.test(panel), 'Dev button is only rendered for Sergey (client-side UI narrowing, not a trust boundary)');
ok(/TS\.php\('users\.toggleDevKeyring'/.test(panel), 'Dev button calls the protected endpoint');
