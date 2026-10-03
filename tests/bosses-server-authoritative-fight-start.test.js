/**
 * Test: 17.09.2026 — продолжение шага 2 переноса экономики боссов на сервер.
 *
 * Прямой вопрос пользователя после первой (kill-reward-only) миграции: "сервер не проверяет,
 * что бой по факту шёл. А логика лимита времени на бой — она тоже осталась на клиенте? Разве
 * её не стоит перенести?" — да, была: bossStartMs, списание ключей и HP целиком жили в
 * клиентской памяти (bosses_fight.js._openBossesFight), claimKill() проверял только дневной
 * лимит. Урон/скиллы по-прежнему считает клиент (не переносим — см. первый тест-файл), но
 * теперь:
 *   1) bosses.php.startFight() — новый метод: сервер сам проверяет зачистку локации и ключи,
 *      сам их списывает, сам пишет bossStartMs (серверное время). Идемпотентен для уже
 *      идущего боя (не списывает ключи повторно).
 *   2) bosses.php.claimKill() — дополнительно отклоняет клейм, если для этой пары
 *      диффа/босса нет серверной записи bossStartMs (fail 65), или если прошло больше
 *      MAX_FIGHT_WINDOW_MS — 9ч + максимум возможного бонуса скилла "Повелитель времени"
 *      (fail 66).
 *   3) bosses_fight.js._openBossesFight — при старте НОВОГО боя вызывает bosses.startFight
 *      вместо локального списания ключей/записи bossStartMs; экран открывается только после
 *      подтверждения сервера (перенесено в новую proto._reallyOpenBossesFight).
 *
 * Run: node tests/bosses-server-authoritative-fight-start.test.js
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

const bossesPhp  = readSrc('server/core/controllers/bosses.php');
const fightSrc   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const catalog    = JSON.parse(fs.readFileSync(path.join(root, 'server/json/bosses_config.json'), 'utf-8'));
const bossesJs   = readSrc('_client/src/game/bosses.js');

console.log('\nTest 1: каталог содержит boss_loc для всех 8 боссов, совпадает с bosses.js');
{
    const locRe = /boss_loc:(-?\d+)/g;
    let m, extracted = [];
    while((m = locRe.exec(bossesJs))) extracted.push(parseInt(m[1]));
    assert(extracted.length === 8, 'bosses.js содержит 8 значений boss_loc');
    assert(catalog.bosses.length === 8 && catalog.bosses.every(b => typeof b.boss_loc === 'number'),
        'каталог содержит boss_loc для всех 8 боссов');
    let bad = 0;
    catalog.bosses.forEach((b, i) => { if(extracted[i] !== b.boss_loc) bad++; });
    assert(bad === 0, 'boss_loc каталога совпадает с bosses.js для всех боссов');
}

console.log('\nTest 2: bosses.php.startFight() проверяет зачистку локации и ключи, сам их списывает');
{
    const start = bossesPhp.indexOf('function startFight(){');
    assert(start !== -1, 'startFight() найден в bosses.php');
    const end = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->ops->ok([\'patch\' => $patch, \'bossStartMs\' => $activeStartMs', start));
    const body = bossesPhp.slice(start, end);

    assert(/if\(!\$this->_isLocCleared\(\$user, intval\(\$bossCfg\['boss_loc'\] \?\? -1\)\)\) return \$this->ops->fail\(63\);/.test(body),
        'startFight отклоняет запрос, если локация босса не зачищена (fail 63)');
    // 25.09.2026 (по прямому указанию, аудит "Связки ключей"): проверка/списание ключей теперь
    // завёрнуты в if(!$hasKeyring){...} и используют $keySlot (не $bossId напрямую — Баркут и
    // Борода делят один слот ключа), а не плоский $bossId, как в первой версии этой миграции.
    // См. tests/keyring-security-and-unlimited-boss-attacks.test.js — там отдельно проверено,
    // что для НЕ-владельцев связки проверка/списание ключей работают как прежде.
    assert(/if\(\$needKeys > 0 && intval\(\$data\['keys'\]\[\$keySlot\]\) < \$needKeys\) return \$this->ops->fail\(64\);/.test(body),
        'startFight отклоняет запрос при нехватке ключей (fail 64) — раньше ключи не проверялись вообще');
    assert(/if\(\$needKeys > 0\) \$data\['keys'\]\[\$keySlot\] = intval\(\$data\['keys'\]\[\$keySlot\]\) - \$needKeys;/.test(body),
        'startFight сам списывает ключи на сервере (не доверяя клиенту)');
    assert(/\$data\['bossStartMs'\]\[\$diffIdx\]\[\$bossId\] = \$now;/.test(body),
        'startFight сам пишет bossStartMs — серверное время (microtime), не то, что прислал клиент');
    assert(/\$existing = intval\(\$data\['bossStartMs'\]\[\$diffIdx\]\[\$bossId\] \?\? 0\);\s*\n\s*if\(\$existing > 0\)\{/.test(body),
        'startFight идемпотентен — уже идущий бой не списывает ключи повторно');
}

console.log('\nTest 3: startFight зарегистрирован в permits');
{
    // 27.09.2026: раньше здесь сравнивали $this->permits целиком с точным списком из 8 методов.
    // С тех пор (26.09.2026, по прямому указанию) в permits добавились useSedoy/rushFreeWeapon/
    // buyKey (см. tests/bosses-buy-key-server-authoritative.test.js) — точный список
    // устарел бы при каждой новой фиче. Проверяем только то, что действительно проверяет этот
    // тест-файл: startFight() зарегистрирован как permit (остальные методы/список — не его
    // область ответственности).
    const permitsMatch = bossesPhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch, '$this->permits найден в bosses.php');
    assert(!!permitsMatch && permitsMatch[1].includes("'startFight'"),
        'startFight добавлен в список разрешённых методов роутера');
}

console.log('\nTest 4: claimKill() отклоняет клейм без серверного bossStartMs и при "протухшем" бое');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.lastIndexOf('\t}');
    const body  = bossesPhp.slice(start, end);

    assert(/\$fightStart = intval\(\$data\['bossStartMs'\]\[\$diffIdx\]\[\$bossId\] \?\? 0\);/.test(body),
        'claimKill читает серверный bossStartMs для этой пары диффа/босса');
    assert(/if\(\$fightStart <= 0\) return \$this->ops->fail\(65\);/.test(body),
        'claimKill отклоняет клейм, если бой не был начат через bosses.startFight (fail 65) — раньше проверки не было вовсе');
    assert(/if\(\$elapsed > \$this->MAX_FIGHT_WINDOW_MS\) return \$this->ops->fail\(66\);/.test(body),
        'claimKill отклоняет клейм для "протухшего" боя — прошло больше MAX_FIGHT_WINDOW_MS (fail 66)');
}

console.log('\nTest 5: MAX_FIGHT_WINDOW_MS = FIGHT_DURATION_MS (9ч) + максимум бонуса скилла "Повелитель времени" (60 мин)');
{
    const winMatch = bossesPhp.match(/MAX_FIGHT_WINDOW_MS = (\d+);/);
    assert(!!winMatch, 'MAX_FIGHT_WINDOW_MS найден в bosses.php');
    const fightDurMatch = bossesJs.match(/FIGHT_DURATION_MS = (\d+) \* (\d+) \* (\d+) \* (\d+)/);
    assert(!!fightDurMatch, 'FIGHT_DURATION_MS найден в bosses.js');
    const fightDur = fightDurMatch.slice(1, 5).reduce((a, b) => a * parseInt(b), 1);
    assert(fightDur === 32400000, 'FIGHT_DURATION_MS = 9ч в мс (32 400 000)');

    const skillsJs = readSrc('_client/src/game/skills.js');
    // Skill id:10 "Повелитель времени" — maxLvl:30, getTimeBonus() = floor(60*lvl/30) → максимум 60 минут.
    assert(/id:10, name:'Повелитель времени',   maxLvl:30/.test(skillsJs),
        'skills.js: у скилла "Повелитель времени" maxLvl не изменился (иначе пересчитать максимум бонуса)');
    assert(/getTimeBonus\(\)\{\s*return this\.levels\[10\] > 0 \? Math\.floor\(60 \* this\.levels\[10\] \/ 30\) : 0;/.test(skillsJs),
        'skills.js: формула getTimeBonus() не изменилась (иначе пересчитать максимум бонуса на сервере)');

    const maxTimeBonusMs = 60 * 60 * 1000; // 60 минут макс. бонуса
    assert(parseInt(winMatch[1]) === fightDur + maxTimeBonusMs,
        'MAX_FIGHT_WINDOW_MS = 9ч (32400000) + 60мин макс.бонуса (3600000) = 36000000 — сервер щедр, т.к. скиллы не перенесены');
}

console.log('\nTest 6: bosses_fight.js._openBossesFight — новый бой идёт через сервер, а не локальную запись');
{
    const startIdx = fightSrc.indexOf('if(!bosses._bossStartMs[di][bossIdx]){');
    const endIdx   = fightSrc.indexOf("return; // экран откроется в колбэке успеха", startIdx);
    assert(startIdx !== -1 && endIdx !== -1, 'блок "новый бой" найден в _openBossesFight');
    const block = fightSrc.slice(startIdx, endIdx);

    assert(/TS\.php\('bosses\.startFight', \{boss_id: bossIdx, diff_idx: di\}/.test(block),
        '_openBossesFight вызывает bosses.startFight вместо локального списания ключей');
    assert(!/bosses\.keys\[bossIdx\] -= need;/.test(block),
        '_openBossesFight больше не списывает ключи локально ДО ответа сервера');
    assert(/applyPatch\(res\.patch\);/.test(block), '_openBossesFight применяет патч от сервера (bosses_data)');
    assert(/this\._reallyOpenBossesFight\(bossIdx\);/.test(block),
        'экран боя открывается только ПОСЛЕ подтверждения сервера (в колбэке успеха)');
    assert(/this\._openSidorovichError\('Не удалось начать бой'/.test(fightSrc.slice(startIdx)),
        'при отказе сервера (нет ключей/локация) игрок видит понятную ошибку, а не зависает');
}

console.log('\nTest 7: applyPatch импортирован в bosses_fight.js');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/\.\.\/modules\/patch\.js';/.test(fightSrc), 'applyPatch импортирован');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
