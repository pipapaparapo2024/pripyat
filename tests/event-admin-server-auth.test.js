const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'event.php'), 'utf8');

assert.match(source, /const ADMIN_UIDS\s*=\s*\[/, 'Администраторы события должны определяться серверным allowlist.');
assert.match(source, /private function _requireAdmin\(\)/, 'Проверка администратора должна быть общей для операций события.');
assert.match(source, /if\(!\$this->_requireAdmin\(\)\) return;/, 'Активация и деактивация обязаны требовать серверную проверку администратора.');
assert.doesNotMatch(source, /ADMIN_KEY|admin_key/, 'В исходниках события не должен оставаться статический пароль администратора.');

console.log('event-admin-server-auth: OK');
