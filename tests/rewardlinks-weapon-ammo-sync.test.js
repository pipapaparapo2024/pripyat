/**
 * Test: 08.10.2026, по репорту — "люди получили посылки оружия (наградные ссылки), но не могут
 * его использовать — при атаке на босса вылетает ошибка".
 *
 * Корень (подтверждён живыми данными реального игрока, uid=278467964): rewardlinks.claim()
 * обрабатывал ammo_machete/ammo_gun/ammo_auto как ОБЫЧНУЮ валюту ($this->ops->add()) —
 * прибавлял сумму прямо в легаси-колонку users.ammo_auto/ammo_gun/ammo_machete. Но
 * bosses.php.attack() при попытке атаковать читает ИСКЛЮЧИТЕЛЬНО weapons[idx].owned/qty (JSON-
 * поле users.weapons) — отдельная структура, source of truth для боя (см. weapons.php.buy(),
 * комментарий "Легаси-поле патрона — ОТДЕЛЬНАЯ колонка, не защищённая этим локом"). Награда
 * оседала в поле, которое combat вообще не читает: оружие оставалось owned=false, клиент
 * получал fail(89) "оружие не куплено" при каждой попытке атаковать. Хуже того — сам "бонус" в
 * любой момент молча затирался следующей ЛЕГИТИМНОЙ покупкой того же оружия (weapons.php.buy()
 * пишет легаси-поле СВЕЖИМ значением weapons[idx].qty, не суммой).
 *
 * Живое подтверждение (php_errors.log, 07.10.2026 13:25:40 UTC): игрок получил по ссылке
 * ammo_auto=10/ammo_gun=35/ammo_machete=50. На момент проверки (08.10.2026) его weapons[5]
 * (автомат) — owned:false, qty:0, при этом users.ammo_auto=10 — ровно симптом из репорта.
 * Мачете/ствол у него случайно оказались owned=true (качественно другим путём — легитимная
 * покупка ПОСЛЕ claim'а перезаписала легаси-поле его реальным qty, стерев остаток бонуса) —
 * автомат остался нетронутым, поэтому баг виден именно на нём.
 *
 * Фикс: ammo_machete/ammo_gun/ammo_auto внутри kind:"currency" теперь мапятся на
 * weapons[idx].owned=true + qty+=amount (тот же контракт, что weapons.php.buy()), легаси-поле
 * синхронизируется СВЕЖИМ итоговым qty. Заодно вынесена чистая функция _applyRewardEntry() (без
 * $link/БД) — тестируется напрямую через Reflection, РЕАЛЬНЫМ исполнением, не regex по тексту.
 *
 * Run: node tests/rewardlinks-weapon-ammo-sync.test.js
 */
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — тест реального исполнения PHP пропущен (это не провал, см. tests/_php_bin.js). Прогнать с PHP: положить портативный в ~/tools/php/php.exe, или задать PHP_BIN=путь.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'rewardlinks-weapon-ammo-sync-core.php');

let stdout;
try {
    stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
} catch (e) {
    console.error('❌ PHP-скрипт упал (фатальная ошибка):');
    console.error(e.stderr || e.message);
    process.exit(1);
}

stdout.trim().split('\n').forEach(line => {
    if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
    else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
    else if (line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
    else if (line.trim()) console.log('  ', line);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение PHP ${phpBin})`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
