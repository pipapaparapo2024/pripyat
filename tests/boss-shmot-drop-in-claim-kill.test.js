/**
 * Test: батч 22.09.2026 (по прямому указанию, репорт "нет иконки награды шмота с босса") —
 * изначально добавлен server-authoritative шанс дропа ОБЩЕГО предмета (id 0-40,
 * bosses_config.json.shmot_drop_chance_pct) при убийстве ЛЮБОГО босса — тот же пул, что
 * client-side shmot.giveRandom() раньше использовал для казино.
 *
 * 22.09.2026 (тот же день, второй батч): персональные вещи боссов (id 41+, "сет ссср" и т.п.)
 * ДОБАВЛЕНЫ отдельным, независимым вторым блоком — см. boss-personal-shmot-drop-pool.test.js.
 *
 * 01.10.2026 (по прямому указанию — общая ревизия политики выдачи одежды казино/боссов,
 * см. tests/casino-loot-policy.test.js): независимый ОБЩИЙ 5%-дроп шмота id0-40 с ЛЮБОГО
 * босса (весь блок из Test 2/3 ниже в их исходном виде, плюс ключ shmot_drop_chance_pct в
 * bosses_config.json) — УБРАН совсем, это осознанное решение по общей политике, не регрессия.
 * `casino-loot-policy.test.js` прямо проверяет обратное: `!/commonPoolDrop/.test(bosses) &&
 * !/shmot_drop_chance_pct/.test(bosses)` — "У боссов нет независимого общего 5% дропа одежды".
 * (Эта же ревизия убрала pity-джекпот зариков, giveRandom() казино на клиенте и т.д. — единая
 * политика "одежда выдаётся только через конкретные, названные механики", не голый случайный
 * общий пул.) Персональные вещи боссов (id 41+, второй блок) этой ревизией НЕ затронуты —
 * остаются единственным способом получить шмот с боссов, см. boss-personal-shmot-drop-pool.test.js.
 *
 * 02.10.2026 (разбор упавших тестов после параллельной сессии, задевшей экономику боссов):
 * этот файл был написан ДО ревизии 01.10.2026 и всё ещё ожидал удалённый общий блок — почти
 * весь файл (Test 1-3) требовал код, которого больше нет. Проверено по mtime: casino-loot-
 * policy.test.js и bosses_config.json моложе этого файла — удаление общего блока подтверждено
 * как намеренное, не регрессия. Test 1-3 переписаны под текущую политику ("общего блока нет и
 * не должно быть"). Test 4-5 (shmotAmount в ответе/patch, клиентский попап) остались в силе
 * без изменений — они относятся к ПЕРСОНАЛЬНОМУ дропу (id41+), который этой ревизией не тронут.
 *
 * Run: node tests/boss-shmot-drop-in-claim-kill.test.js
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

const bossesPhp     = readSrc('server/core/controllers/bosses.php');
const bossesCfg     = JSON.parse(readSrc('server/json/bosses_config.json'));
const combatSrc     = readSrc('_client/src/game/bosses/bosses-combat.js');
const bossResultSrc = readSrc('_client/src/game/shell/popups/boss_result.js');

console.log('\nTest 1: bosses_config.json — общий (не персональный) шанс дропа шмота больше НЕ существует в каталоге (политика 01.10.2026)');
{
    assert(!('shmot_drop_chance_pct' in bossesCfg), 'shmot_drop_chance_pct убран из каталога — общий дроп id0-40 с боссов отключён как класс механики');
}

console.log('\nTest 2: claimKill() не содержит общего (id 0-40, shmot_items.json) блока дропа шмота — только персональный пул (id41+)');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.lastIndexOf('$this->ops->ok(['));
    const body  = bossesPhp.slice(start, end);

    assert(!/commonDropRoll/.test(body) && !/commonDropHit/.test(body) && !/commonPoolDrop/.test(body),
        'нет общего броска/хита (commonDropRoll/commonDropHit/commonPoolDrop) — механика удалена целиком, не замаскирована под другим именем');
    assert(!/catalog\('shmot_items'\)/.test(body),
        'claimKill() не читает catalog(\'shmot_items\') вообще — единственный источник дропа шмота с боссов теперь boss_shmot_drop_pool');
}

console.log('\nTest 3: единственный источник дропа шмота с боссов — ПЕРСОНАЛЬНЫЙ пул (boss_shmot_drop_pool), см. boss-personal-shmot-drop-pool.test.js');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.lastIndexOf('$this->ops->ok(['));
    const body  = bossesPhp.slice(start, end);
    assert(/\$catalog\['boss_shmot_drop_pool'\]\[strval\(\$bossId\)\]\[\$modeKey\] \?\? \[\];/.test(body),
        'персональный пул читается из boss_shmot_drop_pool каталога (полная проверка формулы шанса — в boss-personal-shmot-drop-pool.test.js)');
}

console.log('\nTest 4: claimKill() отдаёт shmotAmount в ответе и патчит shmot клиенту');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.lastIndexOf('$this->ops->ok(['));
    const body  = bossesPhp.slice(start, end);
    assert(/'shmotAmount' => \$shmotAmount,/.test(body), 'ответ содержит shmotAmount (0 или 1 — теперь только от персонального дропа)');
    assert(/'shmot',/.test(body.slice(body.indexOf('patchCurrencies'))), 'shmot включён в patchCurrencies — клиент получит обновлённый инвентарь через applyPatch');
}

console.log('\nTest 5: клиент передаёт shmotAmount в попап, boss_result.js больше не содержит мёртвого кода под ним');
{
    const winMarker = combatSrc.indexOf('isWin: true,');
    const start = combatSrc.lastIndexOf('iface._showBossResultPopup({', winMarker);
    const end   = combatSrc.indexOf('});', start);
    const body  = combatSrc.slice(start, end);
    assert(/shmotAmount: res\.shmotAmount \|\| 0,/.test(body), 'shmotAmount из ответа claimKill прокидывается в опции попапа');

    // 22.09.2026 (повторный репорт тем же днём — "фрагмент тоже должен отображаться на попапе
    // ТЫ ПОБЕДИЛ"): условие расширено — иконка теперь показывается и на полную вещь
    // (shmotAmount>0), и на прогресс фрагмента (opts.shmotFragment), см.
    // boss-result-popup-shmot-fragment-icon-and-batch-fixes.test.js.
    assert(/if\(opts\.shmotAmount > 0 \|\| opts\.shmotFragment\)\{/.test(bossResultSrc),
        'boss_result.js показывает иконку и на полную вещь, и на прогресс фрагмента');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
