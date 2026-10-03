/**
 * Test: найдено 24.09.2026 по живому репорту ("УБИТО:0 ЛИМИТ:0/7" сразу после перезагрузки,
 * хотя прямой запрос к БД показал dailyKills=4, keys=4 — данные на сервере целы). Причина:
 * поля с php_type='json' в схеме БД (server/core/models/database.php.trueJSON()) сервер САМ
 * раскодирует в объект при чтении (users.get) — то есть udata['bosses_data'] СРАЗУ после
 * загрузки страницы приходит уже ОБЪЕКТОМ, а не JSON-строкой. Голый JSON.parse(объект) кидает
 * SyntaxError, которую весь код молча глотал в try/catch{} — keys/dailyKills/killsTotal
 * читались как несуществующие и тихо показывались нулями. Хуже — bosses-combat.js._saveToUdata()
 * при этой же ошибке терял (не переносил) поля, которых нет в explicit-списке (bossDamage,
 * personalDamageTotal, instanceStartMs, joinedInstance, friendDmgByUid) — не просто баг
 * отображения. helper.safeParseJSON() (universal_helper.js) принимает и строку, и объект.
 *
 * Run: node tests/bosses-safe-json-parse-object-from-server.test.js
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

const helperSrc = readSrc('_client/src/modules/universal_helper.js');
const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
const selectSrc = readSrc('_client/src/game/shell/overlays/bosses_select.js');
const achSrc    = readSrc('_client/src/game/achievements.js');

console.log('\nTest: helper.safeParseJSON() существует и обрабатывает и строку, и уже готовый объект');
{
    const start = helperSrc.indexOf('safeParseJSON(value, fallback){');
    const end   = helperSrc.indexOf('\n    }', start);
    const body  = helperSrc.slice(start, end);
    assert(!!body && start !== -1, 'safeParseJSON() найден в UniHelp');
    assert(/if\(typeof value === 'object'\) return value;/.test(body), 'объект возвращается как есть, БЕЗ попытки JSON.parse (которая бы кинула исключение)');
    assert(/try\{ return JSON\.parse\(value\); \} catch\(e\)\{ return fallback; \}/.test(body), 'строка по-прежнему парсится через JSON.parse, с безопасным fallback при ошибке');
    assert(/if\(value == null\) return fallback;/.test(body), 'null/undefined тоже безопасно даёт fallback');
}

console.log('\nTest: bosses-combat.js._loadFromUdata() использует helper.safeParseJSON вместо голого JSON.parse');
{
    const start = combatSrc.indexOf('proto._loadFromUdata = function');
    const chunk = combatSrc.slice(start, start + 700);
    assert(/const s = helper\.safeParseJSON\(udata\['bosses_data'\], \{\}\);/.test(chunk),
        '_loadFromUdata() читает bosses_data через helper.safeParseJSON');
    assert(!/const s = JSON\.parse\(udata\['bosses_data'\]\);/.test(chunk), 'голый JSON.parse() здесь больше не используется');
}

console.log('\nTest: bosses-combat.js._saveToUdata() тоже использует helper.safeParseJSON (критично — иначе теряет незнакомые поля при мёрдже)');
{
    const start = combatSrc.indexOf('proto._saveToUdata = function');
    const chunk = combatSrc.slice(start, start + 700);
    assert(/const ex = helper\.safeParseJSON\(udata\['bosses_data'\], \{\}\);/.test(chunk),
        '_saveToUdata() читает существующее состояние через helper.safeParseJSON перед мёрджем');
}

console.log('\nTest: bosses_select.js — чтение dailyKills/killsTotal для карточек боссов тоже защищено');
{
    // 02.10.2026: bd теперь объявляется отдельно (`let bd = {};` до try) и переприсваивается
    // здесь без `const` — та же переменная/вызов, просто другой стиль объявления (var-scope).
    const idx = selectSrc.indexOf("bd = helper.safeParseJSON(udata && udata['bosses_data'], {});");
    assert(idx !== -1, 'bosses_select.js использует helper.safeParseJSON при чтении bosses_data для УБИТО/ЛИМИТ');
}

console.log('\nTest: achievements.js._state() тоже защищено (bossDamage/solo_kills/speed_kills)');
{
    assert(/const bd = helper\.safeParseJSON\(udata\['bosses_data'\], \{\}\);/.test(achSrc), 'bosses_data читается безопасно в achievements._state()');
    assert(/soloKills\s*=\s*helper\.safeParseJSON\(udata\['solo_kills'\],\s*soloKills\)/.test(achSrc), 'solo_kills читается безопасно');
    assert(/speedKills\s*=\s*helper\.safeParseJSON\(udata\['speed_kills'\],\s*speedKills\)/.test(achSrc), 'speed_kills читается безопасно');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
