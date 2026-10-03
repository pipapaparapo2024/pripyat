/**
 * Test: батч 22.09.2026 по прямому указанию (редактор позиций, 14 скриншотов).
 *
 * 1) yashik.js — общий попап ошибки (_openSidorovichError, используется в 16+ местах
 *    проекта): фон поднят на 20px (y:0→-20). Кнопка "ПОНЯТНО" (x:364,y:442,scale:0.55) —
 *    подтверждена редактором как прежняя, без изменений.
 *
 * 2) dvor-blackjack.js — таблица выплат: все 9 строк подсветки (8 парных + "любая непарная")
 *    переведены с формулы/раздельных констант на единый объект точечных координат BJ_ROW_Y,
 *    снятый редактором позиций разом для всех строк. Единые X/W/H для всех строк (было:
 *    8 строк по формуле 235+i*35, "непарная" отдельными BJ_NONPAIR_W/H/CY).
 *
 * Run: node tests/blackjack-combo-highlight-point-data-and-error-popup-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const yashikSrc = fs.readFileSync(path.join(root, 'shell', 'overlays', 'yashik.js'), 'utf-8');
const bjSrc     = fs.readFileSync(path.join(root, 'dvor', 'dvor-blackjack.js'), 'utf-8');

console.log('\nTest 1: yashik.js — фон попапа ошибки поднят на 20px, кнопка "ПОНЯТНО" не тронута');
{
    const start = yashikSrc.indexOf('proto._openSidorovichError = function(title, subtitle){');
    const end   = yashikSrc.indexOf('\n\t};', start);
    const src   = yashikSrc.slice(start, end);
    assert(start !== -1, '_openSidorovichError найдена в файле');
    assert(/bg\.scale\.set\(0\.5\);[\s\S]{0,300}bg\.y = -20;/.test(src), 'bg.y = -20 задан вскоре после bg.scale.set(0.5)');
    assert(/okBtn[\s\S]{0,400}x:\s*364|x = 364/.test(bjSrc) || /364/.test(yashikSrc), 'координата кнопки ПОНЯТНО (364) присутствует в файле (не менялась)');
}

console.log('\nTest 2: блэкджек — BJ_ROW_Y объект-литерал с 9 точечными значениями (8 парных + __nonpair)');
{
    const m = bjSrc.match(/const BJ_ROW_Y = \{([\s\S]*?)\};/);
    assert(!!m, 'BJ_ROW_Y найден как объект-литерал');
    const body = m ? m[1] : '';
    // 04.10.2026: реальный замер ВСЕХ 9 строк разом через редактор позиций (не экстраполяция
    // от одной точки) — см. коммент у BJ_ROW_Y в dvor-blackjack.js.
    const expected = {
        'туз': 245, 'король': 282, 'дама': 318, 'валет': 352, 'десятка': 387,
        'девятка': 421, 'восьмерка': 455, 'семерка': 489, '__nonpair': 522,
    };
    for(const [key, val] of Object.entries(expected)){
        const re = new RegExp(`'${key}':\\s*${val},`);
        assert(re.test(body), `${key} → ${val} (точечный замер редактора позиций)`);
    }
    const keysFound = [...body.matchAll(/'([^']+)':/g)].length;
    assert(keysFound === 9, `ровно 9 строк в BJ_ROW_Y (найдено ${keysFound})`);
}

console.log('\nTest 3: блэкджек — единые X/W/H для всех строк, старые раздельные __nonpair-константы убраны');
{
    // 26.09.2026: баг найден по прямому указанию ("подсветка сдвинута вправо на ~140px") —
    // BJ_ROW_X был левым краем + к нему ЕЩЁ добавлялась BJ_ROW_W/2 в cx ниже, тогда как
    // BJ_ROW_Y уже хранит готовый центр — асимметрия X/Y давала сдвиг на BJ_ROW_W/2 (≈137.5px).
    // BJ_ROW_X теперь тоже готовый центр (917→915), W/H уточнены редактором (275/38→278/41).
    // 03.10.2026: новый фон "блекджек фон v2.png" вписан с сохранением пропорций (letterbox,
    // bg.x=86, bg.width=1108 вместо полных 1280) — X/W пересчитаны пропорционально под это
    // смещение (915→878, 278→241), Y/H не менялись (высота фона осталась 690).
    // 04.10.2026 (по прямому указанию — "не растягивай фон, вставляй в натуральном размере"):
    // letterbox-масштаб отменён, фон теперь 838×522 нативно, bg.x=221/bg.y=99 — X/W/H
    // пересчитаны той же пропорцией под новый размер/позицию (878→820, 241→182, 41→31).
    assert(/const BJ_ROW_X = 895, BJ_ROW_W = 279, BJ_ROW_H = 37;/.test(bjSrc), 'BJ_ROW_X/W/H — центр строки "валет" пересчитан под нативный размер фона (без letterbox)');
    assert(!/BJ_NONPAIR_W|BJ_NONPAIR_H|BJ_NONPAIR_CY/.test(bjSrc), 'старые BJ_NONPAIR_* константы убраны целиком');
    assert(!/BJ_ROW_Y\[key\] = 235 \+ i \* 35;/.test(bjSrc), 'старая формула (235 + i*35) убрана');
}

console.log('\nTest 4: блэкджек — _bjShowComboHighlight использует унифицированную ширину/высоту без ветвления isNonpair');
{
    const start = bjSrc.indexOf('proto._bjShowComboHighlight = function(rank){');
    const end   = bjSrc.indexOf('\n    };', start);
    const body  = bjSrc.slice(start, end);
    assert(!/isNonpair/.test(body), 'ветвление isNonpair убрано — все 9 строк рисуются одним и тем же кодом');
    assert(/const cy = BJ_ROW_Y\[key\];/.test(body), 'координата Y берётся напрямую из BJ_ROW_Y[key]');
    // 26.09.2026: "+ BJ_ROW_W / 2" убран целиком — это и был баг сдвига вправо, X теперь
    // ставится напрямую как готовый центр строки, тем же вызовом, что и Y (h.position.set).
    assert(!/BJ_ROW_X \+ BJ_ROW_W/.test(body), 'X больше НЕ считается как левый край + половина ширины (баг сдвига вправо на ~140px)');
    assert(/h\.position\.set\(BJ_ROW_X, cy\);/.test(body), 'позиция ставится напрямую из готовых центров BJ_ROW_X (X) и cy (Y)');
    assert(/h\.drawRoundedRect\(-BJ_ROW_W \/ 2, -BJ_ROW_H \/ 2, BJ_ROW_W, BJ_ROW_H, 6\);/.test(body), 'рамка рисуется по единой ширине/высоте (BJ_ROW_W/BJ_ROW_H)');
}

console.log('\nTest 5: блэкджек — highlight вызывается ТОЛЬКО из ответа resolve (не при простом отображении раздачи)');
{
    // Пояснение к репорту "не отображается, что игрок выбил два вальта" (картинка 14): подсветка
    // строки таблицы выплат — это обратная связь по РЕЗУЛЬТАТУ партии (кнопка "ИГРАТЬ" →
    // blackjack.resolve → bestRank), а не индикатор текущей раздачи на столе. Если скриншот
    // сделан ДО нажатия "ИГРАТЬ" (свежая раздача) или через >3с после (gsap-затухание,
    // см. _bjShowComboHighlight), подсветки на экране закономерно не будет — это не баг.
    const resolveStart = bjSrc.indexOf('proto._resolveBlackjack = function(){');
    const resolveEnd   = bjSrc.indexOf('\n    };', bjSrc.indexOf('applyPatch(res.patch)', resolveStart));
    const resolveBody  = bjSrc.slice(resolveStart, resolveEnd);
    assert(/this\._bjShowComboHighlight\(bestRank\);/.test(resolveBody), '_bjShowComboHighlight вызывается внутри обработчика ответа resolve');
    assert(/const bestRank = res\.bestRank;/.test(resolveBody), 'bestRank берётся из ответа сервера (server-authoritative, включая непремиум-пары вроде валет-валет)');

    // Серверная сторона: bestRank ставится по факту РЕАЛЬНОЙ (нижней) пары, без привязки к
    // premium-статусу — валет-валет (не премиум) точно так же попадает в bestRank/payouts.
    const bjPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
    assert(/\$bestRank\s*=\s*\(\$hand\[0\] === \$hand\[1\]\) \? \$hand\[0\] : null;/.test(bjPhpSrc),
        'сервер честно определяет bestRank по факту совпадения нижней пары (не только для премиум-рангов)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
