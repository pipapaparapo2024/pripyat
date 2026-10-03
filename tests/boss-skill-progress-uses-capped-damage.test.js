/**
 * Test: изначально (24.09.2026) — bosses.php.attack() капал dmgSpent/total_damage/
 * personalDamageTotal/boss_damage_log до $dealt = min($hpBefore, $damage), чтобы оверкилл на
 * добивающем ударе не "переливался" сверх maxHp босса в прогресс скиллов.
 *
 * 26.09.2026 (по прямому указанию, репорт — "бью х10 охотника, урон 2к/10к, а при победе
 * фиксирует хп босса 1к, но отображать в попапе победы нужно ровно столько, сколько ударил;
 * в очки скиллов придёт только урон который ты ударил, похуй на хп босса"): реверс. $dealt
 * удалён из attack() целиком — total_damage/personalDamageTotal/boss_damage_log/dmgSpent
 * теперь считаются по ПОЛНОМУ $damage удара без обрезки остатком HP (тот же принцип, что уже
 * был у bossDamage[$bossId] изначально — теперь единообразно у всех метрик). Единственное,
 * что остаётся ограниченным остатком HP — сам HP босса ($newHp = max(0, $hpBefore - $damage)).
 * Списание патронов по той же причине больше не "экономит" на добивающем ударе — mult
 * списывается целиком (см. boss-attack-server-authoritative-and-timing-friend-rule.test.js).
 *
 * Run: node tests/boss-skill-progress-uses-capped-damage.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server/core/controllers/bosses.php'), 'utf-8');

console.log('\nTest: $dealt (обрезанный остатком HP урон) удалён из attack() целиком');
{
    const start = src.indexOf('function attack(){');
    const end   = src.indexOf('\n        }', start);
    const body  = src.slice(start, end);
    assert(!/\$dealt\s*=\s*min\(/.test(body), '$dealt = min(...) не встречается — обрезка урона убрана целиком');
}

console.log('\nTest: dmgSpent растёт на полный $damage, а не на обрезанный $dealt');
{
    const start = src.indexOf('// Прогресс скиллов (22.09.2026)');
    const end   = src.indexOf('$user[\'skills_levels\'] = json_encode($skillsState);', start);
    const body  = src.slice(start, end);
    assert(!!body && start !== -1, 'блок обновления прогресса скиллов найден');
    assert(/\$skillsState\['dmgSpent'\] = intval\(\$skillsState\['dmgSpent'\]\) \+ \$damage;/.test(body),
        'dmgSpent увеличивается на полный $damage (не обрезанный остатком HP)');
}

console.log('\nTest: total_damage/personalDamageTotal/boss_damage_log — тоже полный $damage, единообразно с bossDamage[$bossId]');
{
    assert(/\$this->ops->add\(\$user, 'total_damage', \$damage\);/.test(src), 'total_damage считает полный $damage');
    assert(/\$data\['personalDamageTotal'\] = intval\(\$data\['personalDamageTotal'\]\) \+ \$damage;/.test(src), 'personalDamageTotal считает полный $damage');
    assert(/bind_param\('iiiiii', \$uid, \$bossId, \$diffIdx, \$damage, \$critInt, \$now\);/.test(src), 'boss_damage_log логирует полный $damage (источник ТОП УРОНА в попапе победы)');
}

console.log('\nTest: единственное, что остаётся ограниченным остатком HP — сам HP босса');
{
    assert(/\$newHp = max\(0, \$hpBefore - \$damage\);/.test(src), '$newHp — HP босса не уходит в минус, но это про HP, не про метрики удара');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
