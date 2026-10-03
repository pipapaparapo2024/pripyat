/**
 * Test: батч 17.09.2026 (уточнение) — по прямому указанию пользователя:
 *  1) Схлопывание темы теперь применяется и к ПОПАПУ (не только к списку «Мои достижения»):
 *     если за один _checkAll() пересечено сразу несколько порогов одной темы (например,
 *     потратил разом много энергии и пересёк 3 порога), показывается попап только для
 *     САМОГО ВЫСОКОГО порога — не 3 подряд. Логика группировки вынесена в общий модуль
 *     modules/achievement-tiers.js, используется и тут, и в svod-achievements.js — не дублируется.
 *  2) Очки/бонусы (achievement_stars, ach_score→патроны) начисляются ЗА ВСЕ пересечённые
 *     пороги, а не только за тот, чей попап показан — схлопывается только ПОКАЗ, не начисление.
 *  3) Точные координаты карточки «Мои достижения» (X=354 Y=169) и первой ячейки топов
 *     (X=356 Y=236, шаг = высота ячейки 36px + 3px зазор) — сняты пользователем из PSD.
 *
 * Run: node tests/achievement-tiers-module-and-svod-coords.test.js
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

const tiersSrc   = readSrc('_client/src/modules/achievement-tiers.js');
const achSrc     = readSrc('_client/src/game/achievements.js');
const leaderSrc  = readSrc('_client/src/game/svod/svod-leaderboard.js');
const svodAchSrc = readSrc('_client/src/game/svod/svod-achievements.js');

console.log('\nTest 1: общий модуль achievement-tiers.js экспортирует всё необходимое');
{
    assert(/export function achievementThreshold\(a\)/.test(tiersSrc), 'экспортирует achievementThreshold');
    assert(/export function achievementFamilyKey\(a\)/.test(tiersSrc), 'экспортирует achievementFamilyKey');
    assert(/export function collapseToTopPerFamily\(list, earned\)/.test(tiersSrc), 'экспортирует collapseToTopPerFamily (для списка)');
    assert(/export function collapseNewlyEarnedForPopup\(newlyEarned\)/.test(tiersSrc), 'экспортирует collapseNewlyEarnedForPopup (для попапа)');
}

console.log('\nTest 2: achievements._checkAll() схлопывает попапы одной темы при одновременном пересечении нескольких порогов');
{
    assert(/import \{ collapseNewlyEarnedForPopup \} from '\.\.\/modules\/achievement-tiers\.js'/.test(achSrc),
        'achievements.js импортирует схлопывание из общего модуля');

    // 23.09.2026 (перенос достижений на сервер): _checkAll() теперь только ЛОКАЛЬНЫЙ пре-чек
    // (де-дуп, чтобы не дёргать сервер зря) — сам newlyEarned/начисление очков/показ попапов
    // переехали в _syncWithServer(), который читает ответ achievements.php.sync().
    const start = achSrc.indexOf('_checkAll(){');
    const end   = achSrc.indexOf('getTotalStars()');
    const body  = achSrc.slice(start, end);

    assert(/if\(changed\) this\._syncWithServer\(\);/.test(body), 'при пересечении порога локальный пре-чек зовёт сервер, не пишет очки сам');
    assert(!/udata\['achievement_stars'\]/.test(body), 'achievements.js больше не пишет achievement_stars напрямую (это теперь делает сервер)');

    const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'models', 'achievementengine.php'), 'utf-8');
    assert(/\$user\['achievement_stars'\] = \$ops->i\(\$user, 'achievement_stars'\) \+ \$pts;/.test(engineSrc),
        'очки начисляются ЗА КАЖДОЕ пересечённое достижение на сервере (achievement_engine.checkAll)');

    assert(!/for\(const a of this\.list\)\{[\s\S]*?this\._openAchievementPopup\(a\);/.test(body),
        '_openAchievementPopup больше не вызывается прямо внутри цикла по всем достижениям');
    assert(/const toShow = collapseNewlyEarnedForPopup\(newlyEarned\);/.test(body),
        'схлопывает newlyEarned (полученный от сервера) через общий модуль перед показом попапов');
    assert(/toShow\.forEach\(a => this\._openAchievementPopup\(a\)\);/.test(body),
        'открывает попап только для результата схлопывания (по одному на тему), не для каждого newlyEarned');
}

console.log('\nTest 3: координаты карточки «Мои достижения» и ячейки топов — точные из PSD');
{
    // 25.09.2026 (по прямому указанию, редактор позиций — маска списка сделана редактируемой,
    // см. коммент в svod-scroll.js): CARD_X/LIST_TOP/LIST_H сняты пользователем напрямую
    // (349/242/286), больше не точные PSD-числа/формула — см.
    // svod-scroll-editable-mask-and-dice-background-fix.test.js.
    assert(/const CARD_X = 349;/.test(svodAchSrc), 'CARD_X = 349 (было 354, снято редактором позиций)');
    assert(/const LIST_TOP = 242, LIST_H = 286;/.test(svodAchSrc),
        'LIST_TOP = 242, LIST_H = 286 (было 243/298 — явные значения из редактора позиций, не формула)');

    assert(/const ROW_X = 356;/.test(leaderSrc), 'ROW_X = 356 (точное значение)');
    assert(/const LIST_TOP = 236;/.test(leaderSrc), 'LIST_TOP = 236 — позиция первой ячейки (точное значение)');
    // 19.09.2026: зазор поднят с 3 до 6px по прямому указанию пользователя, см.
    // svod-achievements-bg-and-weapon-tier-damage.test.js — здесь просто синхронизируем значение.
    assert(/const ROW_W = 669, CELL_H = 36, ROW_GAP = 6;/.test(leaderSrc), 'высота ячейки 36px и зазор 6px заданы явно');
    assert(/const ROW_H = CELL_H \+ ROW_GAP;/.test(leaderSrc), 'шаг между ячейками = высота ячейки + зазор (42px)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
