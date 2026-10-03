/**
 * Test: баг 23.09.2026 (репорт "прохожу локацию — все 6 точек 5/5, жму ВЫПОЛНИТЬ — ошибка
 * «не все ячейки заполнены» (код 61)") — 'zone' является client-writable полем ($allowed в
 * users.php), как weapons/bosses_data/dvor_games_data. Тот же класс гонки, что уже чинили
 * flushPlayerSave()-обёрткой для старта боя/ящика/блэкджека: общий 500мс-дебаунс автосейва
 * (player-save.js) мог долететь до сервера СО СТАРЫМ udata['zone'] ПОСЛЕ того, как
 * zone.fillCheckpoint() уже увеличил cps[cpIdx] в БД напрямую — и молча затереть прогресс.
 * Клиент при этом продолжал локально считать cp.filled++ (из ответа fillCheckpoint),
 * не видя, что сервер откатил прогресс — расхождение копилось до fail(61) на захвате.
 *
 * Run: node tests/zone-flush-before-fillcheckpoint.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zoneJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'zone.js'), 'utf-8');
const usersPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');

console.log('\nTest 1: sanity — zone действительно client-writable поле (иначе гонка невозможна)');
{
    const m = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!m && /'zone'/.test(m[1]), "'zone' присутствует в whitelist users.php \$allowed — подтверждает риск гонки с общим автосейвом");
}

console.log('\nTest 2: zone.js импортирует flushPlayerSave');
{
    assert(/import \{ flushPlayerSave \} from '\.\.\/modules\/player-save\.js';/.test(zoneJs), 'импорт flushPlayerSave найден');
}

console.log('\nTest 3: _attack() ждёт flushPlayerSave ПЕРЕД zone.fillCheckpoint (не после)');
{
    const start = zoneJs.indexOf('_attack(locIdx, cpIdx){');
    const end   = zoneJs.indexOf('\n    _showCpReward', start);
    const body  = zoneJs.slice(start, end);
    const flushIdx = body.indexOf("flushPlayerSave('zone_fill_checkpoint'");
    const tsIdx    = body.indexOf("TS.php('zone.fillCheckpoint'");
    assert(flushIdx !== -1, 'flushPlayerSave вызывается внутри _attack()');
    assert(tsIdx !== -1, 'TS.php(zone.fillCheckpoint) присутствует');
    assert(flushIdx !== -1 && tsIdx !== -1 && flushIdx < tsIdx, 'flushPlayerSave вызывается ДО TS.php(zone.fillCheckpoint), не после');
}

console.log('\nTest 4: fillCheckpoint по-прежнему вызывается ровно один раз (флаш не задваивает запрос)');
{
    const count = (zoneJs.match(/TS\.php\('zone\.fillCheckpoint'/g) || []).length;
    assert(count === 1, "TS.php('zone.fillCheckpoint', ...) встречается ровно один раз в файле");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
