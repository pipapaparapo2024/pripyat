/**
 * Test: 27.09.2026, по репорту "покупка всё ещё странно себя ведёт" (тот же класс гонки, что
 * уже чинили для bank.js/shmot.js/weapons.js/zone.js — два независимых источника правды для
 * одной покупки):
 *
 *  1) _buy(idx) раньше СРАЗУ списывал валюту и применял item.effect ЛОКАЛЬНО, а
 *     vassilich.php.buy() на сервере НЕЗАВИСИМО делал то же самое второй раз по своей копии из
 *     БД — итоговый баланс мог задвоиться, если автосейв успевал улететь между локальным
 *     списанием и ответом сервера. Теперь честный запрос→ответ (как shmot.js._buy()/
 *     weapons.js._buy()): ничего не меняем локально, применяем ТОЛЬКО patch из ответа сервера.
 *  2) _openLoot() раньше катал RNG ЛОКАЛЬНО по this.lootTable (_rollLoot()), показывал этот приз
 *     игроку и применял его эффект — а сервер (vassilich.php.open_loot()) НЕЗАВИСИМО катал СВОЙ
 *     RNG по server/json/vassilich_loot.json: игрок видел один приз в уведомлении/"последних
 *     находках", а реальный прирост валюты соответствовал СОВСЕМ другому предмету. Теперь приз
 *     берётся из ответа сервера (e.loot), локальный RNG для открытия ящика не используется.
 *
 * Run: node tests/vassilich-server-authoritative-buy-and-loot.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'vassilich.js'), 'utf-8');
const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'vassilich.php'), 'utf-8');

console.log('\nTest 1: _buy(idx) больше не мутирует состояние ДО ответа сервера (честный запрос-ответ, как shmot.js._buy)');
{
    const m = src.match(/\t_buy\(idx\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_buy(idx) найден');
    const body = m ? m[1] : '';

    assert(!/udata\[currency\] = have - cost;/.test(body),
        'валюта больше не списывается локально до ответа сервера');
    assert(!/this\._applyEffect\(item\.effect\);/.test(body),
        'item.effect больше не применяется локально до ответа сервера');
    assert(!/^\s*TS\.php\('vassilich\.buy', \{item_id:item\.id\}, \(e\)=>\{ if\(e && e\.patch\) applyPatch/m.test(body),
        'старый fire-and-forget вызов (без in-flight guard и без err-колбэка) удалён');

    const tsCallIdx     = body.indexOf("TS.php('vassilich.buy'");
    const applyPatchIdx = body.indexOf('applyPatch(e.patch)');
    assert(tsCallIdx !== -1, "TS.php('vassilich.buy', ...) вызывается");
    assert(applyPatchIdx !== -1 && applyPatchIdx > tsCallIdx,
        'applyPatch(e.patch) вызывается ВНУТРИ колбэка успеха (после ответа сервера)');

    assert(/if\(this\._vassilichBuyInFlight\)\{/.test(body), 'есть guard от повторного клика во время запроса (in-flight)');
    assert(/this\._vassilichBuyInFlight = true;/.test(body) && /this\._vassilichBuyInFlight = false;/.test(body),
        'флаг in-flight выставляется перед запросом и сбрасывается в обоих колбэках (успех/ошибка)');

    const errCbIdx = body.indexOf('}, (err)=>{');
    assert(errCbIdx !== -1 && errCbIdx > applyPatchIdx,
        'есть err-колбэк (ошибка сервера больше не игнорируется молча, как раньше с null)');
}

console.log('\nTest 2: _openLoot() больше не катает RNG и не применяет приз локально — ждёт e.loot от сервера');
{
    const m = src.match(/\t_openLoot\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_openLoot() найден');
    const body = m ? m[1] : '';

    assert(!/udata\['cigarettes'\] = parseInt\(udata\['cigarettes'\] \|\| 0\) - cost;/.test(body),
        'сигареты больше не списываются локально до ответа сервера');
    assert(!/const item = this\._rollLoot\(\);/.test(body),
        '_openLoot() больше не катает локальный RNG через _rollLoot() для определения приза');
    assert(!/this\._applyEffect\(item\.effect\);/.test(body),
        'приз больше не применяется локально до ответа сервера');

    const tsCallIdx     = body.indexOf("TS.php('vassilich.open_loot'");
    const applyPatchIdx = body.indexOf('applyPatch(e.patch)');
    assert(tsCallIdx !== -1, "TS.php('vassilich.open_loot', ...) вызывается");
    assert(applyPatchIdx !== -1 && applyPatchIdx > tsCallIdx,
        'applyPatch(e.patch) вызывается ВНУТРИ колбэка успеха (после ответа сервера)');

    assert(/if\(this\._vassilichLootInFlight\)\{/.test(body), 'есть guard от повторного клика во время запроса (in-flight)');
    assert(/e\.loot\.name/.test(body) && /e\.loot\.rarity/.test(body),
        'приз (имя/редкость) для уведомления и "последних находок" берётся из ответа сервера (e.loot), не из локального броска');

    const errCbIdx = body.indexOf('}, (err)=>{');
    assert(errCbIdx !== -1 && errCbIdx > applyPatchIdx,
        'есть err-колбэк на случай ошибки сервера');
}

console.log('\nTest 3: server/core/controllers/vassilich.php — buy()/open_loot() остаются единственным источником начисления (server-authoritative)');
{
    assert(/\$this->permits = \['buy', 'open_loot'\];/.test(phpSrc), "permits ограничены ['buy','open_loot']");
    // 05.10.2026 (стале-пин, не регрессия — vassilich.php получил SELECT...FOR UPDATE, см.
    // tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js стиль фикса).
    assert(/if\(!\$this->ops->deduct\(\$lockedUser, \$type, \$amount\)\)\{[\s\S]{0,120}?return \$this->ops->fail\(50\);/.test(phpSrc),
        'buy() списывает валюту через Gameops::deduct с проверкой баланса (не даёт уйти в минус)');
    assert(/if\(!\$this->ops->deduct\(\$lockedUser, 'cigarettes', 5\)\)\{[\s\S]{0,120}?return \$this->ops->fail\(50\);/.test(phpSrc),
        "open_loot() списывает 5 сигарет через Gameops::deduct");
    assert(/\$pick = \$pool\[array_rand\(\$pool\)\];/.test(phpSrc), 'open_loot() катает RNG по своей копии server/json/vassilich_loot.json');
    assert(/'loot' => \['name'=>\$pick\['name'\], 'rarity'=>intval\(\$pick\['rarity'\]\?\?0\)\]/.test(phpSrc),
        'open_loot() возвращает реально выпавший приз (name/rarity) клиенту, а не только patch');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
