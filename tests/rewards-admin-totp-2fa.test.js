/** Реальный PHP-тест TOTP: RFC 6238, допустимое окно времени и URI настройки. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { findPhpBin, runPhp } = require('./_php_bin');
const php = findPhpBin();
if(!php){ console.log('⚠️ PHP не найден: тест пропущен согласно общему helper-правилу.'); process.exit(0); }
const fixture = path.join(__dirname, '_php_fixtures', 'rewards-admin-totp-rfc6238.php');
const result = runPhp(php, `require ${JSON.stringify(fixture)};`);
assert(result.ok, `PHP fixture завершился ошибкой: ${result.stderr || result.stdout}`);
assert.strictEqual(result.stdout.trim(), 'OK', 'RFC 6238-векторы и проверки TOTP должны пройти');

const siteRoot = path.join(__dirname, '..', '..', '..', 'сайт');
const config = fs.readFileSync(path.join(siteRoot, 'config.php'), 'utf8');
const login = fs.readFileSync(path.join(siteRoot, 'login.php'), 'utf8');
const setup = fs.readFileSync(path.join(siteRoot, 'setup-2fa.php'), 'utf8');
const verify = fs.readFileSync(path.join(siteRoot, 'verify-2fa.php'), 'utf8');
const migration = fs.readFileSync(path.join(siteRoot, 'migrations', '001_rewards_admin_totp.sql'), 'utf8');
assert(config.includes('REWARDS_ADMIN_AUTH_VERSION = 2'), 'старые сессии инвалидируются новой версией авторизации');
assert(config.includes("$rewardsAdminHost === 'test-pripyat-game.ru' ? 'stalker_test' : 'stalker'"), 'тестовая админка выбирает отдельную БД только по реальному HTTP-домену');
assert(config.includes("intval($_SESSION['reward_admin_auth_version'] ?? 0) !== REWARDS_ADMIN_AUTH_VERSION"), 'доступ требует новую версию сессии');
assert(login.includes("header('Location: verify-2fa.php')"), 'после пароля существующая 2FA ведёт к проверке кода');
assert(setup.includes('rewards_totp_verify($secret,') && setup.includes('reward_admin_save_totp_secret($secret)'), 'первичная настройка требует действительный код до сохранения секрета');
assert(verify.includes('rewards_totp_verify($secret,') && verify.includes('reward_admin_finish_login()'), 'полный вход выдаётся только после проверки TOTP');
assert(migration.includes('CREATE TABLE IF NOT EXISTS reward_admin_totp'), 'миграция создаёт только новую таблицу 2FA');
assert(!/DROP\s|TRUNCATE\s|DELETE\s/i.test(migration), 'миграция не удаляет и не очищает существующие данные');
console.log('✅ TOTP PHP logic, защита сессий и безопасная миграция пройдены');
