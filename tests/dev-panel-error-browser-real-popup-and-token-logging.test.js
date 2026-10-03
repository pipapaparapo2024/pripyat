/**
 * Test: 26.09.2026, по прямому указанию —
 *
 * 1) "кнопка «Показать» в блоке текста ошибок должна показывать попап ошибки из игры, а не
 *    только текст" — dev_panel.js._openErrorBrowser() раньше рисовал код+текст СВОИМ
 *    собственным стилем карточки, дев не видел, как ошибка реально выглядит для игрока.
 *    Теперь при открытии и на каждой ◀/▶ дополнительно поднимается настоящий игровой попап
 *    ошибки (iface._openSidorovichError — тот же компонент, что видит живой игрок), с текстом
 *    ТЕКУЩЕЙ записи каталога. Попап явно перевешивается ВНУТРЬ devWin — иначе тикер
 *    _devWinTickerFn (поднимает devWin на верх layer2_mc КАЖДЫЙ кадр) закрыл бы попап уже
 *    на следующем кадре.
 *    Заодно каталог DEV_ERROR_CATALOG (зеркало server/json/errors.json для офлайн-браузера)
 *    обновлён — добавлены коды 67-69/79-83, добавленные этой же сессией в errors.json.
 *
 * 2) "сделал ли ты логирование частой ошибки 'невалидный токен сессии' более подробным?" —
 *    universal.php.checkToken() раньше не писал НИ ОДНОГО error_log() ни на одну из веток
 *    отказа (коды 2/3/4/5) — при повторном сбое расследовать было буквально не по чему, кроме
 *    текущего (уже, возможно, здорового) состояния БД. Теперь каждая ветка логирует полный
 *    снимок сравниваемых значений (uid, method, токены/req_key/время) в момент самого сбоя.
 *
 * Run: node tests/dev-panel-error-browser-real-popup-and-token-logging.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const devPanelSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const universalSrc = fs.readFileSync(path.join(root, 'server', 'universal.php'), 'utf-8');

console.log('\nTest 1: DEV_ERROR_CATALOG — новые коды казино (67-69, 79-83) добавлены, зеркалит errors.json');
{
    [67, 68, 69, 79, 80, 81, 82, 83].forEach(code => {
        assert(new RegExp('\\{code:' + code + ',\\s*text:').test(devPanelSrc), 'код ' + code + ' есть в DEV_ERROR_CATALOG');
    });
}

console.log('\nTest 2: _openErrorBrowser() — каждый рендер поднимает настоящий игровой попап ошибки');
{
    const start = devPanelSrc.indexOf('const _render = () => {');
    const body = devPanelSrc.slice(start, start + 1700);
    assert(/iface\._openSidorovichError\('Ошибка ' \+ e\.code, e\.text\);/.test(body),
        'реальный попап открывается с текстом ТЕКУЩЕЙ записи каталога (title="Ошибка N")');
    assert(/if\(iface\._sidErrorWin\) this\._devWin\.addChild\(iface\._sidErrorWin\);/.test(body),
        'попап перевешивается внутрь devWin — иначе тикер devWin закрыл бы его на следующем кадре');
}

console.log('\nTest 3: universal.php.checkToken() — все 4 ветки отказа (2/3/4/5) логируют детальный снимок');
{
    const start = universalSrc.indexOf('function checkToken()');
    const body = universalSrc.slice(start, start + 2900);
    assert(/error_log\('\[universal\.checkToken\] код 2/.test(body), 'код 2 (токен не найден) логируется');
    assert(/error_log\('\[universal\.checkToken\] код 5/.test(body), 'код 5 (несовпадение токена) логируется с началом обоих токенов');
    assert(/error_log\('\[universal\.checkToken\] код 3/.test(body) && /tokenAgeSec/.test(body) && /expiredAgoSec/.test(body),
        'код 3 (истёк токен) логирует возраст токена и на сколько именно просрочен');
    assert(/error_log\('\[universal\.checkToken\] код 4/.test(body) && /postReqKey/.test(body) && /dbReqKey/.test(body),
        'код 4 (несовпадение req_key) логирует оба значения для сравнения');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
