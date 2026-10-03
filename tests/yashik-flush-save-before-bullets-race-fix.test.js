/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт) — "зашёл в ящик, купил патроны,
 * у меня стал не один патрон, а пять, потому что нет перерендера количества патронов, когда
 * игрок заходит в ящик".
 *
 * Корень: achievements.js._checkAll() начисляет патрон (udata['bullets']) за каждые 50 очков
 * достижений ЛОКАЛЬНО, сохраняется он общим 500мс-дебаунсом (modules/player-save.js). Если
 * игрок жмёт ОБЫСКАТЬ/«купить патрон» ДО того, как этот дебаунс успел уйти на сервер,
 * server/core/controllers/yashik.php (openBox/buyPatron) читает СВОИМ loadUser() ещё СТАРОЕ
 * значение bullets/ach_score из БД, считает от него и сохраняет всю строку — ещё не
 * сохранённый локальный прирост тихо перезаписывается ответом сервера (эффект — на экране
 * "скачок" количества патронов вместо ожидаемого +1).
 *
 * Фикс: player-save.js.flushPlayerSave() получил опциональный колбэк onDone (вызывается
 * ПОСЛЕ реального завершения сохранения или сразу, если сохранять было нечего) — обратно
 * совместимо со старыми вызовами без второго аргумента (bosses-combat.js/bosses_fight.js).
 * yashik.js оборачивает оба запроса (openBox/buyPatron) в flushPlayerSave(...), гарантируя,
 * что сервер увидит актуальные патроны ДО своего read-modify-write.
 *
 * Run: node tests/yashik-flush-save-before-bullets-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const saveSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'player-save.js'), 'utf-8');
const yashikSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');

console.log('\nTest 1: flushPlayerSave принимает опциональный onDone, вызывает его ВСЕГДА (нечего сохранять / успех / ошибка)');
{
    assert(/export function flushPlayerSave\(reason = 'manual', onDone\)\{/.test(saveSrc),
        'flushPlayerSave(reason, onDone) — новый второй параметр');
    const start = saveSrc.indexOf("export function flushPlayerSave(reason = 'manual', onDone){");
    const end   = saveSrc.indexOf('\n}', start);
    const body  = saveSrc.slice(start, end);
    assert(/if\(!canSave\(\) \|\| revision <= savedRevision\)\{\s*\n\s*if\(typeof onDone === 'function'\) onDone\(\);\s*\n\s*return false;\s*\n\s*\}/.test(body),
        'если сохранять нечего — onDone() вызывается СРАЗУ (не виснет, вызывающий код может смело продолжать)');
    assert(/if\(typeof onDone === 'function'\) onDone\(\);\s*\n\s*\}, \(error\) => \{/.test(body),
        'onDone() вызывается по успеху сохранения (в колбэке users.save)');
    assert(/if\(typeof onDone === 'function'\) onDone\(error\);/.test(body),
        'onDone(error) вызывается и при ошибке сохранения — не блокирует вызывающий код навсегда');
}

console.log('\nTest 2: старые вызовы flushPlayerSave БЕЗ onDone по-прежнему работают (обратная совместимость)');
{
    const bcSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
    const bfSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
    assert(/flushPlayerSave\('boss_fight_timeout'\);/.test(bcSrc), 'bosses-combat.js вызывает flushPlayerSave с одним аргументом — не сломано');
    assert(/flushPlayerSave\('boss_forfeit'\);/.test(bfSrc), 'bosses_fight.js вызывает flushPlayerSave с одним аргументом — не сломано');
}

console.log('\nTest 3: yashik.js импортирует flushPlayerSave и оборачивает ОБА запроса (openBox и buyPatron)');
{
    assert(/import \{ flushPlayerSave \} from '\.\.\/\.\.\/\.\.\/modules\/player-save\.js';/.test(yashikSrc),
        'flushPlayerSave импортирован');

    const obyskStart = yashikSrc.indexOf("obyskat.on('pointerdown', ()=>{");
    const obyskEnd   = yashikSrc.indexOf('\n\t\t});', obyskStart);
    const obyskBody  = yashikSrc.slice(obyskStart, obyskEnd);
    assert(/flushPlayerSave\('yashik_open', \(\) => \{/.test(obyskBody), 'ОБЫСКАТЬ: TS.php(yashik.openBox) вызывается ВНУТРИ колбэка flushPlayerSave');
    assert(/TS\.php\('yashik\.openBox', \{\}, \(res\)=>\{/.test(obyskBody), 'сам запрос openBox по-прежнему на месте (не потерян при обёртке)');

    const buyStart = yashikSrc.indexOf("hitBuy.on('pointerup', () => {");
    const buyEnd   = yashikSrc.indexOf('\n\t\t});', buyStart);
    const buyBody  = yashikSrc.slice(buyStart, buyEnd);
    assert(/flushPlayerSave\('yashik_buy_patron', \(\) => \{/.test(buyBody), 'покупка патрона: TS.php(yashik.buyPatron) вызывается ВНУТРИ колбэка flushPlayerSave');
    assert(/TS\.php\('yashik\.buyPatron', \{\}, \(res\)=>\{/.test(buyBody), 'сам запрос buyPatron по-прежнему на месте (не потерян при обёртке)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
