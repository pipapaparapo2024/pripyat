/**
 * Test: 26.10.2026 — репорт с тестового сервера: "dev-панель не работает, не могу выдать все
 * ресурсы". Разбор лога показал ДВА независимых бага за одним репортом (боевые ключи боссов —
 * отдельный, уже чинился в этой же сессии ранее, см. boss-keys-devpanel-persist-fix.test.js).
 * Этот файл — ВТОРОЙ, более старый (с 19.10.2026) баг: кнопки "Опыт" (+1К/+10К/+100К/+1М) в
 * dev-панели.
 *
 * Корень: 19.10.2026 'exp' убран из client-writable $allowed в users.php (закрытие дыры —
 * читер мог накрутить себе уровень обычным users.save()). devGrantCurrency() (users.php) и
 * _giveMillion()/_resetAccount() (dev_panel.js) были переведены на серверный дельта-путь тем
 * же днём — НО отдельный хелпер _addU(key, amt) (используется ТОЛЬКО кнопками "Опыт", остальные
 * его вызовы — coins/cigarettes/stew/dice_points/blue_points, уже были в списке) со своим
 * массивом _SERVER_ONLY_CURRENCIES забыли обновить. С 19.10.2026 клик "Опыт +N" тихо падал в
 * обычный users.save(), который просто игнорирует неразрешённое поле — ни ошибки, ни эффекта,
 * удобно пропустить при живом тестировании (нет визуального фидбека о провале).
 *
 * Фикс — добавить 'exp' в _SERVER_ONLY_CURRENCIES (сервер его уже поддерживает в
 * devGrantCurrency(), не трогали).
 *
 * Run: node tests/dev-panel-exp-button-server-only-gap.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const devPanel = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const usersPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');

console.log('\nTest 1: клиент — _SERVER_ONLY_CURRENCIES включает \'exp\' (кнопки "Опыт" больше не падают в обычный users.save())');
{
    const m = devPanel.match(/const _SERVER_ONLY_CURRENCIES = \[([^\]]*)\];/);
    assert(!!m, '_SERVER_ONLY_CURRENCIES найден');
    assert(m && m[1].includes("'exp'"), "'exp' присутствует в _SERVER_ONLY_CURRENCIES");
    // Регресс-гвард: остальные 6 полей (фиксились раньше) не потерялись при правке.
    ['coins', 'stew', 'cigarettes', 'dice_points', 'blue_points', 'poker_chips'].forEach(k => {
        assert(m && m[1].includes(`'${k}'`), `'${k}' всё ещё в _SERVER_ONLY_CURRENCIES (не потерян правкой)`);
    });
}

console.log('\nTest 2: клиент — _addU(\'exp\', amt) реально роутится через _grantCurrencyServer (не прямое udata[key]=...)');
{
    const start = devPanel.indexOf('const _addU = (key, amt) => {');
    assert(start !== -1, '_addU найден');
    const end = devPanel.indexOf('const _energy = (amount) => {', start);
    const body = devPanel.slice(start, end);
    assert(/if\(_SERVER_ONLY_CURRENCIES\.includes\(key\)\)\{/.test(body), '_addU проверяет _SERVER_ONLY_CURRENCIES ДО прямой записи в udata');
    assert(/_grantCurrencyServer\(\{\[key\]: amt\}/.test(body), '_addU вызывает _grantCurrencyServer для server-only ключей');
}

console.log('\nTest 3: сервер — devGrantCurrency() уже поддерживает \'exp\' в $allowedTypes (не трогали, уже было)');
{
    const m = usersPhp.match(/\$allowedTypes = \[([^\]]*(?:\n[^\]]*)*)\];/);
    assert(!!m, '$allowedTypes в devGrantCurrency() найден');
    assert(m && m[1].includes("'exp'"), "'exp' присутствует в $allowedTypes на сервере");
}

console.log('\nTest 4: sanity — кнопки "Опыт" в UI реально зовут _addU(\'exp\', ...)');
{
    assert(/_addU\('exp',1000\)/.test(devPanel) || /_addU\('exp', *1000\)/.test(devPanel),
        'кнопка "+1К" опыта зовёт _addU(\'exp\', 1000)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
