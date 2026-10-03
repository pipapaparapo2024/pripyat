/**
 * Test: три несвязанных бага, найденных по отчёту пользователя.
 *
 * Баг 1 — тултип урона оружия (bosses_fight.js._showWpnTip) занижал урон:
 *   WPN_KEYS хранил русские слова ('автомат','ствол','мачете'), а skills.js хранит
 *   sk.weapon английскими ключами ('auto','gun','machete') — getFlatBonus() по
 *   русскому ключу никогда не находил совпадений и возвращал 0. Реальная атака
 *   (bosses-combat.js._attack) использует правильный английский ключ и бонус скилла
 *   применяет — отсюда расхождение "реально бьёт 210, подсказка показывает 200".
 *
 * Баг 2 — открытие «Хаты» (БАЗА) прятало верхний HUD (iface.up):
 *   hata.js добавляет полноэкранное окно в root.layer2_mc, но не поднимает iface.up
 *   поверх (в отличие от всех остальных оверлеев — bosses_fight, habar, dvor), из-за
 *   чего фон хаты рисуется поверх HUD, который остаётся в layer1_mc ниже по z-order.
 *
 * Баг 3 — локация "Шлюз" не разблокировалась после победы над нужным боссом:
 *   защитный фикс — разблокировка локации теперь смотрит ещё и на boss_kills_N
 *   (инкрементируется при каждом убийстве с самого начала), а не только на
 *   hata_progress (более новое поле, могло не проставиться на старых
 *   сохранениях для уже давно побеждённых боссов).
 *   Для Шлюза (bossReq=1) этого достаточно — boss_kills_1 уже в whitelist
 *   users.php и сохраняется. Заодно был найден баг: boss_kills_3..7 не были
 *   в whitelist (терялись при сохранении) — но по просьбе пользователя
 *   сохранение boss_kills пока НЕ расширяем дальше 0..2 (см. тест 3a).
 *
 * Run: node tests/wpn-tooltip-hata-fixes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const bossFightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const hataSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8'
);
const usersPhpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8'
);

// ── Test 1: WPN_KEYS использует английские ключи, совпадающие со skills.js ────
console.log('\nTest 1: тултип урона оружия — WPN_KEYS совпадает с sk.weapon из skills.js');
{
    // 25.09.2026: WPN_KEYS переехал из локального const внутри _showWpnTip (bosses_fight.js) в
    // module-level const в weapons.js (единая формула computeModifiedDamage() для оружейки и
    // подсказки боя, см. shmot-torso-height-140-poker-open-button-weapon-modified-damage.test.js).
    const weaponsSrc = fs.readFileSync(path.join(__dirname, '..', '_client/src/game/weapons.js'), 'utf-8');
    const m = weaponsSrc.match(/const WPN_KEYS\s*=\s*\[([^\]]+)\];/);
    assert(!!m, 'WPN_KEYS найден в weapons.js');
    if (m) {
        const keys = m[1].split(',').map(s => s.trim().replace(/'/g, ''));
        assert(keys.join(',') === 'knife,chain,bat,machete,gun,auto',
            `WPN_KEYS = [knife,chain,bat,machete,gun,auto], получили [${keys.join(',')}]`);
        assert(!/автомат|ствол|мачете/.test(m[1]), 'WPN_KEYS больше не содержит русских слов');
    }
    // Примечание: в файле ЕСТЬ другой, не связанный WPN_KEYS (объект id→русское название для
    // другого UI, строка 712) — проверяем именно ОТСУТСТВИЕ старого массива английских ключей.
    assert(!/const WPN_KEYS\s*=\s*\['knife'/.test(bossFightSrc), 'старый локальный массив WPN_KEYS (knife/chain/bat/...) в bosses_fight.js убран (используется через weapons.computeModifiedDamage())');
}

// ── Test 2: hata.js поднимает iface.up поверх окна в open() и close() ─────────
console.log('\nTest 2: hata.js не прячет iface.up за полноэкранным фоном');
{
    const openMatch  = hataSrc.match(/open\(\)\{([\s\S]*?)\n\s{4}\}/);
    const closeMatch = hataSrc.match(/close\(\)\{([\s\S]*?)\n\s{4}\}/);
    assert(!!openMatch, 'open() найден в hata.js');
    assert(!!closeMatch, 'close() найден в hata.js');
    if (openMatch)  assert(/iface\.up\)\s*root\.addChild\(iface\.up\)/.test(openMatch[1]),
        'open() поднимает iface.up через root.addChild — иначе фон хаты его перекрывает');
    if (closeMatch) assert(/iface\.up\)\s*root\.addChild\(iface\.up\)/.test(closeMatch[1]),
        'close() тоже восстанавливает iface.up (как в habar.js/dvor.js)');
}

// ── Test 3a: users.php whitelist пока НЕ расширяем дальше boss_kills_0..2 ──────
// (по явной просьбе пользователя — "пока что не сохраняй в БД убийство боссов" —
// откатили расширение на boss_kills_3..7, оставили как было живьём на сервере)
console.log('\nTest 3a: users.php сохраняет ровно boss_kills_0..2 (3..7 сознательно не добавлены)');
{
    for (let i = 0; i < 3; i++) {
        assert(usersPhpSrc.includes(`'boss_kills_${i}'`), `whitelist содержит 'boss_kills_${i}'`);
    }
    for (let i = 3; i < 8; i++) {
        assert(!usersPhpSrc.includes(`'boss_kills_${i}'`), `whitelist НЕ содержит 'boss_kills_${i}' (пока не сохраняем)`);
    }
}

// ── Test 3b: разблокировка локации в hata.js учитывает boss_kills_N ────────────
console.log('\nTest 3b: _render() в hata.js использует boss_kills_N как доп. сигнал разблокировки');
{
    const renderMatch = hataSrc.match(/_render\(\)\{([\s\S]*?)\n\s{4}\}/);
    assert(!!renderMatch, '_render() найден в hata.js');
    if (renderMatch) {
        const body = renderMatch[1];
        assert(/killedThisBoss\s*=\s*h\.bossReq >= 0 && parseInt\(udata\['boss_kills_' \+ h\.bossReq\] \|\| 0\) > 0/.test(body),
            'killedThisBoss читает udata[\'boss_kills_\' + h.bossReq]');
        assert(/isUnlock\s*=\s*h\.bossReq === -1 \|\| prog >= h\.bossReq \|\| killedThisBoss/.test(body),
            'isUnlock = старое условие ИЛИ killedThisBoss (обратная совместимость со старыми сохранениями)');
    }
}

// ── Test 3c: логика разблокировки — самопроверка на данных ────────────────────
console.log('\nTest 3c: симуляция — старое сохранение без hata_progress, но с boss_kills_1 > 0');
{
    const HATAS_SHLUZ = { bossReq: 1 };
    function isUnlocked(udata, h) {
        let prog = parseInt(udata['hata_progress']);
        if (isNaN(prog)) prog = -1;
        const killedThisBoss = h.bossReq >= 0 && parseInt(udata['boss_kills_' + h.bossReq] || 0) > 0;
        return h.bossReq === -1 || prog >= h.bossReq || killedThisBoss;
    }
    const staleAccount = { boss_kills_1: '3' }; // старый убитый босс, hata_progress отсутствует
    assert(isUnlocked(staleAccount, HATAS_SHLUZ) === true,
        'локация разблокирована по boss_kills_1, даже если hata_progress не был проставлен');

    const freshAccount = { hata_progress: '1' }; // новый путь — hata_progress проставлен
    assert(isUnlocked(freshAccount, HATAS_SHLUZ) === true,
        'локация разблокирована по hata_progress (обычный путь)');

    const untouchedAccount = {}; // босс вообще не побеждён
    assert(isUnlocked(untouchedAccount, HATAS_SHLUZ) === false,
        'локация остаётся заблокированной, если босс не побеждён ни по одному сигналу');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
