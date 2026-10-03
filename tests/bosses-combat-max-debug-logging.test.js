/**
 * Test: 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
 * блэкджека после репорта "выпала AA хотя pity ещё далеко") — максимальное логирование в
 * attack()/claimKill() (bosses.php) + печать в консоль браузера (bosses-combat.js).
 *
 * Run: node tests/bosses-combat-max-debug-logging.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bossesPhp  = readSrc('server/core/controllers/bosses.php');
const combatJs   = readSrc('_client/src/game/bosses/bosses-combat.js');

console.log('\nTest 1: attack() — полная раскладка расчёта урона (база/крит/скиллы/шмот) + верификация записи');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('function claimKill(){');
    const body  = bossesPhp.slice(start, end);
    assert(/\$damageDebugPre = \[/.test(body), 'полная раскладка расчёта урона собрана (base/tier/hall/flat/crit/gang/shmot)');
    assert(/'critRoll' => \$critRoll, 'isCrit' => \$isCrit,/.test(body), 'сам crit-ролл (не только итоговый isCrit) попадает в debug');
    assert(/'friendIds' => \$friendIds,/.test(body), 'список friendIds, участвующих в подсчёте HP, попадает в debug');
    assert(/\$verifyUser = \$this->ops->loadUser\(\['id', 'bosses_data'\]\);/.test(body),
        'после saveUser() bosses_data перечитывается ИЗ БД заново — та же проверка, что в blackjack.php');
    assert(/'saveVerifyMismatch' => \$saveVerifyMismatch,/.test(body), 'явный флаг расхождения записанного/прочитанного');
    assert(/'debug' => \$debug,/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 2: claimKill() — HP-проверка, дроп-роллы (персональный пул босса) и верификация');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const body  = bossesPhp.slice(start);
    assert(/\$claimDebug = \[/.test(body), 'claimDebug инициализируется сразу после HP-проверки');
    assert(/'curHpAtClaim' => \$curHp,/.test(body), 'производный HP на момент клейма попадает в debug');
    // 01.10.2026 (общая ревизия политики выдачи одежды казино/боссов, по прямому указанию —
    // см. tests/casino-loot-policy.test.js и tests/boss-shmot-drop-in-claim-kill.test.js):
    // независимый ОБЩИЙ 5%-дроп шмота id0-40 (commonPoolDrop/commonDropRoll) убран из claimKill()
    // совсем — осознанное решение, не регрессия. casino-loot-policy.test.js прямо проверяет
    // ОТСУТСТВИЕ commonPoolDrop. Персональный пул босса (id41+) этой ревизией не затронут.
    assert(!/commonPoolDrop/.test(body) && !/commonDropRoll/.test(body),
        'общего дропа id0-40 (commonPoolDrop/commonDropRoll) больше нет — убран ревизией 01.10.2026, не только персональный пул остался');
    assert(/\$claimDebug\['bossPersonalPoolDrop'\] = \[/.test(body), 'ролл персонального пула босса (id41+, сеты/фрагменты) логируется');
    assert(/\$verifyUser = \$this->ops->loadUser\(\['id', 'bosses_data'\]\);/.test(body),
        'после saveUser() bosses_data перечитывается ИЗ БД заново');
    assert(/'debug' => \$claimDebug,/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 3: клиент печатает debug + метки времени клика для удара и claimKill');
{
    assert(/КЛИК удар \| performance\.now\(\)/.test(combatJs), '_attack() логирует момент клика удара');
    assert(/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(combatJs), '_attack()/_onDefeat() печатают debug раскрытым объектом');
    assert((combatJs.match(/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/g) || []).length >= 2,
        'debug печатается минимум в двух местах (attack и claimKill)');
    assert(/КЛИК\/авто-запрос claimKill/.test(combatJs), '_onDefeat() логирует момент запроса claimKill');
    assert(/saveVerifyMismatch/.test(combatJs), 'клиент проверяет флаг saveVerifyMismatch и подсвечивает его отдельным console.error');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
