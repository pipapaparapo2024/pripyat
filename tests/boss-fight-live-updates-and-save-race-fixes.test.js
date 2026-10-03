/**
 * Test: батч 22.09.2026 (по прямому указанию, связка репортов про бой с боссом) —
 *
 *  1) "Рейтинг урона и полоска опыта скиллов обновляются только по кнопке ПЕРЕЗАГРУЗИТЬ, а не
 *     сразу при ударе": сервер честно считает/логирует урон на КАЖДЫЙ удар (boss_damage_log),
 *     но колбэк ответа `bosses.attack` в bosses-combat.js не перерисовывал экран боя вообще —
 *     ни HP-бар боя (`_bossFightHpBar`), ни панель "ОЧКИ/НОВЫЕ"+прогресс-бар скиллов
 *     (`_updateBossFightStats`), ни список "РЕЙТИНГ УРОНА" (`_loadBossFightRating`).
 *     `_attackWithWeapon()` (bosses_fight.js) зовёт те же функции, но СИНХРОННО сразу после
 *     `bosses._attack()` — то есть ДО прихода асинхронного ответа, на ещё старых данных.
 *
 *  2) "Иногда бой пропадает при обновлении страницы": гонка между общим 500мс-дебаунсом
 *     автосейва (player-save.js, шлёт СНИМОК udata['bosses_data'] из памяти клиента) и прямой
 *     server-authoritative записью bosses.startFight() (Gameops::saveUser, в обход whitelist-
 *     санитайзеров users.save) — устаревший снимок, поставленный в очередь ДО старта боя, мог
 *     долететь ПОСЛЕ и стереть свежий bossStartMs. Тот же класс гонки, что уже чинили для
 *     yashik.js (flushPlayerSave перед read-modify-write запросом).
 *
 *  3) "При перезаходе достижения появляются заново": achievements.js полагался ТОЛЬКО на общий
 *     500мс-дебаунс — ачивка часто зарабатывается прямо в бою; релоад в пределах 500мс терял
 *     `earned` вместе с несохранённым автосейвом, попап показывался повторно при следующем
 *     пересечении того же порога.
 *
 * Run: node tests/boss-fight-live-updates-and-save-race-fixes.test.js
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

const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightSrc  = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const achSrc    = readSrc('_client/src/game/achievements.js');

console.log('\nTest 1: bosses-combat.js._attack() — колбэк ответа сервера перерисовывает HP боя, полоску скиллов И рейтинг урона сразу после applyPatch');
{
    const start = combatSrc.indexOf("TS.php('bosses.attack'");
    const end   = combatSrc.indexOf("}, (err) => {", start);
    assert(start !== -1 && end !== -1, 'колбэк bosses.attack найден');
    const body = combatSrc.slice(start, end);

    assert(/applyPatch\(res\.patch\);/.test(body), 'применяет patch с сервера (без этого дальнейшие вызовы читали бы старые данные)');
    assert(/if\(window\.skills\) skills\._loadLevelsFromUdata\(\);/.test(body), 'перечитывает свежие уровни/очки скиллов из patch');
    assert(/if\(typeof iface\._updateBossFightHpDisplay === 'function'\) iface\._updateBossFightHpDisplay\(\);/.test(body),
        'перерисовывает HP-бар экрана боя (_bossFightHpBar) сразу после ответа сервера');
    assert(/if\(typeof iface\._updateBossFightStats === 'function'\) iface\._updateBossFightStats\(\);/.test(body),
        'перерисовывает полоску опыта скиллов (ОЧКИ/НОВЫЕ) сразу после ответа сервера');
    assert(/if\(typeof iface\._loadBossFightRating === 'function'\) iface\._loadBossFightRating\(idx\);/.test(body),
        'перезапрашивает "РЕЙТИНГ УРОНА" (мой + друзей) сразу после КАЖДОГО удара, не только по кнопке ПЕРЕЗАГРУЗИТЬ');
    // Порядок важен — обновления UI должны идти ПОСЛЕ applyPatch/_loadLevelsFromUdata, иначе
    // читали бы данные до их обновления.
    const iApply = body.indexOf('applyPatch(res.patch);');
    const iSkills = body.indexOf("skills._loadLevelsFromUdata();");
    const iHp = body.indexOf('iface._updateBossFightHpDisplay();');
    const iStats = body.indexOf('iface._updateBossFightStats();');
    const iRating = body.indexOf('iface._loadBossFightRating(idx);');
    assert(iApply < iSkills && iSkills < iHp && iHp < iStats && iStats < iRating,
        'порядок вызовов: applyPatch → _loadLevelsFromUdata → HP-дисплей → статы скиллов → рейтинг урона');
}

console.log('\nTest 2: bosses_fight.js — bosses.startFight() обёрнут в flushPlayerSave (ждёт завершения флаша ПЕРЕД стартом боя)');
{
    assert(/import \{ flushPlayerSave \} from '\.\.\/\.\.\/\.\.\/modules\/player-save\.js';/.test(fightSrc),
        'flushPlayerSave импортирован из modules/player-save.js');

    const start = fightSrc.indexOf("flushPlayerSave('boss_start_fight', () => {");
    assert(start !== -1, "flushPlayerSave('boss_start_fight', ...) найден");
    const tsCallIdx = fightSrc.indexOf("TS.php('bosses.startFight'", start);
    assert(tsCallIdx !== -1 && tsCallIdx > start, 'TS.php(bosses.startFight) вызывается ВНУТРИ колбэка flushPlayerSave (после завершения флаша, не параллельно)');

    // Закрывающая скобка-обёртка должна идти ПОСЛЕ error-колбэка startFight, но ДО return —
    // убеждаемся, что flushPlayerSave реально оборачивает весь TS.php-вызов целиком (успех+ошибку).
    const errCbIdx = fightSrc.indexOf("this._openSidorovichError('Не удалось начать бой'", tsCallIdx);
    const wrapCloseIdx = fightSrc.indexOf("}); // flushPlayerSave('boss_start_fight', ...)", errCbIdx);
    assert(errCbIdx !== -1 && wrapCloseIdx !== -1 && wrapCloseIdx > errCbIdx,
        'обёртка flushPlayerSave закрывается ПОСЛЕ обоих колбэков (успех и ошибка) TS.php(bosses.startFight)');
}

console.log('\nTest 3: achievements.js — flushPlayerSave вызывается СРАЗУ после появления нового достижения (не ждёт общий 500мс-дебаунс)');
{
    assert(/import \{ flushPlayerSave \} from '\.\.\/modules\/player-save\.js';/.test(achSrc),
        'flushPlayerSave импортирован из modules/player-save.js');

    // 23.09.2026 (перенос достижений на сервер): достижения теперь server-authoritative —
    // вместо "flush затем сам пишет udata" клиент flush'ит (чтобы сервер увидел свежие
    // счётчики), затем ЗОВЁТ СЕРВЕР (achievements.sync), а не пишет udata сам.
    const start = achSrc.indexOf('_checkAll(){');
    const end   = achSrc.indexOf('\n\tgetTotalStars(){', start);
    const body  = achSrc.slice(start, end);
    assert(/if\(changed\) this\._syncWithServer\(\);/.test(body),
        '_checkAll зовёт _syncWithServer ТОЛЬКО когда changed=true (реально пересечён порог)');
    assert(/flushPlayerSave\('achievement_earned', \(\) => \{/.test(body),
        '_syncWithServer флашит автосейв ПЕРЕД запросом к серверу (свежие счётчики должны долететь до БД первыми)');
    assert(/TS\.php\('achievements\.sync', \{\}, \(res\) => \{/.test(body),
        '_syncWithServer зовёт achievements.sync ПОСЛЕ флаша, внутри его колбэка');
}

console.log('\nTest 4: _finalizeSkillSession() на сервере обнуляет прогресс скиллов БЕЗУСЛОВНО (22.09.2026: убрали leveled-check по прямому указанию — см. skills-always-reset-progress-on-new-fight.test.js)');
{
    const bossesPhp = readSrc('server/core/controllers/bosses.php');
    const start = bossesPhp.indexOf('function _finalizeSkillSession(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(!/if\(\$earned <= \$sessionStart\)\{/.test(body), 'условная проверка левелапа убрана — сброс больше не пропускается, если очко было получено');
    assert(/\$state\['dmgSpent'\] = \$this->_skillTotalDmgForPoints\(\$sCatalog, \$earned\);/.test(body),
        'прогресс безусловно откатывается до "пола" уже заработанных очков (обнуление после каждого боя)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
