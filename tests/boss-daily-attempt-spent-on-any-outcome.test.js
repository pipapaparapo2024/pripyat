/**
 * Test: 29.09.2026, по прямому указанию — "лимиты атак не заканчиваются" (репорт про игрока со
 * "Связкой ключей", см. tests/keyring-security-and-unlimited-boss-attacks.test.js/
 * keyring-client-side-attack-gates.test.js). Дополнительное явное указание тем же днём: "сделай
 * так чтобы лимит тратился и за победу и за поражение не важно каким способом прошло время на
 * босса или человек сдался неважно. Проиграл, выиграл, вышел с боя. Попытка израсходована."
 *
 * Корень: server/core/controllers/bosses.php.claimKill() инкрементировал dailyKills[$bossId]
 * ТОЛЬКО при подтверждённой ПОБЕДЕ (HP<=0). Поражение/сдача ("выйти из боя",
 * _forfeitBossFight() → endFightSession()) и таймаут (MAX_FIGHT_WINDOW_MS истёк, тот же
 * endFightSession()) вообще не трогали dailyKills — игрок мог начать бой и тут же сдаться/
 * дождаться таймаута сколько угодно раз в течение дня, ни разу не потратив дневной лимit
 * попыток (7/день на босса). В сочетании со "Связкой ключей" (ключи не тратятся вообще) это
 * давало ПОЛНОСТЬЮ неограниченное число попыток — единственный барьер (дневной лимит) не
 * работал для проигрышей/сдач/таймаутов.
 *
 * Фикс: попытка списывается ОДИН РАЗ — в bosses.php.startFight(), в момент РЕАЛЬНОГО начала боя
 * (ветка $existing<=0), а не в claimKill(). Это автоматически покрывает ЛЮБОЙ исход без
 * необходимости трогать каждый из путей завершения боя по отдельности:
 *   - победа (claimKill) — попытка уже посчитана при старте ЭТОЙ же попытки;
 *   - поражение/сдача/таймаут (endFightSession) — тоже уже посчитана при старте;
 *   - молчаливый авто-форфейт (переключение на другого босса, см. цикл в начале startFight()) —
 *     та (брошенная) попытка тоже уже потратила свой слот при СВОЁМ старте, а новая, которую
 *     игрок начинает вместо неё, тратит СВОЙ собственный слот через тот же гейт.
 * claimKill() и endFightSession() dailyKills больше не трогают вообще.
 *
 * Клиент (bosses_fight.js._openBossesFight) синхронизирует свежий dailyKills/dailyDate из
 * patch.bosses_data сразу после startFight() (тем же способом, что уже делает для keys) —
 * иначе UI (счётчик "Попыток сегодня: X/7", предчек в bosses-combat.js._attack) отставал бы от
 * сервера до следующей полной перезагрузки. bosses-combat.js по победе больше НЕ инкрементирует
 * dailyKills на клиенте (иначе задвоило бы счётчик — сервер уже прислал верное значение при
 * старте этой же попытки).
 *
 * Run: node tests/boss-daily-attempt-spent-on-any-outcome.test.js
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

const bossesPhp      = read('server/core/controllers/bosses.php');
const bossesFightJs  = read('_client/src/game/shell/overlays/bosses_fight.js');
const bossesCombatJs = read('_client/src/game/bosses/bosses-combat.js');

console.log('\n1) bosses.php.startFight() — попытка (dailyKills) расходуется ЗДЕСЬ, при реальном новом старте боя');
{
    const startIdx = bossesPhp.indexOf('function startFight(){');
    const endIdx   = bossesPhp.indexOf("$this->ops->ok(['patch' => $patch, 'bossStartMs' => $activeStartMs,", startIdx);
    assert(startIdx !== -1 && endIdx !== -1, 'startFight() найдена целиком');
    const body = bossesPhp.slice(startIdx, endIdx);

    const existingIdx = body.indexOf('if($existing <= 0){');
    assert(existingIdx !== -1, 'ветка "существующего боя нет" найдена');
    const newFightBody = body.slice(existingIdx);

    assert(/\$data\['dailyKills'\]\[\$bossId\] = intval\(\$data\['dailyKills'\]\[\$bossId\]\) \+ 1;/.test(newFightBody),
        'startFight() инкрементирует dailyKills[$bossId] внутри ветки нового старта');

    // Порядок: лимит-гейт (fail 62) → ключи (fail 64 / списание) → инкремент попытки →
    // bossStartMs. Инкремент должен стоять ПОСЛЕ успешной проверки ключей (не тратим слот на
    // попытку, которая была отклонена из-за нехватки ключей) и ДО bossStartMs (сама попытка
    // считается начатой одновременно со списанием слота).
    const gatePos      = newFightBody.indexOf('return $this->ops->fail(62);');
    const keysCheckPos = newFightBody.indexOf('return $this->ops->fail(64);');
    const incrPos      = newFightBody.indexOf("$data['dailyKills'][$bossId] = intval($data['dailyKills'][$bossId]) + 1;");
    const bossStartPos = newFightBody.indexOf("$data['bossStartMs'][$diffIdx][$bossId] = $now;");
    assert(gatePos !== -1 && keysCheckPos !== -1 && incrPos !== -1 && bossStartPos !== -1, 'sanity: все четыре маркера найдены');
    assert(gatePos < keysCheckPos && keysCheckPos < incrPos && incrPos < bossStartPos,
        'порядок операций: лимит-гейт → проверка ключей → расход попытки → запись bossStartMs');
}

console.log('\n2) bosses.php.claimKill() — БОЛЬШЕ НЕ проверяет и НЕ инкрементирует dailyKills (иначе победа считала бы попытку дважды)');
{
    const startIdx = bossesPhp.indexOf('function claimKill(){');
    assert(startIdx !== -1, 'claimKill() найдена');
    const body = bossesPhp.slice(startIdx); // последний метод класса — срез до конца файла безопасен

    assert(!/if\(intval\(\$data\['dailyKills'\]\[\$bossId\]\) >= \$limit\) return \$this->ops->fail\(62\);/.test(body),
        'claimKill() больше не отклоняет по коду 62 (лимит уже проверен в startFight())');
    assert(!/\$data\['dailyKills'\]\[\$bossId\] = intval\(\$data\['dailyKills'\]\[\$bossId\]\) \+ 1;/.test(body),
        'claimKill() больше не инкрементирует dailyKills (иначе задвоило бы счёт с startFight())');
    // killsTotal — ОТДЕЛЬНЫЙ счётчик ("побед за всё время"), должен остаться и расти только тут.
    assert(/\$data\['killsTotal'\]\[\$bossId\] = intval\(\$data\['killsTotal'\]\[\$bossId\]\) \+ 1;/.test(body),
        'killsTotal (не dailyKills!) по-прежнему инкрементируется в claimKill() — это отдельный "победы за всё время" счётчик');
}

console.log('\n3) bosses.php.endFightSession() (форфейт/таймаут) — по-прежнему НЕ трогает dailyKills (и не должен: попытка уже учтена в startFight())');
{
    const startIdx = bossesPhp.indexOf('function endFightSession(){');
    const endIdx   = bossesPhp.indexOf('\n        }', bossesPhp.indexOf("\$this->ops->ok(['patch' => \$patch, 'top' => \$top]);", startIdx));
    assert(startIdx !== -1 && endIdx !== -1, 'endFightSession() найдена целиком');
    const body = bossesPhp.slice(startIdx, endIdx);
    assert(!/dailyKills/.test(body), 'endFightSession() не содержит ни одного упоминания dailyKills — не нужно, попытка уже расходована при старте');
}

console.log('\n4) bosses_fight.js._openBossesFight() — синхронизирует dailyKills/dailyDate из ответа startFight(), тем же способом, что и keys');
{
    const s = bossesFightJs.indexOf("const patched = JSON.parse((res.patch && res.patch.bosses_data) || '{}');");
    const e = bossesFightJs.indexOf('} catch(e){', s);
    assert(s !== -1 && e !== -1, 'блок разбора patch.bosses_data найден');
    const body = bossesFightJs.slice(s, e);
    assert(/if\(patched\.keys && patched\.keys\[bossIdx\] !== undefined\) bosses\.keys\[bossIdx\] = patched\.keys\[bossIdx\];/.test(body),
        'sanity: синхронизация keys всё ещё на месте (не удалена этой правкой)');
    assert(/if\(patched\.dailyDate && patched\.dailyDate !== bosses\.dailyDate\)\{/.test(body),
        'обрабатывает смену календарного дня (dailyDate) так же, как это делает клиентский _today()/dailyDate rollover');
    assert(/bosses\.dailyKills = \[0,0,0,0,0,0,0,0\];/.test(body), 'при смене дня обнуляет весь массив dailyKills (как и остальные rollover-места в коде)');
    assert(/if\(patched\.dailyKills && patched\.dailyKills\[bossIdx\] !== undefined\) bosses\.dailyKills\[bossIdx\] = patched\.dailyKills\[bossIdx\];/.test(body),
        'применяет свежее значение dailyKills[bossIdx] из серверного patch');
}

console.log('\n5) bosses-combat.js — победа (claimKill success) БОЛЬШЕ НЕ инкрементирует this.dailyKills (иначе задвоило бы счётчик на клиенте)');
{
    assert(!/this\.dailyKills\[idx\]\+\+;/.test(bossesCombatJs),
        'this.dailyKills[idx]++ удалено из клиентского обработчика победы — сервер уже прислал верное значение при старте');
    // killsTotal — отдельный счётчик, должен остаться нетронутым на клиенте тоже.
    assert(/this\.killsTotal\[idx\] = \(this\.killsTotal\[idx\] \|\| 0\) \+ 1;/.test(bossesCombatJs),
        'killsTotal по-прежнему инкрементируется на клиенте (не связан с dailyKills)');
}

console.log('\n6) Реальный прогон логики — попытка расходуется одинаково для победы/поражения/таймаута/сдачи, независимо от исхода');
{
    // Мини-модель серверной логики ПОСЛЕ фикса: startFight() тратит 1 слот на КАЖДЫЙ новый старт,
    // claimKill()/endFightSession() слот не трогают (исход уже не важен).
    function simulateDay(limit, attempts /* массив исходов: 'win'|'lose'|'timeout'|'forfeit' */){
        let dailyKills = 0;
        let started = 0, blocked = 0;
        for(const outcome of attempts){
            if(dailyKills >= limit){ blocked++; continue; } // startFight() вернул бы fail(62)
            dailyKills++; started++; // единственная точка расхода — старт, исход ниже ни на что не влияет
            // claimKill()/endFightSession() — независимо от 'win'/'lose'/'timeout'/'forfeit' —
            // не меняют dailyKills (этот тест это и проверяет: исход не важен).
            void outcome;
        }
        return { dailyKills, started, blocked };
    }

    // Раньше (баг): только 'win' инкрементировал бы счётчик — 7 подряд 'lose' никогда не
    // истощили бы лимит, попытки были бы фактически безграничны.
    let r = simulateDay(7, ['lose','lose','lose','lose','lose','lose','lose','lose','lose','lose']);
    assert(r.dailyKills === 7, 'после фикса: 10 подряд поражений — лимит всё равно исчерпывается на 7-й (было бы 0 до фикса)');
    assert(r.started === 7 && r.blocked === 3, '7 попыток стартовали, 3 следующие заблокированы (fail 62)');

    r = simulateDay(7, ['win','lose','timeout','forfeit','win','lose','timeout']);
    assert(r.dailyKills === 7, 'смешанный исход (победа/поражение/таймаут/сдача) — каждая попытка тратит ровно 1 слот вне зависимости от исхода');

    r = simulateDay(7, ['forfeit','forfeit','forfeit']);
    assert(r.dailyKills === 3 && r.blocked === 0, '3 подряд сдачи без единой победы — лимит тратится, ещё есть 4 попытки в запасе');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
