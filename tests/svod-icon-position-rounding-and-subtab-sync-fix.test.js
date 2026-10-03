/**
 * Test: батч 22.09.2026 (по прямому указанию, редактор позиций) —
 *
 * 1) Иконка игрока в топах Сводки — новая позиция/размер (99,4,25×25, было 96,4,28×28) +
 *    небольшое скругление углов (drawRoundedRect на маске вместо drawRect).
 * 2) svod-achievements.js имеет СВОЮ копию SUBTAB_SECOND_X (документированно продублирована
 *    из svod-leaderboard.js) — прошлый раз (789→801) обновили только leaderboard-копию,
 *    achievements-копия отстала, из-за чего расстояние между кнопками ОБЩИЙ ТОП/МОИ
 *    ДОСТИЖЕНИЯ визуально отличалось в зависимости от того, какая панель открыта. Обе копии
 *    теперь синхронизированы на 801.
 * 3) CARD_TOP_OFFSET увеличен ещё на 20px (14→34), LIST_H поднят так, чтобы вмещать РОВНО 4
 *    полные карточки при новом отступе (было — умещало неполные 3).
 *
 * Run: node tests/svod-icon-position-rounding-and-subtab-sync-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const leaderSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const achSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

console.log('\nTest 1: иконка игрока в топах — новая позиция/размер + скругление углов');
{
    assert(/const AVATAR_X = 99, AVATAR_Y = 4, AVATAR_SIZE = 25, AVATAR_RADIUS = 5;/.test(leaderSrc),
        'AVATAR_X/Y/SIZE/RADIUS объявлены с новыми значениями (было 96,4,28×28, без скругления)');
    assert(/avatarMask\.drawRoundedRect\(0, 0, AVATAR_SIZE, AVATAR_SIZE, AVATAR_RADIUS\);/.test(leaderSrc),
        'маска рисуется drawRoundedRect (скруглённые углы), не drawRect');
    assert(/avatar\.x = AVATAR_X; avatar\.y = AVATAR_Y; avatar\.width = AVATAR_SIZE; avatar\.height = AVATAR_SIZE;/.test(leaderSrc),
        'сама аватарка использует именованные константы (не голые числа 28/4)');
}

console.log('\nTest 2: обе копии SUBTAB_SECOND_X синхронизированы на 801 (leaderboard И achievements)');
{
    assert(/const SUBTAB_SECOND_X = 801, SUBTAB_SECOND_Y = 191;/.test(leaderSrc), 'svod-leaderboard.js: SUBTAB_SECOND_X=801');
    assert(/const SUBTAB_SECOND_X = 801, SUBTAB_SECOND_Y = 191;/.test(achSrc), 'svod-achievements.js: своя копия ТОЖЕ 801 (была отстала на 789)');
}

console.log('\nTest 3: CARD_TOP_OFFSET увеличен на 20px (14→34), затем 23.09.2026 убран обратно (→0), LIST_H вмещает ровно 4 карточки');
{
    // 23.09.2026 (по прямому указанию — "убери лишний отступ, сделай как в топе по урону"):
    // отступ убран обратно до 0 — см. achievement-card-top-offset.test.js.
    assert(/const CARD_TOP_OFFSET = 0;/.test(achSrc), 'CARD_TOP_OFFSET = 0 (было 34, убран 23.09.2026)');
    // 22.09.2026: LIST_TOP получил ещё +50px (по прямому указанию, отдельный репорт про верхнюю
    // границу) — эта формула (LIST_H) не трогалась, проверяем именно её.
    // 25.09.2026 (по прямому указанию, редактор позиций — маска списка сделана редактируемой):
    // LIST_TOP/LIST_H сняты пользователем напрямую (242/286, было 243/298 по формуле) — см.
    // svod-scroll-editable-mask-and-dice-background-fix.test.js для полной проверки этого фикса.
    assert(/const LIST_TOP = 242, LIST_H = 286;/.test(achSrc),
        'LIST_TOP/LIST_H — явные значения из редактора позиций (было формулой 243/298)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
