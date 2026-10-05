/**
 * Test: батч 19.09.2026 — репорт "купил много шмоток, потратил много монет, а ачивка про
 * траты появилась только после победы над боссом Охотник".
 *
 * Причина — ДВЕ независимые дыры в shmot.js/shmot.php, обе исправлены здесь:
 *
 *  1) shmot.js._buy() (ни старая версия, ни моя честная запрос-ответ версия из прошлого
 *     батча) НИКОГДА не вызывала achievements.onXxx() после успешной покупки — в отличие от
 *     ЛЮБОЙ другой покупки в игре (weapons.js._buy → achievements.onWeaponBuy). Прогресс по
 *     ачивкам category:'spend_coins' пересчитывался achievements._checkAll() только когда
 *     СЛУЧАЙНО срабатывал другой, никак не связанный триггер (например onBossKill после
 *     победы) — то есть с произвольной задержкой, а не сразу после самой покупки.
 *  2) shmot.php.buy() вообще не увеличивал coins_spent при покупке за монеты (Gameops::deduct()
 *     сам трекает только stew_spent для тушёнки — coins_spent каждый вызывающий контроллер
 *     обязан прибавлять сам, как это уже делает weapons.php/blackjack.php). shmot.php был
 *     единственным местом трат монет в игре, которое этого не делало вовсе.
 *
 * Run: node tests/shmot-achievement-trigger.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotJsSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const achSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'achievements.js'), 'utf-8');
const shmotPhpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'shmot.php'), 'utf-8');

console.log('\nTest 1: achievements.js определяет onShmotBuy(), вызывающий _checkAll() (как onWeaponBuy)');
{
    const m = achSrc.match(/onShmotBuy\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'onShmotBuy() найден в achievements.js');
    assert(m && /this\._checkAll\(\);/.test(m[1]), 'onShmotBuy() вызывает this._checkAll()');
}

console.log('\nTest 2: shmot.js._buy() вызывает achievements.onShmotBuy() СРАЗУ после успешной покупки');
{
    const buyMatch = shmotJsSrc.match(/\t_buy\(item\)\{([\s\S]*?)\n\t\}/);
    assert(!!buyMatch, '_buy(item) найден');
    const body = buyMatch[1];
    assert(/if\(window\.achievements\) achievements\.onShmotBuy\(\);/.test(body),
        '_buy() дёргает achievements.onShmotBuy() внутри колбэка успеха TS.php');

    const applyPatchIdx = body.indexOf('applyPatch(res.patch)');
    const achCallIdx    = body.indexOf('achievements.onShmotBuy()');
    assert(applyPatchIdx !== -1 && achCallIdx !== -1 && achCallIdx > applyPatchIdx,
        'achievements.onShmotBuy() вызывается ПОСЛЕ applyPatch (когда udata уже обновлена свежим coins_spent)');
}

console.log('\nTest 3: shmot.php.buy() увеличивает coins_spent при покупке за монеты (как weapons.php/blackjack.php)');
{
    const buyMatch = shmotPhpSrc.match(/function buy\(\)\{([\s\S]*?)\n    \}/);
    assert(!!buyMatch, 'buy() найден в shmot.php');
    const body = buyMatch[1];
    assert(/\$item\['price'\]\['type'\] === 'coins'/.test(body), 'проверяется, что тип цены именно монеты');
    // 05.10.2026 (стале-пин, не регрессия — блокировка строки в shmot.php.buy(), $lockedUser
    // вместо $user внутри лока; $patch строится уже после saveUser() из реального $user).
    assert(/\$this->ops->add\(\$lockedUser, 'coins_spent', \$cost\);/.test(body), "coins_spent увеличивается на \$cost при покупке за монеты");
    assert(/\$patch\['coins_spent'\] = \$this->ops->i\(\$user, 'coins_spent'\);/.test(body),
        'обновлённый coins_spent явно попадает в patch, отправляемый клиенту');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
