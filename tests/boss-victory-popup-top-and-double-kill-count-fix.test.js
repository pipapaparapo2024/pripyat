/**
 * Test: батч 22.09.2026 (по прямому указанию, репорт "в попап победы над боссом нет иконок
 * игроков и цифр урона, считает 1 победу за 2") — два независимых бага боевой системы.
 *
 * Баг 1 (пустой попап победы): bosses.php.claimKill() сбрасывал bossStartMs=0 и сохранял его
 * ДО того, как попап boss_result.js успевал сделать СВОЙ отдельный запрос bosses.rating() —
 * rating() вычисляет startMs из уже обнулённого bossStartMs и всегда возвращал пустой top.
 * Фикс: claimKill() сам считает топ участников (тем же кодом, что rating() — вынесен в общий
 * _ratingTop()) ДО сброса bossStartMs и отдаёт его прямо в своём ответе; boss_result.js берёт
 * top из ответа claimKill (см. bosses-combat.js._onDefeat), не делая отдельный запрос при победе.
 *
 * Баг 2 (1 победа считается за 2): achievements.js.onBossKill() сам перечитывал
 * udata['bosses_data'] и делал killsTotal[idx] += 1 — но сервер уже применил +1 через
 * res.patch (bosses.php.claimKill) ДО вызова onBossKill (см. bosses-combat.js._onDefeat).
 * Итог — двойной инкремент. Фикс: убрать перезапись killsTotal из onBossKill() целиком.
 *
 * Run: node tests/boss-victory-popup-top-and-double-kill-count-fix.test.js
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

const bossesPhp    = readSrc('server/core/controllers/bosses.php');
const combatSrc    = readSrc('_client/src/game/bosses/bosses-combat.js');
const achSrc       = readSrc('_client/src/game/achievements.js');
const bossResultSrc= readSrc('_client/src/game/shell/popups/boss_result.js');

console.log('\nTest 1: claimKill() считает топ участников ДО сброса bossStartMs, отдаёт его в ответе');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.lastIndexOf('$this->ops->ok(['));
    const body  = bossesPhp.slice(start, end);

    const topCalcIdx  = body.indexOf('$topEntries = $this->_ratingTop(');
    const resetIdx     = body.indexOf("$data['bossStartMs'][$diffIdx][$bossId] = 0;");
    assert(topCalcIdx > -1, 'claimKill() вызывает _ratingTop() для расчёта топа');
    assert(resetIdx > -1, 'claimKill() по-прежнему сбрасывает bossStartMs в 0 после награды');
    assert(topCalcIdx < resetIdx, '_ratingTop() вызывается ДО сброса bossStartMs — иначе топ снова будет считаться с уже нулевого старта');
    assert(/'top' => \$topEntries,/.test(body), 'ответ claimKill() содержит поле top с посчитанными участниками');
}

console.log('\nTest 2: bosses-combat.js._onDefeat() передаёт top из ответа claimKill прямо в попап, минуя отдельный запрос');
{
    // Два вызова _showBossResultPopup существуют (поражение/таймаут и победа) — берём тот, что
    // рядом с isWin: true (победа), не первый попавшийся (первый — ветка поражения).
    const winMarker = combatSrc.indexOf('isWin: true,');
    const start = combatSrc.lastIndexOf('iface._showBossResultPopup({', winMarker);
    const end   = combatSrc.indexOf('});', start);
    const body  = combatSrc.slice(start, end);
    assert(/top: Array\.isArray\(res\.top\) \? res\.top : \[\],/.test(body),
        'опция top берётся напрямую из ответа claimKill (res.top), не из отдельного запроса');
}

console.log('\nTest 3: boss_result.js использует opts.top при победе, не делает лишний bosses.rating() запрос');
{
    // 24.09.2026 (баг "на попапе поражения висит чужой/давний урон", по прямому указанию):
    // условие расширено — opts.top теперь применяется для ЛЮБОГО исхода боя (не только
    // победы), т.к. endFightSession() (поражение/таймаут) тоже стал считать и возвращать top
    // заранее, тем же приёмом, что claimKill() уже делал для победы. См.
    // boss-defeat-popup-fresh-rating-top-no-race.test.js для полного покрытия.
    assert(/if\(Array\.isArray\(opts\.top\)\)\{/.test(bossResultSrc),
        'popup использует уже готовый opts.top для любого исхода боя (не только победы)');
    assert(/\} else if\(window\.TS && window\.bosses\)\{/.test(bossResultSrc),
        'запрос bosses.rating() остаётся ТОЛЬКО как fallback (если вызывающий код вообще не передал top)');
    assert(/TS\.php\('bosses\.rating', \{ boss_id: bossIdx, diff_idx: diffIdx \}/.test(bossResultSrc),
        'fallback-запрос всё ещё присутствует для случаев без готового top');
}

console.log('\nTest 4: achievements.js.onBossKill() больше НЕ дублирует инкремент killsTotal (сервер уже применил через patch)');
{
    const start = achSrc.indexOf('onBossKill(idx, isSolo, fightMs){');
    const end   = achSrc.indexOf('\n\tonWeaponBuy', start);
    const body  = achSrc.slice(start, end);
    assert(!/bd\.killsTotal\[idx\] = \(bd\.killsTotal\[idx\] \|\| 0\) \+ 1;/.test(body),
        'onBossKill() больше не перечитывает и не инкрементирует udata[\'bosses_data\'].killsTotal — раньше это задваивало счётчик побед');
    assert(!/JSON\.parse\(udata\['bosses_data'\] \|\| '\{\}'\)/.test(body),
        'onBossKill() больше не парсит bosses_data целиком ради killsTotal — сервер уже прислал актуальное значение через applyPatch');
    // solo_kills — отдельный, чисто клиентский счётчик, сервер его не трогает, оставлен как был.
    assert(/if\(isSolo\)\{/.test(body) && /udata\['solo_kills'\]/.test(body),
        'solo_kills по-прежнему считается на клиенте — сервер это поле не пишет');
}

console.log('\nTest 5: bosses.php.claimKill() действительно применяет killsTotal через patch ДО вызова клиентского onBossKill');
{
    const claimStart = bossesPhp.indexOf('function claimKill(){');
    const claimEnd   = bossesPhp.indexOf('\n        }', bossesPhp.lastIndexOf('$this->ops->ok(['));
    const claimBody  = bossesPhp.slice(claimStart, claimEnd);
    assert(/\$data\['killsTotal'\]\[\$bossId\] = intval\(\$data\['killsTotal'\]\[\$bossId\]\) \+ 1;/.test(claimBody),
        'сервер инкрементирует killsTotal ровно на 1 за победу');
    assert(/'bosses_data',/.test(claimBody), 'bosses_data (содержащее killsTotal) включено в patchCurrencies() — клиент получит свежее значение');

    // Порядок в bosses-combat.js: applyPatch(res.patch) — ДО вызова achievements.onBossKill().
    const onDefeatBody = combatSrc.slice(combatSrc.indexOf('TS.php(\'bosses.claimKill\''), combatSrc.indexOf('if(window.achievements) achievements.onBossKill('));
    assert(/applyPatch\(res\.patch\);/.test(onDefeatBody), 'applyPatch(res.patch) вызывается ДО achievements.onBossKill() — killsTotal из сервера уже применён к моменту клиентского вызова');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
