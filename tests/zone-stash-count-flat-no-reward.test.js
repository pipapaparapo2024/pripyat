/**
 * Test: батч 25.09.2026 (по прямому указанию, в два шага) — нычки Зоны:
 *
 *  1) Изначально найден живой краш ("Uncaught TypeError: Cannot create property 'cards' on
 *     string '[object Object]1'", зависание при прохождении локации). Корень: udata['stash_data']
 *     использовался ОДНОВРЕМЕННО двумя независимыми фичами с несовместимыми форматами —
 *     achievements.js.onStashCollect() писал плоский счётчик {key: number}, а zone.php/zone.js
 *     писали туда же богатый объект {key: {cards, completed}} с наградой за собранную полную
 *     коллекцию. Коллизия форматов роняла клиент.
 *
 *  2) По прямому указанию тем же днём — "нычки визуально не готовы, находка сейчас не должна
 *     иметь НИКАКОГО функционала: просто счётчик в БД, без классификации по типу и без
 *     награды; когда появится арт, тогда включим полную логику обмена; нычка есть нычка, не
 *     классифицируй" — вместо промежуточного фикса (отдельное поле под тот же per-key формат)
 *     ВСЯ per-key логика в zone.php/zone.js убрана целиком. Теперь: 15%-й шанс (не изменился),
 *     плоский udata['stash_count']++, без темы/типа, без сигарет/опыта за коллекцию.
 *
 *  3) Старая, УЖЕ СУЩЕСТВОВАВШАЯ система из 14 пар пер-типовых достижений (achievements.js,
 *     cat:'stash', "Первый след"/"Сборщик находок" и т.д., привязанных к конкретным типам нычек)
 *     стала недостижимой (классифицировать больше нечем) — по прямому указанию ОТКЛЮЧЕНА
 *     (закомментирована), НЕ удалена — «мёртвый код, потом оживим».
 *
 * Run: node tests/zone-stash-count-flat-no-reward.test.js
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

const zonePhp = read('server/core/controllers/zone.php');
const zoneJs  = read('_client/src/game/zone.js');
const achSrc  = read('_client/src/game/achievements.js');
const usersSrc = read('server/core/controllers/users.php');
const devSrc  = read('_client/src/game/shell/overlays/dev_panel.js');

console.log('\n1) zone.php.fillCheckpoint() — плоский stash_count, без классификации, без награды, без _loadStashProgress()');
{
    const start = zonePhp.indexOf('function fillCheckpoint(){');
    const end   = zonePhp.indexOf('function captureLocation(){');
    const body  = zonePhp.slice(start, end);
    assert(/if\(mt_rand\(1, 100\) <= 15\)\{/.test(body), '15% шанс выпадения не изменился');
    assert(/\$user\['stash_count'\] = \$this->ops->i\(\$user, 'stash_count'\) \+ 1;/.test(body),
        'плоский инкремент stash_count на каждую находку');
    assert(!/chosenKey|stashProgress|locCfg\['stash'\]\['keys'\]/.test(body),
        'никакой классификации по типу нычки (chosenKey/stashProgress/локационные ключи) не осталось');
    assert(!/'cigarettes', intval\(\$locCfg\['stash'\]|'exp', intval\(\$locCfg\['stash'\]/.test(body),
        'награда сигаретами/опытом за коллекцию убрана целиком');
    assert(!zonePhp.includes('_loadStashProgress'), '_loadStashProgress() (per-key загрузчик) удалён из файла целиком');
}

console.log('\n2) zone.php — stash_count в списке patchCurrencies вместо старого stash_data');
{
    assert(/'zone','stash_count',/.test(zonePhp), 'patchCurrencies() отдаёт stash_count клиенту');
}

console.log('\n3) zone.js — блок "ЗАНАЧКИ" упрощён до одной строки (показ "+1"), без per-key/achievements-вызова');
{
    const start = zoneJs.indexOf('cp.filled++;');
    const end   = zoneJs.indexOf('if(window.achievements) achievements.onEnergySpent', start);
    const body  = zoneJs.slice(start, end);
    assert(/if\(res\.stash && res\.stash\.dropped\) this\._showStashPickup\(\);/.test(body),
        'единственное действие на находку — плавающая иконка "+1", без ветвления по completed/reward');
    const bodyCodeOnly = body.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!/achievements\.onStashCollect/.test(bodyCodeOnly), 'вызов achievements.onStashCollect() убран из места сбора заначки (исполняемый код, не пояснительный комментарий)');
    assert(!/_showRewardPopup\(\[.Заначка/.test(body), 'попап "Заначка «X» собрана! +N сигарет" убран');
}

console.log('\n4) zone.js — мёртвые per-key методы удалены (_tryDropStash/_renderStashPanel/_saveStash/_loadStash); _stashProgress тоже удалён (28.09.2026 — последний читатель, legacy-панель, снесён целиком)');
{
    assert(!/_tryDropStash\(locIdx\)\{/.test(zoneJs), '_tryDropStash() (дважды мёртвый код — никогда не вызывался) удалён');
    // Собственная (дублирующая) копия _renderStashPanel в самом zone.js удалена — единственная
    // версия жила в legacy/zone_panel_legacy.js, который сам удалён (см. Test 6).
    assert(!/_renderStashPanel\(locIdx\)\{\s*if\(!this\.win\.stash_txt\)/.test(zoneJs),
        'дублирующая копия _renderStashPanel внутри zone.js убрана (легаси-версия была источником истины, теперь снесена)');
    assert(!/_saveStash\(\)\{/.test(zoneJs) && !/_loadStash\(\)\{/.test(zoneJs),
        '_saveStash()/_loadStash() (писали/читали удалённый per-key формат) удалены из zone.js');
    assert(!/this\._stashProgress/.test(zoneJs),
        '_stashProgress больше не объявляется и не читается в zone.js — единственный читатель (legacy-панель) удалён 28.09.2026, поле стало мёртвым');
}

console.log('\n5) achievements.js — 14 пар пер-типовых достижений по нычкам ЗАКОММЕНТИРОВАНЫ (не удалены), onStashCollect() отключён (тело закомментировано)');
{
    // Идентификаторы больше не должны встречаться как ЖИВЫЕ (не закомментированные) записи
    // каталога — codeOnly фильтрует строки-комментарии перед проверкой.
    const codeOnly = achSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!/id:'st_k_lezv1'/.test(codeOnly), 'st_k_lezv1 больше не активная запись каталога (только в комментарии)');
    assert(!/id:'st_y_kegl10'/.test(codeOnly), 'st_y_kegl10 (последняя из 30 записей) больше не активна');
    assert(!codeOnly.includes("check:s=>(s.stash['k_lezv']||0)>=1"), 'check-функция per-key достижения не выполняется исполняемым кодом');
    // Но текст ДОЛЖЕН остаться в файле целиком (закомментирован, не удалён).
    assert(achSrc.includes("id:'st_k_lezv1'"), 'запись st_k_lezv1 физически осталась в файле (просто закомментирована)');
    assert(achSrc.includes("id:'st_y_kegl10'"), 'запись st_y_kegl10 физически осталась в файле');

    const start = achSrc.indexOf('onStashCollect(stashKey){');
    const end   = achSrc.indexOf('\n\t}', start);
    const body  = achSrc.slice(start, end);
    assert(!/^\s*stash\[stashKey\]/m.test(body.split('\n').filter(l=>!l.trim().startsWith('//')).join('\n')),
        'тело onStashCollect() не выполняет реальной логики (закомментировано)');
    assert(body.includes('stash[stashKey]'), 'старое тело физически осталось в файле как комментарий');
}

console.log('\n6) game/legacy/ — папка удалена целиком (28.09.2026, по прямому указанию); zone_panel_legacy.js был единственным читателем _stashProgress и не открывался в реальном UI (его win/tabs никогда не добавлялись в stage — см. Test 4)');
{
    assert(!fs.existsSync(path.join(root, '_client/src/game/legacy')), 'папка _client/src/game/legacy больше не существует');
}

console.log('\n7) users.php — whitelist и default-user: stash_count (новое), stash_data остаётся ТОЛЬКО за achievements.js');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): 'roulette_winner' убран из этой же
    // строки whitelist отдельным фиксом (см. roulette-winner-nickname-server-authoritative.test.js)
    // — теперь его пишет только сервер. stash_data/stash_count по-прежнему в whitelist.
    assert(/'stash_data','stash_count',/.test(usersSrc), 'оба поля в whitelist — stash_data (achievements) и stash_count (zone)');
    assert(/'stash_count'=>'0'/.test(usersSrc), 'stash_count имеет дефолт \'0\' для нового игрока');
}

console.log('\n8) dev_panel.js — сброс аккаунта обнуляет stash_count (было stash_data + zone_stash_progress), и не вызывает удалённый zone._loadStash()');
{
    assert(/stash_data:'', stash_count:'0',/.test(devSrc), 'reset-объект содержит оба поля с корректными дефолтами');
    const devCodeOnly = devSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!/zone\._loadStash\(\)/.test(devCodeOnly), 'удалённый метод zone._loadStash() больше не вызывается из dev-панели (исполняемый код, не пояснительный комментарий)');
    assert(!/zone\._stashProgress/.test(devSrc), 'dev-панель больше не трогает zone._stashProgress — поле удалено из Zone вместе с legacy-панелью (28.09.2026)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
