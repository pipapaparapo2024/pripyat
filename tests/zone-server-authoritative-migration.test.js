/**
 * Test: 17.09.2026 (двенадцатый батч) — первый шаг проекта "перенос экономики на сервер":
 * Зона (чекпоинты/захват/бизнес/доход/заначки). По прямому указанию пользователя — очень
 * аккуратно, ничего не ломая: клиент (zone.js) больше не считает награду сам, а только
 * просит сервер (loc/cp индексы, не суммы); сервер (zone.php) сам проверяет энергию/кулдаун/
 * состояние ячейки и сам считает награду по каталогу server/json/zone_config.json — построчно
 * сверенному с прежними таблицами zone.js отдельным скриптом при переносе (без расхождений).
 *
 * Попутно найдены и исправлены 2 бага, необходимые для самой миграции:
 *  - zone_collect_0..4 (кулдаун сбора дохода бизнеса) никогда не было в whitelist users.php
 *    и не существовало колонкой в БД — кулдаун не переживал перезагрузку страницы. Без
 *    исправления новый zone.collectIncome() падал бы с fatal error при первом же сохранении.
 *  - "рамка уважения" (zone_respect_leader) обновлялась раньше ТОЛЬКО по вызову с клиента
 *    (zone.js._addLocRespect) — перенесено внутрь новых серверных методов, иначе рамка
 *    перестала бы обновляться после переноса.
 *
 * Run: node tests/zone-server-authoritative-migration.test.js
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

const zoneJs  = readSrc('_client/src/game/zone.js');
const zonePhp = readSrc('server/core/controllers/zone.php');
const usersPhp = readSrc('server/core/controllers/users.php');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'server/json/zone_config.json'), 'utf-8'));

console.log('\nTest 1: каталог zone_config.json 1:1 совпадает с исходными таблицами zone.js (регресс-гвард)');
{
    assert(catalog.locations.length === 5, '5 локаций');

    const cpRe = /cell_cost:(\d+),\s*cells:5,\s*filled:0,\s*reward:\{cig:(\d+),\s*exp:(\d+),\s*resp:(\d+)\s*\}/g;
    let m, extractedCp = [];
    while((m = cpRe.exec(zoneJs))) extractedCp.push({cell_cost:+m[1], cig:+m[2], exp:+m[3], resp:+m[4]});
    assert(extractedCp.length === 30, 'zone.js содержит 30 чекпоинтов (5×6)');
    let idx = 0, cpBad = 0;
    catalog.locations.forEach(loc => loc.checkpoints.forEach(cp => {
        const e = extractedCp[idx++];
        if(!e || e.cell_cost!==cp.cell_cost || e.cig!==cp.cig || e.exp!==cp.exp || e.resp!==cp.resp) cpBad++;
    }));
    assert(cpBad === 0, 'все 30 чекпоинтов каталога совпадают с zone.js (cell_cost/cig/exp/resp)');

    const bizRe = /costs:\[([\d,]+)\], income_(exp|resp|cig):\s*\[([\d,]+)\]/g;
    let bm, extractedBiz = [];
    while((bm = bizRe.exec(zoneJs))) extractedBiz.push({ costs: bm[1].split(',').map(Number), income: bm[2], table: bm[3].split(',').map(Number) });
    assert(extractedBiz.length === 15, 'zone.js содержит 15 бизнесов (5×3)');
    let bIdx = 0, bizBad = 0;
    catalog.locations.forEach(loc => loc.businesses.forEach(biz => {
        const e = extractedBiz[bIdx++];
        const ok = e && JSON.stringify(e.costs)===JSON.stringify(biz.costs) && e.income===biz.income && JSON.stringify(e.table)===JSON.stringify(biz.table);
        if(!ok) bizBad++;
    }));
    assert(bizBad === 0, 'все 15 бизнесов каталога совпадают с zone.js (costs/income/table)');

    const keyRe = /key:'([a-z_]+)'/g;
    let km, stashKeys = [];
    while((km = keyRe.exec(zoneJs))) stashKeys.push(km[1]);
    assert(stashKeys.length === 15, 'zone.js содержит 15 ключей заначек (5×3)');
    let kIdx = 0, keyBad = 0;
    catalog.locations.forEach(loc => loc.stash.keys.forEach(k => { if(stashKeys[kIdx++] !== k) keyBad++; }));
    assert(keyBad === 0, 'все 15 ключей заначек каталога совпадают с zone.js');
}

console.log('\nTest 2: zone.php — fillCheckpoint валидирует энергию/состояние ячейки перед начислением');
{
    const start = zonePhp.indexOf('function fillCheckpoint(){');
    const end   = zonePhp.indexOf('function captureLocation(){');
    const body  = zonePhp.slice(start, end);
    assert(/if\(\$progress\[\$locKey\]\['cps'\]\[\$cpIdx\] >= 5\) return \$this->ops->fail\(55\);/.test(body),
        'уже заполненная ячейка отклоняется до начисления');
    // 28.09.2026 (фикс собственного теста): списание энергии централизовано в
    // Gameops::spendEnergy() (сохраняет остаток прогресса регенерации вместо жёсткого сброса
    // energy_time=time() отдельной строкой) — _currentEnergy()/curEnergy-переменная в
    // fillCheckpoint() тоже убраны, проверка баланса теперь целиком внутри spendEnergy().
    assert(/if\(!\$this->ops->spendEnergy\(\$user, \$energyCost\)\) return \$this->ops->fail\(56\);/.test(body),
        'энергия проверяется и списывается через Gameops::spendEnergy() — недостаток энергии по-прежнему отклоняется кодом 56 до начисления');
}

console.log('\nTest 3: zone.php — энергия считается той же формулой регенерации, что Timers на клиенте (делегировано в Gameops)');
{
    // 28.09.2026 (фикс собственного теста): _currentEnergy() больше не держит свою копию
    // формулы регенерации — делегирует в Gameops::energySnapshot() (единая точка истины и для
    // zone.php, и для base.php.train(), и для клиентского timers.js._regenSnapshot()).
    const start = zonePhp.indexOf('private function _currentEnergy($user){');
    const end   = zonePhp.indexOf('private function _gangBonus');
    const body  = zonePhp.slice(start, end);
    assert(/return \$this->ops->energySnapshot\(\$user\)\[0\];/.test(body),
        '_currentEnergy() делегирует расчёт в Gameops::energySnapshot() — не дублирует формулу локально');

    const gameopsPhp = readSrc('server/core/models/gameops.php');
    const snapStart = gameopsPhp.indexOf('function energySnapshot($user){');
    const snapEnd   = gameopsPhp.indexOf('function spendEnergy(');
    const snapBody  = gameopsPhp.slice(snapStart, snapEnd);
    assert(/const ENERGY_REGEN_SEC = 300;/.test(gameopsPhp), 'период регенерации — 300 секунд, как в _client/src/modules/timers.js (теперь в Gameops, не в zone.php)');
    assert(/\$energy    = max\(\$saved, min\(\$maxEnergy, \$saved \+ \$ticks\)\);/.test(snapBody),
        'max(saved, min(max, saved+ticks)) — та же формула, что Timers._regenSnapshot() (донат-энергия сверх потолка не обрезается регенерацией)');
}

console.log('\nTest 4: zone.php — бонус банды воспроизведён 1:1 (та же карта, что Gangs.getBonus в gangs.js)');
{
    const start = zonePhp.indexOf('private function _gangBonus($user, $key){');
    const end   = zonePhp.indexOf('// zone-прогресс хранится');
    const body  = zonePhp.slice(start, end);
    assert(/0 => \['max_energy'=>5,  'stew_bonus'=>10\]/.test(body), 'банда 0 (Одиночки): max_energy 5, stew_bonus 10');
    assert(/4 => \['exp_bonus'=>15,  'drop_bonus'=>5\]/.test(body), 'банда 4 (Чистое Небо): exp_bonus 15, drop_bonus 5');
}

console.log('\nTest 5: zone.php — заначка (15% шанс), плоский счётчик без классификации/награды (25.09.2026)');
{
    const start = zonePhp.indexOf('function fillCheckpoint(){');
    const end   = zonePhp.indexOf('function captureLocation(){');
    const body  = zonePhp.slice(start, end);
    assert(/if\(mt_rand\(1, 100\) <= 15\)\{/.test(body), '15% шанс выпадения заначки (тот же порог, что был у Math.random()<=0.15)');
    // 25.09.2026 (по прямому указанию — "нычки визуально не готовы, находка не должна иметь
    // функционала — просто счётчик в БД, без классификации по типу и без награды"): per-key
    // коллекция (cards/completed) + награда сигаретами/опытом убраны целиком — теперь плоский
    // инкремент stash_count. См. tests/zone-stash-count-flat-no-reward.test.js для полной проверки.
    assert(/\$user\['stash_count'\] = \$this->ops->i\(\$user, 'stash_count'\) \+ 1;/.test(body),
        'находка нычки — простой инкремент плоского счётчика stash_count');
    assert(!/stashProgress/.test(body), 'per-key объект $stashProgress больше не используется');
    assert(!/ops->add\(\$user, 'cigarettes', intval\(\$locCfg\['stash'\]/.test(body), 'награда сигаретами за коллекцию нычек убрана');
    assert(!/ops->add\(\$user, 'exp', intval\(\$locCfg\['stash'\]/.test(body), 'награда опытом за коллекцию нычек убрана');
}

console.log('\nTest 6: zone.php — захват локации переиспользуется в fillCheckpoint и captureLocation (не задублирован)');
{
    assert(/private function _applyCaptureIfFull\(&\$progress, \$locIdx, &\$user\){/.test(zonePhp),
        'общий приватный метод захвата существует');
    const occurrences = (zonePhp.match(/\$this->_applyCaptureIfFull\(/g) || []).length;
    assert(occurrences === 2, 'вызывается ровно из 2 мест (fillCheckpoint автоматически + captureLocation вручную)');
}

console.log('\nTest 7: zone.php — «рамка уважения» (zone_respect_leader) обновляется из новых методов, не только с клиента');
{
    assert(/private function _recordRespectLeader\(\$locIdx, \$total\){/.test(zonePhp), 'общий метод обновления глобального рекорда существует');
    // 30.09.2026 (прогон перед деплоем): добавился 4-й вызов — batch-метод collectAllIncome()
    // (собрать доход со всех локаций разом), обновляет рекорд в цикле по $respectUpdates.
    const occurrences = (zonePhp.match(/\$this->_recordRespectLeader\(/g) || []).length;
    assert(occurrences === 4, 'вызывается из всех 4 новых методов (fillCheckpoint, captureLocation, collectIncome, collectAllIncome)');
}

console.log('\nTest 8: zone.php — upgradeBusiness требует "тронутую" локацию (та же проверка hasCapture, что zone-biz.js)');
{
    const start = zonePhp.indexOf('function upgradeBusiness(){');
    const end   = zonePhp.indexOf('function collectIncome(){');
    const body  = zonePhp.slice(start, end);
    assert(/\$hasCapture = intval\(\$progress\[\$locKey\]\['cleared'\] \?\? 0\) > 0/.test(body),
        'проверяет cleared>0 ИЛИ хотя бы одну заполненную ячейку — как hasCapture в zone-biz.js');
    assert(/if\(!\$this->ops->deduct\(\$user, 'cigarettes', \$cost\)\) return \$this->ops->fail\(50\);/.test(body),
        'списание сигарет — через Gameops.deduct (тот же безопасный паттерн, что habar.php)');
}

console.log('\nTest 9: zone.php — collectIncome проверяет 8-часовой кулдаун серверными часами');
{
    const start = zonePhp.indexOf('function collectIncome(){');
    const end   = zonePhp.lastIndexOf('\t}');
    const body  = zonePhp.slice(start, end);
    assert(/const ZONE_COLLECT_COOLDOWN_SEC = 8 \* 3600;/.test(zonePhp), 'константа кулдауна — 8 часов, как в zone.js');
    assert(/if\(\$cooldownLeft > 0\) return \$this->ops->fail\(59\);/.test(body), 'кулдаун проверяется до начисления дохода');
}

// 04.10.2026 (аудит по прямому указанию — "найди дыры"): РЕВЕРС Test 10 — zone_collect_0..4
// снова убраны из whitelist, на этот раз НАВСЕГДА. 17.09.2026 их добавили сюда, чтобы кулдаун
// переживал перезагрузку страницы — но без guard'а это само стало дырой (users.save с
// zone_collect_N:'0' сбрасывал 8ч-кулдаун сбора дохода бизнеса на ноль). Персистентность
// кулдауна не ломается: zone.php.collectIncome()/collectAllIncome() сами пишут эти поля через
// Gameops::saveUser(), полностью в обход этого whitelist (см. users-php-real-exec-save-
// whitelist-holes-closed.test.js — прямое исполнение подтверждает, что эксплойт-значение не
// проходит, а легитимные поля всё ещё сохраняются).
console.log('\nTest 10: users.php — zone_collect_0..4 УБРАНЫ из whitelist (сами стали дырой без guard, см. 04.10.2026)');
{
    const allowedBlock = usersPhp.match(/\$allowed = \[[\s\S]*?\];/)[0];
    ['zone_collect_0','zone_collect_1','zone_collect_2','zone_collect_3','zone_collect_4'].forEach(f => {
        assert(!new RegExp("'" + f + "'").test(allowedBlock), `'${f}' отсутствует в whitelist (не client-writable)`);
    });
}

console.log('\nTest 11: migrate16.php добавляет 5 колонок zone_collect_N');
{
    const migratePath = path.join(root, 'server', 'migrate16.php');
    assert(fs.existsSync(migratePath), 'server/migrate16.php создан');
    const src = fs.readFileSync(migratePath, 'utf-8');
    ['zone_collect_0','zone_collect_1','zone_collect_2','zone_collect_3','zone_collect_4'].forEach(f => {
        assert(new RegExp("'" + f + "'").test(src), `миграция добавляет ${f}`);
    });
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col`/.test(src), 'использует ALTER TABLE ADD COLUMN (данные не трогает)');
}

console.log('\nTest 12: zone.js — клиент больше НЕ начисляет валюту напрямую в этих 4 методах (только через сервер)');
{
    const methods = [
        { name: '_attack',          start: zoneJs.indexOf('_attack(locIdx, cpIdx){'),      end: zoneJs.indexOf('// Вызывается ТОЛЬКО из zone-popup.js') },
        { name: '_capture',         start: zoneJs.indexOf('_capture(locIdx){'),             end: zoneJs.indexOf('// ── БИЗНЕС') },
        { name: '_upgradeBusiness', start: zoneJs.indexOf('_upgradeBusiness(locIdx, bizIdx){'), end: zoneJs.indexOf('// Аудит 17.09.2026: суммы дохода') },
        { name: 'collectLocIncome', start: zoneJs.indexOf('collectLocIncome(locIdx, onDone){'), end: zoneJs.indexOf('getCollectCooldown(locIdx){') },
    ];
    methods.forEach(({name, start, end}) => {
        assert(start !== -1 && end !== -1 && end > start, name + ': границы метода найдены в исходнике');
        const body = zoneJs.slice(start, end);
        assert(!/udata\['cigarettes'\]\s*=\s*parseInt/.test(body), name + ': не присваивает udata[cigarettes] напрямую (кроме простого чтения для UI-проверки)');
        assert(!/udata\['exp'\]\s*=\s*parseInt/.test(body), name + ': не присваивает udata[exp] напрямую');
        assert(!/udata\['respect'\]\s*=\s*parseInt/.test(body), name + ': не присваивает udata[respect] напрямую');
    });
}

console.log('\nTest 13: zone.js — все 4 метода зовут сервер и применяют applyPatch(res.patch)');
{
    assert(/import \{ applyPatch \} from '\.\.\/modules\/patch\.js';/.test(zoneJs), 'applyPatch импортирован');
    assert(/TS\.php\('zone\.fillCheckpoint', \{loc: locIdx, cp: cpIdx\}/.test(zoneJs), '_attack зовёт zone.fillCheckpoint');
    assert(/TS\.php\('zone\.captureLocation', \{loc: locIdx\}/.test(zoneJs), '_capture зовёт zone.captureLocation');
    assert(/TS\.php\('zone\.upgradeBusiness', \{loc: locIdx, biz: bizIdx\}/.test(zoneJs), '_upgradeBusiness зовёт zone.upgradeBusiness');
    assert(/TS\.php\('zone\.collectIncome', \{loc: locIdx\}/.test(zoneJs), 'collectLocIncome зовёт zone.collectIncome');
    // 30.09.2026 (прогон перед деплоем): добавился 5-й колбэк — zone.collectAllIncome (кнопка
    // "собрать всё" по всем локациям разом), тоже применяет applyPatch(res.patch).
    const applyPatchCalls = (zoneJs.match(/applyPatch\(res\.patch\)/g) || []).length;
    assert(applyPatchCalls === 5, 'applyPatch(res.patch) вызывается во всех 5 колбэках успеха (включая collectAllIncome)');
}

console.log('\nTest 14: zone.js — защита от повторного клика, пока ждём ответ сервера (_attack/_capture)');
{
    assert(/if\(this\._fillInFlight\)\{/.test(zoneJs), '_attack: защита от двойного клика во время запроса');
    assert(/if\(this\._captureInFlight\) return;/.test(zoneJs), '_capture: защита от двойного клика во время запроса');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
