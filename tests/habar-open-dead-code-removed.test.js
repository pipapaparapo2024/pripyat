/**
 * Test: 28.09.2026, аудит по прямому указанию (разбор жалобы игроков "с хабара не выдаются
 * поинты").
 *
 * Находка: server/core/controllers/habar.php.open() (+ приватный _roll()) был полностью
 * недостижимым server-only кодом — client-side game/habar.js вызывает ТОЛЬКО permits 'buy' и
 * 'collectDay' (habar.js._buyAndOpen()/_collectDay()), 'open' нигде не запрашивается. У этого
 * мёртвого метода была СВОЯ таблица наград (server/json/habar_containers.json.loot_pool —
 * тушёнка/аптечка/рубли, ни одного поинта), никак не синхронизированная с реально используемой
 * habar_daily_config.json (та, что кормит collectDay() и содержит dice_points/blue_points/
 * poker_chips) — при разборе жалобы это привело к ложному первому впечатлению, что хабар вообще
 * не должен выдавать поинты. Реальная причина жалобы была в другом (см. bosses.php.useSedoy()),
 * но мёртвый код с параллельной таблицей наград решили убрать, чтобы больше не путал при
 * следующем разборе похожих репортов.
 *
 * Фикс: Habar::open()/_roll() удалены целиком, 'open' убран из $permits. habar_containers.json
 * оставлен (buy() по-прежнему читает из него price каждого тира), но поле loot_pool в нём
 * удалено — оно было нужно только удалённому open().
 *
 * Run: node tests/habar-open-dead-code-removed.test.js
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

const habarPhp = readSrc('server/core/controllers/habar.php');

console.log('\nTest 1: habar.php — permits больше не включает \'open\'');
{
    assert(/\$this->permits = \['buy', 'collectDay'\];/.test(habarPhp),
        "\$permits сузился до ['buy', 'collectDay'] — 'open' убран");
    assert(!/\$this->permits = \[[^\]]*'open'[^\]]*\]/.test(habarPhp),
        "нигде в permits не осталось 'open'");
}

console.log('\nTest 2: habar.php — function open()/_roll() удалены целиком');
{
    assert(!/function open\(\)\{/.test(habarPhp), 'function open() удалена');
    assert(!/private function _roll\(/.test(habarPhp), '_roll() удалена (использовался только внутри open())');
    // 28.09.2026 (фикс собственного теста): регекс матчил ВЕСЬ файл, включая пояснительные
    // комментарии, которые сами упоминают "loot_pool" как описание того, что было удалено —
    // проверяем только реальный исполняемый код, как уже делает соседний тест shmot-equip-*.
    const codeOnly = habarPhp.split('\n').filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
    assert(!/loot_pool/.test(codeOnly), 'habar.php больше не читает loot_pool ни из одного каталога (вне комментариев)');
}

console.log('\nTest 3: habar.php.buy() не затронут — по-прежнему читает price из habar_containers.json');
{
    assert(/function buy\(\)\{/.test(habarPhp), 'buy() на месте');
    assert(/\$cats = \$this->ops->catalog\('habar_containers'\);/.test(habarPhp),
        'buy() всё ещё читает каталог habar_containers (нужен price каждого тира)');
    assert(/\$price = intval\(\$con\['price'\]\['amount'\]\);/.test(habarPhp),
        'buy() берёт цену из con[\'price\'] — не из удалённого loot_pool');
}

console.log('\nTest 4: habar.php.collectDay() не затронут — реальная и единственная выдача награды хабара');
{
    assert(/function collectDay\(\)\{/.test(habarPhp), 'collectDay() на месте');
    assert(/\$cfg = \$this->ops->catalog\('habar_daily_config'\);/.test(habarPhp),
        'collectDay() по-прежнему читает единственный живой каталог наград — habar_daily_config.json');
}

console.log('\nTest 5: habar_containers.json — 4 тира с ценой, без мёртвого loot_pool');
{
    const cfg = JSON.parse(readSrc('server/json/habar_containers.json'));
    assert(Array.isArray(cfg) && cfg.length === 4, '4 тира контейнера, как и раньше');
    for (const tier of cfg) {
        assert(tier.price && typeof tier.price.amount === 'number', `тир id${tier.id} (${tier.name}) сохранил price`);
        assert(!('loot_pool' in tier), `тир id${tier.id} (${tier.name}) больше не содержит мёртвое поле loot_pool`);
    }
}

console.log('\nTest 6: клиент по-прежнему не вызывает несуществующий более permit habar.open');
{
    const habarJs = readSrc('_client/src/game/habar.js');
    assert(!/TS\.php\('habar\.open'/.test(habarJs), "client habar.js не запрашивает 'habar.open' (никогда не запрашивал)");
    assert(/TS\.php\('habar\.buy'/.test(habarJs) && /TS\.php\('habar\.collectDay'/.test(habarJs),
        'client по-прежнему использует ровно два permits — habar.buy и habar.collectDay');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
