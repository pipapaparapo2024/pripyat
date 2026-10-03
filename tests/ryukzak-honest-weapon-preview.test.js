/**
 * Test: 04.10.2026, по прямому указанию — "весь вес оружия идёт в иконку автомата как
 * ориентир — реальный разброс решает RNG сервера только в момент открытия... такого быть не
 * должно, должно сразу рассчитываться какое оружие и в каких количествах будет в награде
 * рюкзака, и указываться также в рюкзаке".
 *
 * Корень: розыгрыш мачете/ствола/автомата (RNG по весам d=[%,%,%]) происходил ТОЛЬКО внутри
 * ryukzak.php.open(), в момент клика ЗАБРАТЬ. До клика клиент не мог знать реальный сплит и
 * показывал весь вес тира под иконкой автомата как грубый ориентир (mach:0, pist:0 всегда на
 * превью) — игрок видел "скоро получу автомат ×N", а на деле получал любую комбинацию трёх
 * видов оружия.
 *
 * Фикс:
 * 1) server/core/controllers/ryukzak.php — новый метод preview() считает ТОТ ЖЕ уровень/тир
 *    и катает ТОТ ЖЕ бросок оружия, что и open(), но ничего не списывает/не начисляет.
 * 2) Чтобы preview() и open() гарантированно совпадали (не просто "похожий" ориентир, а именно
 *    то, что реально будет выдано), оба сеют mt_rand() ОДНИМ детерминированным seed из
 *    uid+ryukzak_points (общий приватный helper _rollWeapons()) — пока очки не изменились между
 *    показом превью и кликом ЗАБРАТЬ (а они растут только с боёв боссов, не за время просмотра
 *    экрана), оба вызова катают идентичную последовательность и дают идентичный mach/pist/ak.
 *    Отдельная сессия/новое поле в БД не нужны — детерминированный seed заменяет персистентное
 *    состояние.
 * 3) _client/.../ryukzak.js — при открытии экрана зовёт ryukzak.preview и подменяет иконки
 *    (и уровень/прогресс-бар) на честный ответ сервера, как только он придёт; грубый локальный
 *    ориентир (mach:0,pist:0,ak:w) остаётся только как первый кадр до ответа сети.
 *
 * Run: node tests/ryukzak-honest-weapon-preview.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const php = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'ryukzak.php'), 'utf-8');
const ryuk = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');

console.log('\nTest 1: сервер — _rollWeapons() детерминирован (seed из uid+points), переиспользуется обоими методами');
{
    const start = php.indexOf('private function _rollWeapons(');
    const end   = php.indexOf('\n        }', start);
    const body  = php.slice(start, end);
    assert(start !== -1, '_rollWeapons найден');
    assert(/mt_srand\(crc32\(\$uid \. '_' \. \$points\)\);/.test(body), 'сеет mt_rand детерминированно из uid+points — та же пара даёт тот же бросок');
    assert(/mt_srand\(\);/.test(body), 'после розыгрыша возвращает mt_rand к случайному состоянию (не портит остальной RNG запроса)');
    assert(/return \[\$mach, \$pist, \$ak\];/.test(body), 'возвращает тройку mach/pist/ak');
}

console.log('\nTest 2: сервер — preview() считает тот же уровень/тир и зовёт общий _rollWeapons(), ничего не списывает/не начисляет');
{
    const start = php.indexOf('function preview(){');
    const end   = php.indexOf('\n        }', start);
    const body  = php.slice(start, end);
    assert(start !== -1, 'preview() найден');
    assert(/\$level\s*=\s*max\(1, \$this->_levelFromPoints\(\$points, \$catalog\['thresholds'\]\)\);/.test(body),
        'уровень считается той же формулой, что и в open() (max(1, _levelFromPoints))');
    assert(/this->_rollWeapons\(\$tier, \$uid, \$points\)/.test(body), 'оружие катается через общий _rollWeapons(), не отдельной копией формулы');
    assert(!/ops->deduct\(/.test(body), 'preview() НЕ списывает тушёнку');
    assert(!/ops->add\(/.test(body), 'preview() НЕ начисляет валюту');
    assert(!/saveUser\(/.test(body), 'preview() НЕ пишет в БД — чисто расчёт');
    assert(/'mach' => \$mach, 'pist' => \$pist, 'ak' => \$ak,/.test(body), 'ответ содержит честный mach/pist/ak');
}

console.log('\nTest 3: сервер — open() зовёт тот же _rollWeapons() вместо собственной inline-копии формулы');
{
    const start = php.indexOf('function open(){');
    const end   = php.indexOf('\n        }', start);
    const body  = php.slice(start, end);
    assert(/this->_rollWeapons\(\$tier, \$uid, \$points\)/.test(body), 'open() переиспользует _rollWeapons() (гарантия совпадения с preview())');
    assert(!/for\(\$i = 0; \$i < intval\(\$tier\['w'\]\); \$i\+\+\)\{\s*\$roll = mt_rand/.test(body),
        'старая inline-копия цикла розыгрыша в open() убрана целиком (не задвоена с _rollWeapons)');
}

console.log('\nTest 4: сервер — preview зарегистрирован в permits (иначе роутер отклонит запрос)');
{
    assert(/\$this->permits = \['open', 'preview'\];/.test(php), "permits содержит 'preview' рядом с 'open'");
}

console.log('\nTest 5: клиент — открытие экрана запрашивает честное превью и подменяет иконки/уровень по ответу');
{
    const start = ryuk.indexOf("TS.php('ryukzak.preview', {}, (res) => {");
    assert(start !== -1, "клиент зовёт TS.php('ryukzak.preview', ...)");
    const end = ryuk.indexOf('\n\t\t}', start);
    const body = ryuk.slice(start, end);
    assert(/_renderRewardIcons\(res\);/.test(body), 'иконки перерисовываются по честному ответу сервера (res.mach/pist/ak), не по локальной оценке');
    assert(/_setKeyPreview\(res\.k \|\| 0, res\.key_boss\);/.test(body), 'ключ босса тоже обновляется из честного превью');
    assert(/lvlTxt\.text = 'УРОВЕНЬ РЮКЗАКА : ' \+ res\.level;/.test(body), 'уровень в тексте берётся из ответа сервера');
    assert(/_renderProgress\(res\.level\);/.test(body), 'прогресс-бар тоже обновляется из честного превью');
}

console.log('\nTest 6: клиент — устаревший ответ (экран закрыт/переоткрыт за время запроса) не трогает чужие спрайты');
{
    assert(/if\(this\._ryukzakWin !== win\) return;/.test(ryuk),
        'колбэк preview проверяет this._ryukzakWin === win перед применением ответа (та же защита, что и у других асинхронных обновлений в проекте)');
}

console.log('\nTest 7: грубый локальный ориентир (ak:previewTier.w) остаётся как первый кадр, не убран целиком');
{
    assert(/mach: 0, pist: 0, ak: previewTier\.w,/.test(ryuk),
        'локальный мгновенный ориентир всё ещё рисуется первым кадром (пока летит сетевой запрос) — убирать его не просили, только подменять честным ответом');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
