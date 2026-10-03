/**
 * Test: 25.09.2026, по прямому указанию —
 *
 * 1) "Не получилось сделать так, чтобы неполученные шмотки стали серыми". Расследование:
 *    десатурация (ColorMatrixFilter.desaturate()) в shmot_shop.js была реализована ПРАВИЛЬНО
 *    ещё 25.09.2026 ранее в этой сессии — код структурно корректен (if(!item.owned){...}).
 *    Найден реальный структурный пробел ТОГО ЖЕ класса, что уже дважды чинили для skills/bosses
 *    24.09.2026 (см. комментарий в preloader.js): window.shmot создаётся в module_control.js ДО
 *    того, как window.udata становится реальным (TS.php('users.get',...) ещё не ответил) — его
 *    конструкторский _loadFromUdata() тогда молча ничего не находит, и предметы остаются на
 *    owned:false из каталога, ПОКА не случится один из узких патч-колбэков казино/боссов. Фикс —
 *    та же явная пересинхронизация, что уже стоит для skills/bosses в preloader.js.
 *
 *    ВАЖНО (сообщено пользователю отдельно, не код-фикс): если тестовый аккаунт хотя бы раз
 *    нажимал dev-кнопку "ОТКРЫТЬ ВСЁ" (proto._unlockAllShmot(), dev_panel.js) — она НАВСЕГДА
 *    помечает owned=true у ВСЕХ предметов и сохраняет это в БД. На таком аккаунте магазин будет
 *    честно показывать всё цветным, и это НЕ баг серости — нужно проверять на сброшенном
 *    аккаунте.
 *
 * 2) Тултип-карточка описания шмотки (_showShopTip) переставлена с "над предметом" на "справа
 *    от предмета" — якорь сменился с верхнего края ячейки (центр по X) на правый край ячейки
 *    (центр по Y).
 *
 * Run: node tests/shmot-shop-grayout-preloader-resync-and-tooltip-right.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const preloaderSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'preloader.js'), 'utf-8');
const shopSrc       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');

console.log('\nTest 1: preloader.js — shmot._loadFromUdata() пересинхронизируется, как уже сделано для skills/bosses');
{
    const anchorIdx = preloaderSrc.indexOf("if(window.skills && typeof skills._loadFromUdata === 'function') skills._loadFromUdata();");
    assert(anchorIdx !== -1, 'существующая пересинхронизация skills найдена (якорь для регресс-гварда)');
    const chunk = preloaderSrc.slice(anchorIdx, anchorIdx + 1200);
    assert(/if\(window\.bosses && typeof bosses\._loadFromUdata === 'function'\) bosses\._loadFromUdata\(\);/.test(chunk),
        'существующая пересинхронизация bosses осталась (регресс-гвард)');
    assert(/if\(window\.shmot && typeof shmot\._loadFromUdata === 'function'\) shmot\._loadFromUdata\(\);/.test(chunk),
        'новая пересинхронизация shmot добавлена той же строкой сразу после skills/bosses');
}

console.log('\nTest 2: shmot_shop.js — десатурация неполученных предметов не тронута (регресс-гвард на существующий код)');
{
    const start = shopSrc.indexOf('if(!item.owned){');
    assert(start !== -1, 'условие if(!item.owned) на месте');
    const chunk = shopSrc.slice(start, start + 200);
    assert(/const gsFilter = new PIXI\.filters\.ColorMatrixFilter\(\);/.test(chunk), 'ColorMatrixFilter создаётся');
    assert(/gsFilter\.desaturate\(\);/.test(chunk), 'обесцвечивание применяется');
    assert(/img\.filters = \[gsFilter\];/.test(chunk), 'фильтр назначается спрайту предмета');
}

console.log('\nTest 3: shmot.js — dev-кнопка "ОТКРЫТЬ ВСЁ" перманентно помечает owned=true (контекст для пользователя, регресс-гвард)');
{
    const devSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
    const start = devSrc.indexOf('proto._unlockAllShmot = function(){');
    assert(start !== -1, '_unlockAllShmot существует');
    const chunk = devSrc.slice(start, start + 900);
    assert(/shmot\.items\.forEach\(it => \{ it\.owned = true; \}\);/.test(chunk), 'помечает ВСЕ предметы owned=true');
    // 25.09.2026 (shmot server-authoritative — 'shmot' убран из client-writable whitelist):
    // сохранение переведено с shmot._saveToUdata() (generic users.save(), уже не пишет) на
    // users.devGrantShmot (прямой SQL update в обход whitelist, как devGrantWeapons).
    assert(/TS\.php\('users\.devGrantShmot', \{shmot_json: shmotJson\}/.test(chunk),
        'сохраняет это в БД через users.devGrantShmot — эффект перманентный, не сбрасывается сам');
}

console.log('\nTest 4: _showShopTip — тултип теперь справа от предмета (был сверху)');
{
    const start = shopSrc.indexOf('proto._showShopTip = function(frame, item){');
    const end   = shopSrc.indexOf('\n    };', start);
    const body  = shopSrc.slice(start, end);

    assert(/const \{ cellW, cellH \} = this\._shopGrid;/.test(body), 'берёт и cellW, и cellH (нужны для правого/центр-по-Y якоря)');
    assert(/frame\.x \+ cellW, frame\.y \+ cellH \/ 2/.test(body), 'якорь — правый край ячейки, по вертикали центр (было: центр по X, верхний край)');
    assert(/card\.x = local\.x \+ MARGIN;/.test(body), 'card.x смещается ВПРАВО от якоря (было: card.x = local.x - totalW/2 — центрирование по X)');
    assert(/card\.y = local\.y - totalH \/ 2;/.test(body), 'card.y центрируется по вертикали относительно предмета (было: local.y - 8 - totalH — прижато к верху)');

    assert(!/card\.x = local\.x - totalW \/ 2;/.test(body), 'старая формула центрирования по X (над предметом) не осталась');
    assert(!/card\.y = local\.y - 8 - totalH;/.test(body), 'старая формула прижатия к верху не осталась');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
