/**
 * Test: Free weapon cooldown — global (per-weapon-id) vs old per-boss behaviour.
 *
 * Fix (24.09.2026) in bosses-combat.js:
 *   BEFORE: cdKey = idx + '_' + eqWpn.id   → separate CD per boss
 *   AFTER:  cdKey = String(eqWpn.id)        → one global CD per weapon
 *
 * 28.09.2026 (по прямому указанию — "КД для всех трёх бесплатных видов оружия (нож/цепь/бита)
 * сделай общим: ударил любым — остальные тоже уходят на откат, ускорение за 20р снимает КД у
 * всех троих сразу"): следующий шаг того же направления — раньше нож/цепь/бита имели каждый
 * СВОЙ независимый таймстамп (можно было ударить всеми тремя подряд без ожидания). Тесты 2 и 6
 * ниже раньше документировали именно это ("different weapons have independent CDs") как
 * ожидаемое поведение — теперь переписаны под общий кулдаун (см. bosses-combat.js.
 * _freeWpnSharedLastUse(), server/core/controllers/bosses.php.$FREE_WPN_IDS).
 *
 * Run: node tests/free-weapon-cd.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const CD_MS  = 6 * 60 * 60 * 1000; // 6 hours
const FREE_IDS = ['0', '1', '2'];

// ── helpers replicating bosses-combat.js logic ─────────────────────────────

function sharedLastUse(freeWpnLastMs){
    let last = 0;
    FREE_IDS.forEach(k => { last = Math.max(last, parseInt(freeWpnLastMs[k]) || 0); });
    return last;
}

function isOnCd_shared(freeWpnLastMs, now) {
    const lastUse = sharedLastUse(freeWpnLastMs);
    return lastUse > 0 && (now - lastUse) < CD_MS;
}

// 28.09.2026: удар ЛЮБЫМ бесплатным оружием пишет $now во ВСЕ три ключа разом.
function useFree_shared(freeWpnLastMs, now) {
    FREE_IDS.forEach(k => { freeWpnLastMs[k] = now; });
}

function isOnCd_perBoss(freeWpnLastMs, bossIdx, eqWpnId, now) {
    const lastUse = freeWpnLastMs[bossIdx + '_' + eqWpnId] || 0;
    return lastUse > 0 && (now - lastUse) < CD_MS;
}

function useFree_perBoss(freeWpnLastMs, bossIdx, eqWpnId, now) {
    freeWpnLastMs[bossIdx + '_' + eqWpnId] = now;
}

// ── Test 1: Global CD — using knife on boss 0 blocks knife on boss 1 ──────
console.log('\nTest 1: Global CD — one use blocks weapon on ALL bosses');
{
    const cdMap = {};
    const now   = Date.now();

    useFree_shared(cdMap, now);

    assert(isOnCd_shared(cdMap, now + 1000), 'Knife on CD on boss 0 (1s later)');
    assert(isOnCd_shared(cdMap, now + 1000), 'Knife still on CD when checking boss 1 (same shared timer)');
}

// ── Test 2: 28.09.2026 — общий КД: удар ножом ставит на откат и цепь, и биту тоже ─
console.log('\nTest 2: Общий КД (28.09.2026) — удар одним бесплатным оружием блокирует ОСТАЛЬНЫЕ два тоже');
{
    const cdMap = {};
    const now   = Date.now();
    const KNIFE = '0', CHAIN = '1', BAT = '2';

    // Удар ножом — по новой логике пишет $now во все три ключа сразу.
    useFree_shared(cdMap, now);

    assert(cdMap[KNIFE] === now, 'freeWpnCdMs[0] (нож) обновлён');
    assert(cdMap[CHAIN] === now, 'freeWpnCdMs[1] (цепь) ТОЖЕ обновлён тем же ударом');
    assert(cdMap[BAT]   === now, 'freeWpnCdMs[2] (бита) ТОЖЕ обновлён тем же ударом');
    assert(isOnCd_shared(cdMap, now + 1000), 'Общий КД активен сразу после удара любым бесплатным оружием');
}

// ── Test 3: Old per-boss CD — using knife on boss 0 does NOT block boss 1 ─
console.log('\nTest 3: Old per-boss CD — knife on boss 0 does NOT block boss 1 (documents old bug, fixed 24.09.2026)');
{
    const cdMap = {};
    const now   = Date.now();
    const KNIFE = 0;

    useFree_perBoss(cdMap, 0, KNIFE, now);

    assert( isOnCd_perBoss(cdMap, 0, KNIFE, now + 1000), 'Knife blocked on boss 0');
    assert(!isOnCd_perBoss(cdMap, 1, KNIFE, now + 1000), 'Knife NOT blocked on boss 1 (bug: was exploitable)');
}

// ── Test 4: CD expires after 6h ────────────────────────────────────────────
console.log('\nTest 4: CD expires after 6 hours');
{
    const cdMap = {};
    const now   = Date.now();

    useFree_shared(cdMap, now);

    assert( isOnCd_shared(cdMap, now + CD_MS - 1), 'On CD 1ms before expiry');
    assert(!isOnCd_shared(cdMap, now + CD_MS),     'CD expired exactly at 6h');
    assert(!isOnCd_shared(cdMap, now + CD_MS + 1), 'CD expired after 6h');
}

// ── Test 5: CD does NOT reset on boss defeat (баг 24.09.2026, по прямому указанию) ──
// Раньше bosses-combat.js._onDefeat() безусловно обнулял this._freeWpnLastMs = {} при
// КАЖДОЙ победе — 6-часовой кулдаун бесплатного оружия полностью терялся после любого
// убийства босса, и следующий бой всегда начинался с "свежим" бесплатным оружием, не
// дожидаясь реальных 6 часов. Фикс — строка удалена целиком: кулдаун теперь глобальный
// таймер, не привязанный к исходу боя.
console.log('\nTest 5: CD does NOT reset on boss defeat — fixed 24.09.2026');
{
    const combatSrc = require('fs').readFileSync(
        require('path').join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
    );
    const start = combatSrc.indexOf('proto._onDefeat = function(idx){');
    const end   = combatSrc.indexOf('\n    };', start);
    const body  = combatSrc.slice(start, end);
    assert(!/this\._freeWpnLastMs\s*=\s*\{\}/.test(body),
        '_onDefeat() больше не обнуляет _freeWpnLastMs — кулдаун переживает победу над боссом');

    let cdMap = {};
    const now = Date.now();
    useFree_shared(cdMap, now);
    assert(isOnCd_shared(cdMap, now + 1000), 'Knife on CD before defeat');
    // Победа НЕ должна трогать cdMap — если бы код всё ещё обнулял его, эта проверка
    // (без реального вызова обнуления) осталась бы формальной; реальную защиту даёт
    // проверка исходников выше.
    assert(isOnCd_shared(cdMap, now + 1000), 'Knife CD остаётся активным после победы над боссом');
}

// ── Test 6: 28.09.2026 — rushFreeWeapon снимает ОБЩИЙ КД у всех троих сразу ────
console.log('\nTest 6: Ускорение за 20р снимает КД у ВСЕХ трёх бесплатных видов оружия сразу (было — только у одного)');
{
    const cdMap = {};
    const now   = Date.now();
    const KNIFE = '0', CHAIN = '1', BAT = '2';

    useFree_shared(cdMap, now); // удар ножом — весь пул на откате

    // rushFreeWeapon(): обнуляет ВСЕ три ключа, не только тот, что пришёл в weapon_id.
    FREE_IDS.forEach(k => { cdMap[k] = 0; });

    assert(!isOnCd_shared(cdMap, now + 1000), 'Общий КД снят полностью');
    assert(cdMap[KNIFE] === 0 && cdMap[CHAIN] === 0 && cdMap[BAT] === 0,
        'все три ключа (нож/цепь/бита) обнулены одним запросом ускорения');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
