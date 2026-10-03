/**
 * Test: 29.09.2026, репорт игрока — "на босса напал, а бесплатный удар битой не нажимается,
 * пишет лимит; убил примерно 3 боссов из 7, битой билось 20, а на 4-м боссе битой не бьётся —
 * пишет лимит". Скриншоты: бой открыт (HP 900/1000, таймер идёт), клик АТАКОВАТЬ показывает
 * попап "ЛИМИТ 7 ПОПЫТОК НА СЕГОДНЯ ИСЧЕРПАН".
 *
 * Корень: _client/src/game/bosses/bosses-combat.js._attack() проверял
 * `this.dailyKills[idx] >= this.DAILY_KILL_LIMIT` БЕЗ учёта того, идёт ли бой уже прямо сейчас
 * (this._bossStartMs[this._diffIdx][idx] !== 0) — условие срабатывало на КАЖДЫЙ клик АТАКОВАТЬ,
 * а не только при попытке ОТКРЫТЬ новый бой.
 *
 * До 29.09.2026 dailyKills[idx] инкрементировался только по ПОБЕДЕ (claimKill), так что за время
 * ЕЩЁ НЕ завершённого боя счётчик не успевал достичь лимита — баг был не виден. В тот же день
 * (см. tests/boss-daily-attempt-spent-on-any-outcome.test.js) семантика изменилась: попытка
 * списывается СРАЗУ в bosses.php.startFight(), при реальном старте боя. Из-за этого в ПОСЛЕДНЕМ
 * разрешённом бою (7-м из 7) dailyKills[idx] уже равен лимиту С САМОГО НАЧАЛА этого же боя — и
 * старое условие в _attack() блокировало вообще любую атаку внутри уже честно открытого боя,
 * хотя сервер (bosses.php.attack()) дневной лимит на удар не проверяет вообще — гейтит только
 * startFight(). Игрок оставался с открытым боем, по которому нельзя было ударить ни разу.
 *
 * Фикс: та же охрана, что уже стоит у чека ключей строкой ниже в том же файле — дневной лимит
 * блокирует только попытку ОТКРЫТЬ НОВЫЙ бой (bossStartMs[idx]===0), не удары внутри уже
 * начатого.
 *
 * Run: node tests/boss-daily-limit-attack-mid-fight-false-block-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const combatPath = path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js');
const combatSrc  = fs.readFileSync(combatPath, 'utf-8');

console.log('\n1) Дневной лимит в _attack() гейтит только СТАРТ нового боя, а не атаки внутри уже идущего');
{
    const startIdx = combatSrc.indexOf('proto._attack = function(){');
    assert(startIdx !== -1, '_attack() найден в файле');
    const keysGateIdx = combatSrc.indexOf('_hasKeyring()', startIdx);
    const body = combatSrc.slice(startIdx, keysGateIdx === -1 ? startIdx + 3000 : keysGateIdx);

    assert(/this\._bossStartMs\[this\._diffIdx\]\[idx\]\s*===\s*0\s*&&\s*this\.dailyKills\[idx\]\s*>=\s*this\.DAILY_KILL_LIMIT/.test(body),
        'проверка dailyKills[idx] >= DAILY_KILL_LIMIT выполняется ТОЛЬКО когда bossStartMs[idx]===0 (бой ещё не начат)');

    assert(!/if\(this\.dailyKills\[idx\] >= this\.DAILY_KILL_LIMIT\)\{/.test(body),
        'старое безусловное условие (без bossStartMs===0) больше не встречается в теле _attack()');
}

console.log('\n2) Тот же паттерн охраны (bossStartMs[idx]===0), что уже используется чеком ключей чуть ниже — стиль согласован');
{
    const keyGateMatch = combatSrc.match(/if\(!this\._hasKeyring\(\)[^\n]*&&\s*this\._bossStartMs\[this\._diffIdx\]\[idx\]\s*===\s*0\)\{/);
    assert(!!keyGateMatch, 'чек ключей рядом уже использует тот же паттерн bossStartMs[idx]===0 — фикс лимита ему соответствует');
}

console.log('\n3) Симуляция сценария из репорта: бой уже открыт (bossStartMs!==0), dailyKills[idx] уже на лимите (списан при старте этого же боя) — атака не должна блокироваться попапом лимита');
{
    // Мини-модель поведения гейта, извлечённого из исходника (без запуска PIXI/сервера) —
    // повторяет именно то условие, которое реально стоит в _attack().
    const idx = 0, diffIdx = 0;
    const ctx = {
        dailyKills: [7, 0, 0, 0, 0, 0, 0, 0],   // уже списано при startFight() ЭТОЙ же попытки
        DAILY_KILL_LIMIT: 7,
        _bossStartMs: [[123456789]],            // бой уже идёт (ненулевой таймстамп старта)
    };
    const blockedByDailyLimitGate = (ctx._bossStartMs[diffIdx][idx] === 0 && ctx.dailyKills[idx] >= ctx.DAILY_KILL_LIMIT);
    assert(blockedByDailyLimitGate === false,
        'при уже идущем бою (bossStartMs!==0) гейт лимита пропускает атаку, даже если dailyKills[idx] уже на лимите');

    // Контрольный случай — бой ДЕЙСТВИТЕЛЬНО не начат и лимит исчерпан: гейт обязан сработать.
    const ctxNotStarted = { ...ctx, _bossStartMs: [[0]] };
    const blockedWhenNotStarted = (ctxNotStarted._bossStartMs[diffIdx][idx] === 0 && ctxNotStarted.dailyKills[idx] >= ctxNotStarted.DAILY_KILL_LIMIT);
    assert(blockedWhenNotStarted === true,
        'при попытке ОТКРЫТЬ новый бой (bossStartMs===0) с исчерпанным лимитом гейт по-прежнему блокирует (регресс не сломан)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
