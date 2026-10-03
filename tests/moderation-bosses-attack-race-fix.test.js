/**
 * Test: 26.09.2026 (аудит перед модерацией VK, пункт "гонка параллельных запросов / двойной
 * клик") — bosses.php.attack() списывал патроны read-modify-write БЕЗ блокировки строки:
 * $weapons читался в начале attack() через обычный ops->loadUser() (отдельное соединение к
 * БД), проверка qty>=mult и финальная запись $weapons[$weaponId]['qty'] происходили на этом
 * же, потенциально устаревшем к моменту записи, снимке. Два параллельных attack() (двойной
 * клик, повторный запрос при плохом интернете и т.п.) могли оба пройти проверку на ОДНОМ и
 * том же значении qty, оба нанести урон боссу, но патроны реально спишутся только один раз
 * (lost update) — "исчезающий" урон без расхода боеприпасов.
 *
 * Фикс: перед списанием — SELECT `weapons` ... FOR UPDATE в транзакции на уже открытом raw-
 * соединении ($link, тот же паттерн, что boss_damage_log INSERT чуть выше по коду) — второй
 * параллельный запрос физически ждёт эту транзакцию (блокировка строки держится до COMMIT) и
 * либо видит уже уменьшённое значение, либо получает честный fail(87), если патронов не
 * хватает. Локальные переменные ($weapons, $user['weapons']) синхронизируются с реально
 * записанным значением — код ответа клиенту (patch, qty в ответе) не расходится с БД.
 *
 * Run: node tests/moderation-bosses-attack-race-fix.test.js
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

const bossesPhp = read('server/core/controllers/bosses.php');

console.log('\nTest 1: attack() больше не делает наивный read-modify-write qty без блокировки');
{
    // Старый, небезопасный паттерн (наивное вычитание из $weapons, прочитанного в начале
    // функции, без запроса к БД перед записью) не должен присутствовать рядом со списанием.
    const attackStart = bossesPhp.indexOf('function attack(){');
    const attackEnd    = bossesPhp.indexOf('SERVER-AUTHORITATIVE НАГРАДА', attackStart);
    const body = bossesPhp.slice(attackStart, attackEnd);
    assert(attackStart !== -1 && attackEnd !== -1 && attackEnd > attackStart, 'границы тела attack() найдены в исходнике');

    assert(/\$link->begin_transaction\(\);/.test(body), 'транзакция начинается явно перед критичной секцией');
    assert(/SELECT `weapons` FROM `\{\$this->registry\['utb'\]\}` WHERE `id`=.*FOR UPDATE/.test(body),
        'SELECT ... FOR UPDATE держит блокировку строки игрока на время проверки+записи qty');
    assert(/\$link->commit\(\);/.test(body), 'транзакция завершается commit() после записи');
    assert(/\$link->rollback\(\);/.test(body), 'есть ветка rollback() — для случая, когда патронов не хватает после блокировки');
}

console.log('\nTest 2: повторная проверка qty>=mult происходит НА ЗАБЛОКИРОВАННОМ (locked) значении, не на исходном снимке из loadUser()');
{
    assert(/\$lockedQty = intval\(\$lockedWeapons\[\$weaponId\]\['qty'\] \?\? 0\);/.test(bossesPhp),
        'lockedQty читается из lockedWeapons (результат locked SELECT), а не из исходного $weapons');
    assert(/if\(\$lockedQty < \$mult\)\{/.test(bossesPhp), 'повторная проверка "хватает ли патронов" — на locked-значении');
    assert(/return \$this->ops->fail\(87\);.*гонка параллельных запросов/.test(bossesPhp.replace(/\n\s*/g, ' ')),
        'при нехватке патронов ПОСЛЕ блокировки — честный fail(87) с пояснением причины в комментарии');
}

console.log('\nTest 3: запись обновлённого qty идёт через ТО ЖЕ соединение ($link), внутри той же транзакции — не через отдельный ops->saveUser()');
{
    const start = bossesPhp.indexOf('$lockedWeapons[$weaponId][\'qty\'] = $lockedQty - $mult;');
    const end   = bossesPhp.indexOf('$link->commit();', start) + '$link->commit();'.length;
    const body  = bossesPhp.slice(start, end);
    assert(/\$link->query\("UPDATE `\{\$this->registry\['utb'\]\}` SET `weapons`=/.test(body),
        'UPDATE weapons выполняется через $link (та же локальная транзакция), а не отдельным вызовом Database wrapper');
    assert(/real_escape_string/.test(body), 'значение экранируется перед вставкой в SQL-строку (real_escape_string)');
}

console.log('\nTest 4: локальные переменные синхронизированы с реально сохранённым значением (ответ клиенту не расходится с БД)');
{
    assert(/\$weapons = \$lockedWeapons;/.test(bossesPhp), '$weapons переприсваивается locked-значением после commit — дальнейший код (patch, qty в ответе) видит правильное число');
    assert(/\$user\['weapons'\] = \$newWeaponsJson;/.test(bossesPhp), "\$user['weapons'] тоже обновлён — patchCurrencies() отдаст клиенту актуальное значение");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
