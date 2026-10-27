/**
 * Test: 24.10.2026 (по прямому указанию, 2 скриншота — "в попапе награды, если выпадает
 * шмотка, при наведении должно выводиться окно, как во вкладке шмоток, вообще в любом месте,
 * где выпадает шмотка"):
 *
 * popups/reward.js УЖЕ умел показывать богатую карточку (buildShmotTooltipCard — бонус/сет/
 * требования, тот же вид, что в магазине шмоток) по наведению, если переданному айтему задан
 * `item.shmotItem` (полная запись каталога). Но popups/reward.js._showNameTip() вешает
 * pointerover/pointerout ТОЛЬКО если задан `item.name` вообще — три реальных места выдачи
 * шмотки пушили голый `{type:'shmot', amount:1}` БЕЗ name/shmotItem, хотя полный предмет был
 * либо уже доступен в области видимости, либо резолвился по id из ответа сервера:
 *
 * 1) dvor-blackjack.js — res.shmotGranted (id от blackjack.php.resolve()) не резолвился вообще.
 * 2) yashik.js — локальная переменная `shmotItem` (строка 385, уже резолвленный полный предмет)
 *    была доступна, но не прокидывалась в пуш `{type:'shmot', amount:1}`.
 * 3) modules/reward-link.js — s.itemId (от rewardlinks.php.claim(), summary[].kind==='shmot')
 *    не резолвился вообще.
 * Итог ДО фикса: наведение на карточку шмотки в этих трёх местах не показывало НИЧЕГО (не
 * только не богатую карточку — вообще никакого тултипа, т.к. item.name тоже был пуст).
 *
 * dvor-roulette-buy.js уже делал это правильно (образец, с которого скопирован приём во всех
 * трёх местах — `shmot.items.find(it => it.id === ...)`).
 *
 * Run: node tests/oct24-shmot-reward-tooltip-everywhere.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = (p) => fs.readFileSync(p, 'utf-8');

console.log('\nTest 1: dvor-blackjack.js — res.shmotGranted резолвится в полный предмет, передаётся name+shmotItem');
{
    const src = norm(path.join(root, '_client/src/game/dvor/dvor-blackjack.js'));
    const start = src.indexOf("if(res.shmot && window.iface");
    const body = src.slice(start, src.indexOf('iface._showRewardPopup(items);', start) + 40);
    assert(/const shmotItem = \(res\.shmotGranted !== null && res\.shmotGranted !== undefined && window\.shmot\)\s*\n\s*\? shmot\.items\.find\(it => it\.id === res\.shmotGranted\) : null;/.test(body),
        'резолвит shmotItem из res.shmotGranted через клиентский каталог shmot.items');
    assert(/items\.push\(\{type:'shmot', amount: 1, name: shmotItem \? shmotItem\.name : 'Элемент шмотки', shmotItem\}\);/.test(body),
        'передаёт и name (с фоллбэком), и сам shmotItem в reward-попап');
}

console.log("\nTest 2: yashik.js — уже резолвленный shmotItem (строка 385) теперь прокидывается в попап награды");
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/yashik.js'));
    assert(/const shmotItem = \(reward\.shmotId !== null && reward\.shmotId !== undefined && window\.shmot\)/.test(src),
        'shmotItem резолвится из reward.shmotId (уже существующий код, не трогали)');
    assert(/if\(shmotItem\) _items\.push\(\{type:'shmot', amount:1, name: shmotItem\.name, shmotItem\}\);/.test(src),
        '_items.push() теперь передаёт name+shmotItem, не голый {type,amount}');
}

console.log("\nTest 3: modules/reward-link.js — s.itemId (rewardlinks.claim summary) резолвится в полный предмет");
{
    const src = norm(path.join(root, '_client/src/modules/reward-link.js'));
    const start = src.indexOf("if(s.kind === 'shmot'){");
    const end = src.indexOf("if(s.kind === 'key')", start);
    const body = src.slice(start, end);
    assert(/const shmotItem = \(s\.itemId !== null && s\.itemId !== undefined && window\.shmot\)\s*\n\s*\? shmot\.items\.find\(it => it\.id === s\.itemId\) : null;/.test(body),
        'резолвит shmotItem из s.itemId через клиентский каталог shmot.items');
    assert(/return \{ type: 'shmot', amount: 1, name: shmotItem \? shmotItem\.name : 'Элемент шмотки', shmotItem \};/.test(body),
        'возвращает объект с name (фоллбэком) и shmotItem');
}

console.log('\nTest 4: dvor-roulette-buy.js (образец) — не регрессировал, по-прежнему передаёт shmotItem');
{
    const src = norm(path.join(root, '_client/src/game/dvor/dvor-roulette-buy.js'));
    assert(/rewards\.push\(\{type:'shmot', amount:1, name: shmotItem \? shmotItem\.name : 'Элемент шмотки', shmotItem\}\);/.test(src),
        'эталонный call site не тронут');
}

console.log('\nTest 5: popups/reward.js — pointerover/pointerout по-прежнему вешается только при item.name (контракт, на который опираются все 4 места выше)');
{
    const src = norm(path.join(root, '_client/src/game/shell/popups/reward.js'));
    assert(/if\(item\.name\)\{\s*\n\s*icon\.interactive = true; icon\.buttonMode = true;/.test(src),
        'hover-тултип вешается именно по наличию item.name — подтверждает, зачем фоллбэк "Элемент шмотки" обязателен');
    assert(/buildShmotTooltipCard\(shmotItem\)/.test(src), 'при наличии shmotItem строится богатая карточка (buildShmotTooltipCard)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
