/**
 * Test: батч 17.09.2026 (четвёртый) по бою с боссами:
 *
 *  1) «Рейтинг урона» теперь по урону ТЕКУЩЕГО боя (curCycleDmg), не пожизненному bossDamage —
 *     сбрасывается сам собой вместе с окончанием боя (curCycleDmg[idx]=0 уже сбрасывается в
 *     трёх местах: таймаут/победа/форфейт). В СОЛО (diff_idx=3) друзья не подмешиваются —
 *     только собственный урон игрока.
 *  2) Синхронизация урона друзей (та же логика, что кнопка ПЕРЕЗАГРУЗКА) теперь вызывается на
 *     КАЖДЫЙ удар БЕЗ дебаунса — раньше была задержка 800мс, из-за которой рейтинг обновлялся
 *     заметно позже самого удара.
 *  3) Экран «Скиллы» (открывается напрямую через skills.open(), в обход общего
 *     openModule()/_closeAllPanels() — у Skills нет публичного close()) теперь принудительно
 *     закрывается при любом из 3 путей завершения боя: таймаут, победа, форфейт (крестик
 *     закрытия самого экрана боя НЕ считается завершением — бой продолжается в фоне).
 *  4) FIGHT_DURATION_MS возвращён на боевые 9 часов (было временно 60 сек. для теста) — только
 *     после проверки, что при истечении/выходе награда не начисляется и ключи не возвращаются.
 *
 * Run: node tests/boss-fight-rating-instant-skills-close-9h-duration.test.js
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

const bossesPhp   = readSrc('server/core/controllers/bosses.php');
const bossesJs     = readSrc('_client/src/game/bosses.js');
const combatSrc    = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightSrc     = readSrc('_client/src/game/shell/overlays/bosses_fight.js');

console.log('\nTest 1: bosses.rating() — по друзьям, curCycleDmg, соло без друзей');
{
    // 22.09.2026 (попап победы над боссом, отдельный батч): rating() разбит на общий
    // _ratingTop() (переиспользован claimKill()) — окно расширено, чтобы захватить обе функции.
    const start = bossesPhp.indexOf('private function _ratingTop(');
    const end   = bossesPhp.indexOf('function killers()');
    const body  = bossesPhp.slice(start, end);

    assert(/\$diffIdx = isset\(\$this->registry\['user_params'\]\['diff_idx'\]\)/.test(body),
        'rating() принимает diff_idx');
    assert(/\$diffIdx !== 3/.test(body), 'друзья подмешиваются только НЕ в соло');
    // 22.09.2026 (по прямому указанию — rating() переехал на boss_damage_log/производный HP,
    // см. большой комментарий в bosses.php над _derivedHp()): своя строка больше не строится
    // через $ids/id IN(...) — читается напрямую через _myFightStart()+_damageSumSince() для
    // себя же, суть "урон текущего боя, не пожизненный bossDamage" не изменилась.
    assert(/\$startMs = \$this->_myFightStart\(\$myData, \$diffIdx, \$bossId\);/.test(body),
        'граница "текущего боя" — bossStartMs МОЕЙ текущей попытки, не пожизненная история');
    // 23.09.2026: добавлен обязательный фильтр boss_id — см. boss-rating-hp-scoped-by-boss-id.test.js.
    // 29.09.2026: вызов получил ещё excludeSedoy=true — см. tests/boss-sedoy-excluded-from-friend-rating.test.js.
    assert(/\$myDmg = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$startMs, true\);/.test(body),
        'читает урон текущего боя из boss_damage_log (через _damageSumSince, с фильтром по boss_id), не curCycleDmg/bossDamage напрямую');
    assert(!/bossDamage/.test(body),
        'старое чтение пожизненного bossDamage полностью убрано из rating()');
}

console.log('\nTest 2: клиент передаёт diff_idx на сервер вместе с запросом рейтинга');
{
    assert(/TS\.php\('bosses\.rating', \{boss_id:bossIdx, diff_idx:diffIdx\}/.test(fightSrc),
        '_fetchBossFightRating отправляет diff_idx (иначе сервер не узнает про соло)');
}

console.log('\nTest 3: синхронизация урона друзей — без задержки, HP уже в самом ответе на удар');
{
    // 22.09.2026: _syncFriendsDamageSoon() и отдельный вызов после каждого удара убраны
    // целиком — ответ bosses.attack() теперь САМ содержит уже готовый производный HP (свой
    // урон + урон друзей суммируются В ОДНОМ И ТОМ ЖЕ запросе, см. bosses.php._derivedHp), так
    // что отдельная досинхронизация после каждого удара больше не нужна — задержки в 0мс, а не
    // "800мс убрано, но всё ещё отдельный запрос".
    assert(!/_syncFriendsDamageSoon/.test(combatSrc), '_syncFriendsDamageSoon полностью убран — больше не нужен как отдельный шаг');
    const attackStart = combatSrc.indexOf('proto._attack = function');
    const attackEnd   = combatSrc.indexOf('\n    };', attackStart);
    const attackBody  = combatSrc.slice(attackStart, attackEnd);
    assert(/this\._setHp\(idx, res\.hp\);/.test(attackBody),
        '_attack() выставляет HP из ответа bosses.attack() — он уже учитывает урон друзей на момент этого удара');
}

console.log('\nTest 4: экран Скиллы закрывается при любом завершении боя (таймаут/победа/форфейт)');
{
    assert(/proto\._closeSkillsIfOpen = function\(\)\{/.test(combatSrc), 'общий хелпер закрытия скиллов определён');
    assert(/if\(window\.skills && skills\._win\) skills\._win\.visible = false;/.test(combatSrc),
        'хелпер напрямую скрывает skills._win (у Skills нет публичного close())');

    const timeoutStart = combatSrc.indexOf('proto._onFightTimeout = function(idx){');
    const timeoutEnd   = combatSrc.indexOf('};', combatSrc.indexOf('notify.showResult', timeoutStart)) + 2;
    assert(/this\._closeSkillsIfOpen\(\);/.test(combatSrc.slice(timeoutStart, timeoutEnd)),
        '_onFightTimeout закрывает скиллы (это и был репорт: попап поражения показался, а вкладка скиллы осталась)');

    // 25.09.2026: окно расширено — guard от гонки _attack()/_syncFriendsDamage() (_claimKillPending)
    // добавил ~15 строк ПЕРЕД _closeSkillsIfOpen(), старое окно 150 символов до него не доставало.
    const defeatStart = combatSrc.indexOf('proto._onDefeat = function(idx){');
    const defeatNear  = combatSrc.slice(defeatStart, defeatStart + 1700);
    assert(/this\._closeSkillsIfOpen\(\);/.test(defeatNear), '_onDefeat (победа) тоже закрывает скиллы — та же потенциальная проблема');

    const forfeitStart = fightSrc.indexOf('proto._forfeitBossFight = function(){');
    // 19.09.2026: окно среза расширено — вызов обзавёлся защитным typeof-условием
    // (`typeof bosses._closeSkillsIfOpen === 'function'`), из-за чего старое окно в 250 символов
    // обрезало саму вызывающую строку до её конца (флаки не по содержанию, а по длине окна).
    // 24.09.2026: расширено ещё раз до 1000 — добавленный большой комментарий про
    // suspendPlayerSave()/гонку с flushPlayerSave (см. boss-defeat-popup-fresh-rating-top-no-race.test.js)
    // отодвинул сам вызов closeSkillsIfOpen дальше от начала функции.
    const forfeitNear  = fightSrc.slice(forfeitStart, forfeitStart + 1100);
    assert(/bosses\._closeSkillsIfOpen\(\)/.test(forfeitNear), '_forfeitBossFight (крестик "выйти из боя") тоже закрывает скиллы');
}

console.log('\nTest 5: FIGHT_DURATION_MS возвращён на 9 часов');
{
    assert(/this\.FIGHT_DURATION_MS = 9 \* 60 \* 60 \* 1000;/.test(bossesJs),
        'боевое время — 9 часов (было временно 60 секунд для теста)');
    assert(!/this\.FIGHT_DURATION_MS = 60 \* 1000;/.test(bossesJs), 'тестовое значение 60 секунд не осталось');
}

console.log('\nTest 6: регресс-гварды — награда/ключи/таймер при истечении/форфейте (уже были верны, закрепляем)');
{
    const timeoutStart = combatSrc.indexOf('proto._onFightTimeout = function(idx){');
    const timeoutEnd   = combatSrc.indexOf('proto._onDefeat');
    const timeoutBody  = combatSrc.slice(timeoutStart, timeoutEnd);
    assert(!/udata\['cigarettes'\]/.test(timeoutBody) && !/udata\['exp'\]/.test(timeoutBody),
        'таймаут не начисляет награду (сигареты/опыт)');
    assert(!/this\.keys\[idx\]\s*\+=/.test(timeoutBody), 'таймаут не возвращает ключи');

    const forfeitStart = fightSrc.indexOf('proto._forfeitBossFight = function(){');
    const forfeitEnd   = fightSrc.indexOf('proto._leaveBossesFight');
    const forfeitBody  = fightSrc.slice(forfeitStart, forfeitEnd);
    assert(!/udata\['cigarettes'\]/.test(forfeitBody) && !/udata\['exp'\]/.test(forfeitBody),
        'форфейт (выйти из боя) не начисляет награду');
    assert(!/bosses\.keys\[idx\]\s*\+=/.test(forfeitBody), 'форфейт не возвращает ключи');

    // Таймер — реальное время (Date.now), не пауза: истечение проверяется по разнице с
    // абсолютным таймштампом старта, а не по счётчику тиков внутри открытого экрана.
    assert(/Date\.now\(\) - start/.test(fightSrc) || /Date\.now\(\) - startMs/.test(combatSrc),
        'таймер боя считается от абсолютного Date.now(), продолжает идти даже если приложение было закрыто');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
