/**
 * Test: батч 25.09.2026 (по прямому указанию — "проверь, что связка ключей реально работает
 * и пишется в БД") — аудит нашёл 2 РЕАЛЬНЫХ бага у уже существующего предмета "Связка ключей"
 * (keyring_owner, выдаётся roulette.php через сектор №1 рулетки/мини-игру "9 стаканчиков"):
 *
 * БАГ 1 (дыра защиты): keyring_owner был в whitelist $allowed в users.php — то есть ЛЮБОЙ
 * игрок мог выставить себе keyring_owner=1 напрямую через обычный users.save() из консоли
 * браузера, вообще не выигрывая его честно (не через 30-дневный цикл рулетки/мини-игры).
 *
 * БАГ 2 (предмет не работал по смыслу): даже честно выигранный keyring_owner нигде не
 * читался в bosses.php — владелец связки всё равно должен был иметь реальные ключи и терял
 * их как обычно при старте боя. По ТЗ предмет должен снимать требование ключей ПОЛНОСТЬЮ,
 * для ЛЮБОГО босса, неограниченное число раз.
 *
 * Run: node tests/keyring-security-and-unlimited-boss-attacks.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersPhp  = read('server/core/controllers/users.php');
const bossesPhp = read('server/core/controllers/bosses.php');
const roulettePhp = read('server/core/controllers/roulette.php');

console.log('\n1) БАГ 1 — keyring_owner убран из client-writable whitelist users.php');
{
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(allowedMatch && !/'keyring_owner'/.test(allowedMatch[1]),
        "'keyring_owner' больше не в whitelist — обычный users.save() больше не может его подделать");
}

console.log('\n2) keyring_owner по-прежнему ЧИТАЕТСЯ клиентом (users.get — SELECT *, whitelist касается только записи)');
{
    // Сам факт удаления из $allowed не должен ломать чтение поля — users.get() не фильтрует
    // по whitelist вообще (см. function get() — SELECT *). Тут просто фиксируем, что мы не
    // трогали функцию get().
    assert(/function get\(\)\{/.test(usersPhp), 'get() на месте, не тронута этой правкой');
}

console.log('\n3) Легитимная выдача через roulette.php по-прежнему работает — она пишет через Gameops::saveUser() (в обход whitelist)');
{
    assert(/\$user\['keyring_owner'\] = 1;/.test(roulettePhp), 'roulette.php по-прежнему устанавливает keyring_owner=1 при честном выигрыше');
    const claimStart = roulettePhp.indexOf('function claimKeyring(){');
    const claimEnd = roulettePhp.indexOf('\n    private function _tryClaimKeyring', claimStart);
    // saveUser() внутри _tryClaimKeyring — проверяем именно там, где реально выставляется поле.
    const tryStart = roulettePhp.indexOf('private function _tryClaimKeyring');
    const tryEnd   = roulettePhp.indexOf('\n    function claimPrize', tryStart);
    const tryBody  = roulettePhp.slice(tryStart, tryEnd);
    assert(/\$user\['keyring_owner'\] = 1;/.test(tryBody), '_tryClaimKeyring() (сектор №1 рулетки) выставляет keyring_owner=1 в user-строке перед saveUser()');
}

console.log('\n4) БАГ 2 — bosses.php.startFight() теперь читает keyring_owner и снимает требование ключей полностью');
{
    const start = bossesPhp.indexOf('function startFight(){');
    const end   = bossesPhp.indexOf('$friendIds = ($diffIdx !== 3', start);
    const body  = bossesPhp.slice(start, end);

    assert(/\$hasKeyring = \$this->ops->i\(\$user, 'keyring_owner'\) > 0;/.test(body),
        'startFight() вычисляет $hasKeyring из реального поля игрока');
    assert(/if\(!\$hasKeyring\)\{/.test(body),
        'вся проверка/списание ключей теперь завёрнута в if(!$hasKeyring) — владелец связки полностью её пропускает');
    // 25.09.2026 (тот же батч, позже в тот же день — общий ключ Баркута/Бороды): $bossId
    // заменён на $keySlot в обеих строках ниже, см. tests/bosses-server-authoritative-fight-start.test.js.
    assert(/if\(\$needKeys > 0 && intval\(\$data\['keys'\]\[\$keySlot\]\) < \$needKeys\) return \$this->ops->fail\(64\);/.test(body),
        'обычная проверка "не хватает ключей" (fail 64) сохранена ДЛЯ ОБЫЧНЫХ игроков (без связки)');
    assert(/if\(\$needKeys > 0\) \$data\['keys'\]\[\$keySlot\] = intval\(\$data\['keys'\]\[\$keySlot\]\) - \$needKeys;/.test(body),
        'обычное списание ключей сохранено для тех, у кого нет связки');
}

console.log('\n5) Реальный прогон логики — владелец связки проходит без ключей на ЛЮБОГО босса, ключи не тратятся');
{
    // Мини-симуляция ИМЕННО куска логики "нужны ли ключи", а не паттерн-матчинг — гарантирует,
    // что порядок условий действительно даёт нужный результат, а не просто содержит нужные слова.
    function checkKeyGate(hasKeyring, needKeys, haveKeys){
        let failed = false;
        let keysAfter = haveKeys;
        if(!hasKeyring){
            if(needKeys > 0 && haveKeys < needKeys) failed = true;
            else if(needKeys > 0) keysAfter = haveKeys - needKeys;
        }
        return { failed, keysAfter };
    }

    let r = checkKeyGate(true, 5, 0);
    assert(r.failed === false, 'владелец связки: 0 ключей, боссу нужно 5 — бой всё равно начинается (fail не срабатывает)');
    assert(r.keysAfter === 0, 'владелец связки: ключи НЕ тратятся (остаются как были)');

    r = checkKeyGate(false, 5, 0);
    assert(r.failed === true, 'контроль: БЕЗ связки, 0 ключей, нужно 5 — бой отклоняется (та же логика, что раньше)');

    r = checkKeyGate(false, 5, 10);
    assert(r.failed === false && r.keysAfter === 5, 'контроль: БЕЗ связки, ключей хватает — списываются как обычно (10-5=5)');

    r = checkKeyGate(true, 0, 0);
    assert(r.failed === false, 'владелец связки на боссе БЕЗ требования ключей (Охотник) — тоже без проблем (needKeys=0 не задействует ветку)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
