/**
 * Test: 18.09.2026 — репорт пользователя со скриншотом: при попытке купить оружие без
 * достаточного количества рублей выскакивал попап "ТОРМОЗИ! ОРУЖИЯ НЕТУ У ТЕБЯ, ЕГО НУЖНО
 * КУПИТЬ!" — картинка/текст, сделанные для СОВСЕМ другого сценария (нет экипированного
 * оружия в бою, см. iface._openNoWeaponPopup в bosses_fight.js), а не для нехватки денег
 * при покупке. weapons.js._buy() показывал weapons._errorWin (built из
 * "не хватает оружия.png") вместо нормальной ошибки нехватки средств.
 *
 * Run: node tests/weapon-buy-insufficient-funds-wrong-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(path.join(__dirname, '..', '_client/src/game/weapons.js'), 'utf-8');

console.log('\nTest 1: _buy() при нехватке денег показывает нормальную ошибку, не "не хватает оружия"');
{
    const start = src.indexOf('_buy(idx){');
    const end   = src.indexOf('\n\t}', start);
    const body  = src.slice(start, end);

    assert(/iface\._openSidorovichError\('Недостаточно рублей!'/.test(body),
        'вызывает iface._openSidorovichError(\'Недостаточно рублей!\', ...) — тот же паттерн, что и везде в проекте');
    assert(/'Нужно: ' \+ totalCost \+ ' • У вас: ' \+ curCoins/.test(body),
        'подсказка показывает и сколько нужно, и сколько есть у игрока');
    assert(!/this\._errorWin/.test(body), 'больше не трогает weapons._errorWin (попап "не хватает оружия")');
}

console.log('\nTest 2: попап "не хватает оружия" (_buildErrorWin) удалён целиком — был мёртвым кодом после фикса');
{
    assert(!/_buildErrorWin/.test(src), '_buildErrorWin нигде не определён и не вызывается');
    assert(!/BASE \+ 'не хватает оружия\.png'/.test(src),
        'текстура "не хватает оружия.png" больше нигде не загружается как спрайт (упоминание в поясняющем комментарии — не в счёт)');
    assert(!src.includes('this._errorWin'), 'поле this._errorWin нигде не используется (полностью удалено, не просто отключено)');
}

console.log('\nTest 3: обычная покупка (достаточно денег) не задета фиксом');
{
    // 18.09.2026 (позже этого батча — перенос Оружия на сервер): списание монет и owned=true
    // переехали в weapons.php.buy() — клиент теперь только шлёт запрос и применяет патч.
    // Подробно проверено в weapons-server-authoritative.test.js — здесь просто сверяем, что
    // сам вызов на сервер и обработка успеха никуда не делись.
    const start = src.indexOf('_buy(idx){');
    const end   = src.indexOf('\n\t}', src.indexOf("TS.php('weapons.buy'", start));
    const body  = src.slice(start, end);
    assert(/TS\.php\('weapons\.buy', \{weapon_id: idx, mult: mult\}/.test(body), 'покупка уходит на сервер (weapons.buy)');
    assert(/applyPatch\(res\.patch\)/.test(body), 'успешный ответ применяется через applyPatch (owned/qty/coins обновляются из патча сервера)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
