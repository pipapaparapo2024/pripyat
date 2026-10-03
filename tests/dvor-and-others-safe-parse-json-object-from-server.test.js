/**
 * Test: батч 24.09.2026 (по прямому указанию, скриншот — покер снова показывает "0/25" платных
 * попыток за тушёнку, при этом клик по игре сразу отвечает "ЛИМИТ 25 ИГР... НА СЕГОДНЯ").
 *
 * dvor-daily-limit-no-client-date-comparison.test.js уже чинил ОДНУ причину этого же симптома
 * (клиент сравнивал серверную дату со своей — VPN/часовой пояс). Но раскладка нового скриншота
 * показала: настоящая, БОЛЕЕ ЧАСТАЯ причина — это ТОТ ЖЕ класс бага, что уже чинили в
 * bosses-combat.js/bosses_select.js/achievements.js этой же сессией (bosses-safe-json-parse-
 * object-from-server.test.js): Database::trueJSON() на сервере раскодирует ВСЕ json-поля
 * (включая dvor_daily/dvor_games_data/dvor_daily_sigs) в объект НА КАЖДОМ users.get() —
 * прямо сразу после захода в игру/возврата на вкладку. Raw JSON.parse(udata['dvor_daily'])
 * на уже-объекте кидает SyntaxError, catch(e){ this._resetDaily(); } в dvor.js молча
 * подставлял 0/25 — хотя реальный счётчик на сервере уже был исчерпан. Тот же паттерн (raw
 * JSON.parse на udata[...] без учёта, что это может быть уже готовый объект) нашёлся ещё
 * в 14 других файлах при полном аудите по запросу пользователя — все переведены на
 * helper.safeParseJSON(value, fallback) (universal_helper.js), который принимает и строку,
 * и уже раскодированный объект.
 *
 * Run: node tests/dvor-and-others-safe-parse-json-object-from-server.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

console.log('\nTest 1: dvor.js — 3 места (_loadData/_loadDaily/_getSigState) переведены на safeParseJSON');
{
    const src = read('_client/src/game/dvor.js');
    assert(/this\._data = udata\['dvor_games_data'\] \? helper\.safeParseJSON\(udata\['dvor_games_data'\], null\) : null;/.test(src),
        '_loadData() читает dvor_games_data через safeParseJSON');
    assert(/const d = helper\.safeParseJSON\(udata\['dvor_daily'\], \{\}\);/.test(src),
        '_loadDaily() читает dvor_daily через safeParseJSON — именно здесь жил баг "0/25"');
    assert(/const d = helper\.safeParseJSON\(udata\['dvor_daily_sigs'\], \{\}\);/.test(src),
        '_getSigState() читает dvor_daily_sigs через safeParseJSON');
    assert(!/JSON\.parse\(udata\[/.test(src), 'в dvor.js не осталось ни одного сырого JSON.parse(udata[...])');
}

console.log('\nTest 2: полный аудит по запросу пользователя — ни одного сырого JSON.parse(udata[...]) во всём client/src');
{
    const { execSync } = require('child_process');
    let out = '';
    try{
        out = execSync('grep -rn "JSON\\.parse(udata" _client/src/ | grep -v safeParseJSON', { cwd: root }).toString();
    } catch(e){
        out = (e.stdout || '').toString(); // grep возвращает exit 1, если совпадений нет — это ожидаемый "успех"
    }
    assert(out.trim() === '', 'ни одного сырого JSON.parse(udata[...]) не осталось (' + (out ? out.split('\n').length + ' совпадений' : '0 совпадений') + ')');
}

console.log('\nTest 3: точечная проверка нескольких других переведённых файлов (не только dvor.js)');
{
    const cases = [
        ['_client/src/game/achievements.js', /this\.earned = helper\.safeParseJSON\(udata\['achievements'\], \{\}\) \|\| \{\};/],
        ['_client/src/game/base.js',        /const bb = helper\.safeParseJSON\(udata\['base_buildings'\], \[\]\);/],
        ['_client/src/game/battlepass.js',  /this\.claimed  = helper\.safeParseJSON\(udata\['bp_claimed'\], \{\}\);/],
        ['_client/src/game/bosses.js',      /const saved = helper\.safeParseJSON\(udata\['zone'\], \{\}\);/],
        ['_client/src/game/bot.js',         /const saved = helper\.safeParseJSON\(udata\['bot_settings'\], \[\]\);/],
        ['_client/src/game/dvor/dvor-roulette.js', /const w = helper\.safeParseJSON\(udata\['roulette_winner'\], null\);/],
        ['_client/src/game/gangs.js',       /const saved = helper\.safeParseJSON\(udata\['gang_data'\], \[\]\);/],
        // 24.09.2026 (перенос экономики хабара на сервер): habar.js больше не парсит
        // udata['weapons'] сам — вся логика открытия/наград переехала в habar.php, клиент
        // только применяет res.patch и, если patch.weapons присутствует, зовёт
        // weapons._loadFromUdata() (см. habar.js:285-287) — safeParseJSON здесь больше не нужен.
        ['_client/src/game/hapuga.js',      /this\.soldOut         = helper\.safeParseJSON\(udata\['hapuga_sold'\], \{\}\);/],
        ['_client/src/game/shell/overlays/bosses_skills.js', /return helper\.safeParseJSON\(udata\['skills_data'\], \[\]\);/],
        ['_client/src/game/shell/overlays/hata.js', /return helper\.safeParseJSON\(udata\['base_bg_owned'\], \[0\]\);/],
        ['_client/src/game/shmot.js',       /const saved = helper\.safeParseJSON\(udata\['shmot'\], null\);/],
        ['_client/src/game/vassilich.js',   /inv = helper\.safeParseJSON\(udata\['inventory'\], \[\]\);/],
        ['_client/src/game/weapons.js',     /const saved = helper\.safeParseJSON\(udata\['weapons'\], null\);/],
        // 25.09.2026: zone.js больше НЕ парсит udata через safeParseJSON для нычек — per-key
        // _stashProgress/_loadStash() убраны целиком (плоский stash_count не требует парсинга
        // на клиенте вообще), см. tests/zone-stash-count-flat-no-reward.test.js. Запись про
        // zone.js убрана из этого списка соответственно.
    ];
    cases.forEach(([file, re]) => {
        const src = read(file);
        assert(re.test(src), file + ' переведён на safeParseJSON');
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
