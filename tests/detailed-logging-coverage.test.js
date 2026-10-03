/**
 * Test: подробное логирование (правило №8 CLAUDE.md) для всех багов, разобранных 15.09.2026 —
 * автовыход по таймеру, бесплатная прокачка скилла 0, свап в блэкджеке, резолв рейтинга/убийцы,
 * жизненный цикл сессии скиллов (beginSession/addFightDamage/_onDefeat). Логи нужны, чтобы при
 * повторном проявлении любого из этих багов сразу было видно, что именно пошло не так, без
 * повторной слепой раскопки кода.
 *
 * Run: node tests/detailed-logging-coverage.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);
const skillsSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'skills.js'), 'utf-8'
);
const fightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const selectSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8'
);

console.log('\nTest 1: жизненный цикл сессии скиллов — beginSession/addFightDamage/_onDefeat логируют состояние');
{
    assert(/console\.log\('\[skills\.beginSession\] новая попытка боя началась/.test(skillsSrc),
        'beginSession логирует зафиксированный sessionStartPoints');
    assert(/console\.log\('\[skills\.addFightDamage\]/.test(skillsSrc),
        'addFightDamage логирует прирост skillsDmgSpent и earnedPoints до/после');
    assert(/console\.log\('\[skills\._endSession\] безусловный сброс прогресса до следующего очка/.test(skillsSrc),
        '_endSession логирует earnedPoints и итоговый skillsDmgSpent (22.09.2026: сброс теперь безусловный, без leveled-check)');
    assert(/console\.log\('\[bosses-combat\._onDefeat\] босс повержен/.test(combatSrc),
        '_onDefeat логирует контекст ДО вызова resetSession');
}

console.log('\nTest 2: автовыход по таймеру логирует причину и контекст');
{
    assert(/console\.log\('\[bosses-combat\._onFightTimeout\] время боя истекло автоматически/.test(combatSrc),
        '_onFightTimeout логирует имя босса/idx/diffIdx в момент срабатывания');
}

// 18.09.2026 (по прямому указанию, отдельно от переноса Скиллов на сервер): бесплатная
// прокачка первого уровня скилла 0 убрана целиком — логировать больше нечего, upgrade()
// теперь единообразно логирует запрос/ответ для ЛЮБОГО skill_id (проверено ниже).
console.log('\nTest 3: skills.upgrade() логирует запрос и ответ сервера единообразно для любого скилла (льготы больше нет)');
{
    assert(!/разовая бесплатная прокачка скилла 0/.test(skillsSrc), 'лог про льготу удалён вместе с самой льготой');
    assert(/console\.log\('\[skills\.upgrade\] → сервер \| skill:'/.test(skillsSrc), 'логирует уходящий запрос (skill/level/earned/available)');
    assert(/console\.log\('\[skills\.upgrade\] ← ответ сервера:'/.test(skillsSrc), 'логирует ответ сервера');
}

console.log('\nTest 4: резолв рейтинга урона (bosses_fight.js) логирует сырые данные с сервера и результат резолва');
{
    // 22.09.2026: _ratingPeaks (мёрж с "пиками") убран целиком — рейтинг теперь читает
    // boss_damage_log заново на каждый запрос, промежуточного шага "мёрж" больше нет, поэтому
    // и логировать отдельно "сырой live[] до мёржа" не нужно — логируется сразу итоговый top
    // от сервера, до резолва имён/фото (см. boss-rating-log-based-no-stale-peaks-cache.test.js).
    assert(/console\.log\('\[bosses_fight\._fetchBossFightRating\] boss='\+bossIdx\+' diff='\+diffIdx\+' записей от сервера:', JSON\.stringify\(top\)\);/.test(fightSrc),
        'логирует сырой top[] от bosses.rating ДО резолва имён-фото');
    assert(/console\.log\('\[bosses_fight\._fetchBossFightRating\] _resolveVkUsers вернул:'/.test(fightSrc),
        'логирует результат _resolveVkUsers целиком');
    assert(/console\.log\('\[bosses_fight\._fetchBossFightRating\] строка', i, '\| id:', entry\.id, '\| найден в users:'/.test(fightSrc),
        'логирует построчно — найден ли конкретный id, есть ли имя/фото (видно, на каком именно id обрыв)');
}

console.log('\nTest 5: резолв "убившего" (bosses_select.js) и VK users.get логируют сырые данные');
{
    assert(/console\.log\('\[bosses_select\] killer boss='\+k\.boss_id\+' id='\+k\.id\+' resolved:'/.test(selectSrc),
        'bosses_select логирует резолв каждого killer-id (виден ли, есть ли фото)');
    assert(/console\.log\('\[bosses\._resolveVkUsers\] запрашиваю users\.get \| ids:'/.test(combatSrc),
        '_resolveVkUsers логирует какие именно id уходят в VK users.get и есть ли VK_token');
    assert(/console\.log\('\[bosses\._resolveVkUsers\] сырой ответ VKWebAppCallAPIMethod:'/.test(combatSrc),
        '_resolveVkUsers логирует СЫРОЙ ответ VK API (виден полный response или ошибка/пустой массив)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
