/**
 * Test: Boss select — small "Напасть" card button.
 *
 * 27.09.2026 (по прямому указанию — "хочу перед боем посмотреть какие шмотки даёт босс и
 * награду за убийство, а сейчас проверка условий блокирует даже вход на экран предпросмотра"):
 * дневной лимит/ключи/зачистка локации раньше проверялись ЗДЕСЬ, на маленькой кнопке карточки
 * (napast_passiv.png/napast_activ.png), из-за чего экран предпросмотра боя (награда + карусель
 * возможных шмоток, bosses_prefight.js) был физически недостижим для боссов, к которым игрок
 * ещё не готов. Вся эта логика УДАЛЕНА отсюда и перенесена на большую кнопку "Напасть" самого
 * экрана предпросмотра — см. tests/boss-prefight-nap-btn-gate.test.js. Эта маленькая кнопка
 * карточки теперь безусловно открывает предпросмотр.
 *
 * Auto-redirect (если бой уже идёт — сразу открыть боёвку, минуя список) и отображение слотов
 * ключей на карточке — отдельная, не связанная с этим переносом логика, осталась как была.
 *
 * Run: node tests/boss-select-gate.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/bosses_select.js'), 'utf-8');

// ── Test 1: маленькая кнопка "Напасть" карточки больше не содержит проверок ───
console.log('\nTest 1: маленькая кнопка карточки (_onNapastClick) не проверяет лимит/ключи/локацию');
{
    const start = src.indexOf('const _onNapastClick = ()=>{');
    const end   = src.indexOf("napP.on('pointerdown', _onNapastClick);", start);
    const body  = src.slice(start, end);

    assert(start > -1, '_onNapastClick найден в bosses_select.js');
    assert(!/DAILY_KILL_LIMIT/.test(body), 'дневной лимит здесь больше не проверяется');
    assert(!/keys_needed/.test(body), 'проверка ключей здесь больше не проверяется');
    assert(!/zone\.getCleared/.test(body), 'проверка зачистки локации здесь больше не проверяется');
    assert(/if\(window\.iface\) iface\._openBossPreFight\(i\);/.test(body),
        'клик безусловно открывает экран предпросмотра боя');
}

// ── Test 2: обработчик по-прежнему висит на ОБОИХ спрайтах (passiv + activ) ───
console.log('\nTest 2: обработчик клика висит и на napP (пассив), и на napA (актив) — тач-устройства');
{
    // 28.09.2026: оба спрайта переведены на helper.onTap (тап = pointerup без смещения) ради
    // свайп-прокрутки списка боссов — см. mobile-napast-button-touch-fix.test.js. Проверяемое
    // здесь свойство то же: обработчик висит на ОБОИХ спрайтах, а не только на активном.
    assert(/helper\.onTap\(napP, _onNapastClick\);/.test(src), 'napP имеет обработчик тапа');
    assert(/helper\.onTap\(napA, _onNapastClick\);/.test(src), 'napA имеет обработчик тапа');
}

// ── Auto-redirect (mirrors top of _openBossesPopup) — не затронуто переносом ──
function shouldRedirectToFight(bossStartMs, diffIdx, fightDurMs) {
    const arr = bossStartMs[diffIdx];
    if (!Array.isArray(arr)) return null;
    const now = Date.now();
    for (let bi = 0; bi < arr.length; bi++) {
        const sm = arr[bi] || 0;
        if (sm > 0 && (now - sm) < fightDurMs) return bi;
    }
    return null;
}

console.log('\nTest 3: Auto-redirect — активный бой ведёт сразу в боёвку, минуя список');
{
    const FIGHT_DUR = 86400000; // 24h
    const now = Date.now();
    const startMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    startMs[0][1] = now - 3600000; // Счастливчик, начат 1ч назад
    const redirect = shouldRedirectToFight(startMs, 0, FIGHT_DUR);
    assert(redirect === 1, `Active fight with boss 1 → redirect to boss 1, got ${redirect}`);
}

console.log('\nTest 4: Auto-redirect — просроченный бой (>24ч) не редиректит');
{
    const FIGHT_DUR = 86400000;
    const now = Date.now();
    const startMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    startMs[0][2] = now - 25 * 3600000;
    const redirect = shouldRedirectToFight(startMs, 0, FIGHT_DUR);
    assert(redirect === null, 'Expired fight: no redirect');
}

console.log('\nTest 5: Auto-redirect — нет активного боя → null');
{
    const startMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    const redirect = shouldRedirectToFight(startMs, 0, 86400000);
    assert(redirect === null, 'No active fights → no redirect');
}

// ── Test 6: отображение слотов ключей на карточке — не затронуто переносом ────
console.log('\nTest 6: Слоты ключей на карточке = boss.keys_needed (не затронуто переносом гейта)');
{
    const BOSS_DATA = [
        { id:0, keys_needed:0 }, { id:1, keys_needed:3 }, { id:2, keys_needed:3 },
        { id:3, keys_needed:3 }, { id:4, keys_needed:3 }, { id:5, keys_needed:1 },
        { id:6, keys_needed:2 }, { id:7, keys_needed:3 },
    ];
    for (const boss of BOSS_DATA) {
        const slots = boss.keys_needed;
        if (boss.id === 0)      assert(slots === 0, 'Охотник: 0 key slots');
        else if (boss.id === 5) assert(slots === 1, 'Баркут: 1 key slot');
        else if (boss.id === 6) assert(slots === 2, 'Борода: 2 key slots');
        else                    assert(slots === 3, `Boss ${boss.id}: 3 key slots`);
    }
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
