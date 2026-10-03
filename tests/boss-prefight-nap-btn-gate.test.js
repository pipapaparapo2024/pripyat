/**
 * Test: Boss prefight — big "Напасть" button (боевка кнопка напасть.png) now owns the gate.
 *
 * 27.09.2026 (по прямому указанию — "хочу перед боем посмотреть какие шмотки даёт босс и
 * награду за убийство, а сейчас проверка условий (дневной лимит/ключи/зачистка локации)
 * блокирует даже вход на экран предпросмотра"): раньше все три проверки жили на маленькой
 * кнопке карточки боссов (bosses_select.js) и не пускали игрока даже посмотреть награду/дроп
 * шмоток для боссов, к которым он ещё не готов. Перенесены сюда — на napBtn экрана предбоя
 * (bosses_prefight.js), непосредственно перед реальным стартом боя. Экран предпросмотра теперь
 * открывается всегда (см. tests/boss-select-gate.test.js), блокировка — только здесь.
 *
 * Run: node tests/boss-prefight-nap-btn-gate.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/bosses_prefight.js'), 'utf-8');

const btnStart = src.indexOf("napBtn.on('pointerdown', ()=>{");
const btnEnd   = src.indexOf('win.addChild(napBtn);');
const btnBody  = src.slice(btnStart, btnEnd);

// ── Test 1: все три проверки присутствуют именно здесь ────────────────────
console.log('\nTest 1: napBtn содержит все три проверки (лимит/ключи/локация)');
{
    assert(btnStart > -1, 'napBtn.on(\'pointerdown\', ...) найден');
    assert(/DAILY_KILL_LIMIT/.test(btnBody), 'проверяет дневной лимит убийств');
    assert(/keysNeed > 0 && keysHave < keysNeed/.test(btnBody), 'проверяет ключи');
    assert(/zone\.getCleared\(locIdx\)/.test(btnBody), 'проверяет зачистку локации');
}

// ── Test 2: проверки пропускаются, если бой уже активен ───────────────────
console.log('\nTest 2: проверки пропускаются при уже активном бое (isFightActive)');
{
    assert(/const isFightActive = !!\(window\.bosses && bosses\._bossStartMs/.test(btnBody),
        'isFightActive вычисляется из bosses._bossStartMs[selectedDiff][bossIdx]');
    assert(/if\(window\.bosses && !isFightActive\)\{/.test(btnBody),
        'весь блок проверок обёрнут в !isFightActive — продолжающийся бой не блокируется повторно');
}

// ── Test 3: лимит и ключи показывают понятную ошибку через _openSidorovichError ─
console.log('\nTest 3: сообщения об ошибках лимита/ключей идут через _openSidorovichError');
{
    // 29.09.2026: "Лимит убийств" → "Лимит попыток" — см.
    // tests/boss-daily-attempt-spent-on-any-outcome.test.js (лимит тратится за любой исход).
    assert(/iface\._openSidorovichError\('Лимит попыток исчерпан!'/.test(btnBody),
        'лимит попыток показывает отдельный попап ошибки');
    assert(/iface\._openSidorovichError\('Нужно '\+keysNeed\+' ключей!', 'У вас: '\+keysHave\)/.test(btnBody),
        'нехватка ключей показывает точное количество нужных/имеющихся');
}

// ── Test 4: незачищенная локация ведёт в Зону (как раньше на карточке) ────
console.log('\nTest 4: клик на "Понятно" при незачищенной локации закрывает попапы и открывает нужную Зону');
{
    const locBlockStart = btnBody.indexOf('const locIdx =');
    const locBlockEnd   = btnBody.indexOf('return;', btnBody.indexOf('_openZoneScreen'));
    const locBlock = btnBody.slice(locBlockStart, locBlockEnd);

    assert(/this\._closeBossPreFight\(\);/.test(locBlock), 'закрывает экран предпросмотра');
    assert(/if\(this\._bossWin\) this\._bossWin\.visible = false;/.test(locBlock), 'прячет экран списка боссов');
    assert(/this\.popHud\('bossSelect'\);/.test(locBlock), 'снимает HUD-регистрацию bossSelect');
    assert(/this\._restoreBossHud\(\);/.test(locBlock), 'восстанавливает обычный HUD');
    assert(/iface\._openZoneScreen\(locIdx\);/.test(locBlock), 'открывает экран Зоны нужной локации');
}

// ── Test 5: locIdx берётся из bosses.data[bossIdx].boss_loc, с фолбэком -1 ─
console.log('\nTest 5: locIdx = bData.boss_loc, безопасный фолбэк на -1');
{
    assert(/const locIdx = \(bData && bData\.boss_loc != null\) \? bData\.boss_loc : -1;/.test(btnBody),
        'locIdx корректно достаётся из bData с фолбэком -1 (боссы без привязки к локации)');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
