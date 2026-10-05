/**
 * Test: батч 27.09.2026 (репорт — "это был пацанский хабар и там не начислился красный поинт").
 *
 * Причина найдена и подтверждена промо-картинкой магазина хабара
 * (_client/development/images/хабар страница.png, статичный арт, показывает игроку ТОЧНО то,
 * что обещает каждый тир ДО покупки):
 *   ОБЫЧНЫЙ:      Урон 100000, +1 Поинт(красный), +10 Рублей, +400 Сигарет, +10 Мачете
 *   ПАЦАНСКИЙ:    Урон 200000, +1 Поинт(красный), +20 Рублей, +800 Сигарет, +2 Мачете, +3 Ствола
 *   АВТОРИТЕТНЫЙ: Урон 300000, +2 Поинта(красный), +30 Рублей, +5 Автоматов, +5 Стволов,
 *                 +2 Поинта(синий), +1 Фишка
 *   ЭЛИТНЫЙ:      Урон 500000, +4 Поинта(красный), +50 Рублей, +5 Автоматов, +10 Стволов,
 *                 +4 Поинта(синий), +4 Фишки
 *
 * server/json/habar_daily_config.json (единственный источник правды для habar.php.collectDay())
 * содержал красный поинт (dice_points) ТОЛЬКО у Авторитетного/Элитного — у Обычного и Пацанского
 * награда dice_points отсутствовала целиком, хотя картинка магазина её явно обещает игроку ДО
 * покупки. Фикс: dice_points:1 добавлен в оба тира, server-side JSON и client-side зеркало
 * (habar.js.containers, используется как fallback-список в _collectDay(), см. её комментарий).
 * Суммы всех остальных наград совпадали с картинкой и до фикса — не трогались.
 *
 * Run: node tests/habar-daily-red-point-missing-tier01.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');

// ── Ожидаемые награды по картинке хабар страница.png (источник истины ТЗ) ─
const EXPECTED = {
    0: { damage:100000, dice_points:1, coins:10, cigarettes:400, ammo_machete:10 },
    1: { damage:200000, dice_points:1, coins:20, cigarettes:800, ammo_machete:2, ammo_gun:3 },
    2: { damage:300000, coins:30, ammo_auto:5, ammo_gun:5, dice_points:2, blue_points:2, poker_chips:1 },
    3: { damage:500000, coins:50, ammo_auto:5, ammo_gun:10, dice_points:4, blue_points:4, poker_chips:4 },
};

function toMap(rewards){
    const m = {};
    for(const r of rewards) m[r.type] = r.amount;
    return m;
}

console.log('\nTest 1: server/json/habar_daily_config.json — все 4 тира совпадают с картинкой магазина');
{
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'server/json/habar_daily_config.json'), 'utf-8'));
    assert(cfg.containers.length === 4, 'ровно 4 тира хабара');
    for(const con of cfg.containers){
        const got = toMap(con.rewards);
        const exp = EXPECTED[con.id];
        assert(!!exp, `тир id=${con.id} присутствует в ожидаемом наборе`);
        for(const type of Object.keys(exp)){
            assert(got[type] === exp[type],
                `тир id=${con.id}: ${type} = ${got[type]} (ожидалось ${exp[type]})`);
        }
        // Никаких ЛИШНИХ типов наград сверх обещанных картинкой
        for(const type of Object.keys(got)){
            assert(exp[type] !== undefined, `тир id=${con.id}: нет лишнего типа награды "${type}", не обещанного картинкой`);
        }
    }
}

console.log('\nTest 2: конкретно баг из репорта — Пацанский (id=1) содержит dice_points:1');
{
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'server/json/habar_daily_config.json'), 'utf-8'));
    const con1 = cfg.containers.find(c => c.id === 1);
    const has = con1.rewards.some(r => r.type === 'dice_points' && r.amount === 1);
    assert(has, 'Пацанский хабар (id=1) начисляет +1 красный поинт (dice_points), как обещано на картинке магазина');
}

console.log('\nTest 3: _client/src/game/habar.js — клиентское зеркало containers синхронно с сервером');
{
    const src = fs.readFileSync(path.join(root, '_client/src/game/habar.js'), 'utf-8');
    const start = src.indexOf('this.containers = [');
    const end   = src.indexOf('// Совместимость с FLA');
    const body  = src.slice(start, end);

    // Обычный: dice_points идёт СРАЗУ после damage (id=0)
    const obychIdx = body.indexOf("id:0, name:'Обычный'");
    const obychEnd  = body.indexOf("id:1, name:'Пацанский'");
    const obychBody = body.slice(obychIdx, obychEnd);
    assert(/\{type:'dice_points',\s*amount:1\}/.test(obychBody), 'Обычный (id:0): dice_points:1 присутствует в клиентском зеркале');

    const pacanIdx = body.indexOf("id:1, name:'Пацанский'");
    const pacanEnd  = body.indexOf("id:2, name:'Авторитетный'");
    const pacanBody = body.slice(pacanIdx, pacanEnd);
    assert(/\{type:'dice_points',\s*amount:1\}/.test(pacanBody), 'Пацанский (id:1): dice_points:1 присутствует в клиентском зеркале');
}

console.log('\nTest 4: server/core/controllers/habar.php — collectDay() по-прежнему кредитует dice_points (регрессия)');
{
    const src = fs.readFileSync(path.join(root, 'server/core/controllers/habar.php'), 'utf-8');
    const start = src.indexOf('function collectDay()');
    const end   = src.indexOf('function _grantWeaponReward');
    const body  = src.slice(start, end);
    assert(/in_array\(\$type, \['coins','cigarettes','dice_points','blue_points','poker_chips'\], true\)/.test(body),
        'whitelist типов collectDay() включает dice_points — сама выдача не менялась, менялся только конфиг');
    // 05.10.2026 (стале-пин, не регрессия — блокировка строки в collectDay(), $lockedUser вместо $user).
    assert(/\$this->ops->add\(\$lockedUser, \$type, \$amount\);/.test(body), 'добавление валюты идёт через Gameops::add() — тот же путь для dice_points, что и для coins/cigarettes');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
