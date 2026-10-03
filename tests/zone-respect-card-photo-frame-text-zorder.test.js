/**
 * Test: 25.09.2026, по прямому указанию (скриншот карточки лидера по уважению в Зоне,
 * "нужно, чтобы самый нижний файл — изображение персонажа, выше — рамка, выше рамки, на самом
 * верху — количество уважения") —
 *
 * Прошлый фикс (24.09.2026, комментарий в коде) поднял ОБА элемента — и photoSpr, и amountTxt —
 * НАД рамкой (respectFrame), решая баг "число уважения пряталось ЗА рамкой". Побочный эффект: это
 * заодно подняло и ФОТО над рамкой, хотя рамка задумана как декоративное обрамление ПОВЕРХ фото
 * (типичный паттерн "фото в рамке"), а не под ним. Правильный порядок снизу вверх:
 * photoSpr → respectFrame → amountTxt.
 *
 * Фикс: respectFrame повторно добавляется в группу (g.group.addChild(frameSpr)) СРАЗУ после
 * photoSpr и ДО amountTxt — addChild() на уже присутствующий дочерний элемент переносит его в
 * конец списка (= наверх z-порядка в PIXI), тот же приём, что уже использовался для photoSpr/
 * amountTxt в предыдущем фиксе.
 *
 * Run: node tests/zone-respect-card-photo-frame-text-zorder.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8'
);

console.log('\nTest 1: порядок addChild в _refreshZoneRespectLeaders — photoSpr → frameSpr(повторно) → amountTxt');
{
    const start = src.indexOf('const _renderRespectLeaders = (users) => {');
    assert(start !== -1, '_renderRespectLeaders найден');
    const end = src.indexOf('\n\t\t\t};', start);
    const body = src.slice(start, end);

    const photoAddIdx  = body.indexOf('g.group.addChild(photoSpr);');
    const frameReAddIdx = body.indexOf('g.group.addChild(frameSpr);');
    const amountAddIdx = body.indexOf('g.group.addChild(amountTxt);');

    assert(photoAddIdx !== -1, 'photoSpr добавляется в группу');
    assert(frameReAddIdx !== -1, 'frameSpr ПОВТОРНО добавляется в группу (переносит его наверх z-порядка)');
    assert(amountAddIdx !== -1, 'amountTxt добавляется в группу');

    assert(photoAddIdx < frameReAddIdx, 'фото добавлено РАНЬШЕ повторного добавления рамки (значит рамка теперь поверх фото)');
    assert(frameReAddIdx < amountAddIdx, 'повторное добавление рамки — РАНЬШЕ добавления текста (текст остаётся самым верхним)');
}

console.log('\nTest 2: frameSpr — та же ссылка, что и исходная рамка локации (respectFrameSprites[l.loc]), не новый объект');
{
    assert(/const frameSpr = respectFrameSprites\[l\.loc\];/.test(src),
        'frameSpr берётся из уже существующего массива respectFrameSprites — не создаётся заново');
}

console.log('\nTest 3: изначальное построение рамки (при создании карточек локаций) не изменилось — только порядок в рефреше');
{
    assert(/group\.addChild\(respectFrame\);/.test(src), 'изначальное group.addChild(respectFrame) в цикле построения карточек осталось (регресс-гвард)');
    assert(/respectFrameSprites\[loc\.locIdx\] = respectFrame;/.test(src), 'ссылка на рамку по-прежнему сохраняется по locIdx');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
