/**
 * Test: батч 20.10.2026 (четвёртая часть дня, по прямому указанию) —
 *
 *  1) dvor-dice-screen.js: DICE_ROW откачен к последним рабочим координатам 04.10.2026 — см.
 *     dice-combo-highlight-explicit-position-array.test.js / highlight-row-spacing-and-roulette-
 *     rotate.test.js для полной проверки. Корень: _diceComboHighlight — один общий Graphics,
 *     h.position всегда (0,0), снимок через редактор позиций на нём физически не мог быть
 *     замером отдельной строки.
 *
 *  2) Репорт "забрал шмотку с кейса рулетки, а в попапе написано ЭЛЕМЕНТ ТАТУ" — подтверждено:
 *     тату-дроп (и в покере, и в рулетке) НЕ ДОСТУПЕН в реальной игре ($tatuChancePct=0 в обоих
 *     controllers, плюс источник 'roulette' в shmot_items.json пока пуст) — увиденное было
 *     dev-кнопкой "Кейс рулетки (шмотка выпала)", которая СИНТЕТИЧЕСКИ симулирует hasTatu=true
 *     именно для превью этого экрана. Улучшение на будущее: тип награды 'tatu'→'shmot' (верная
 *     карточка "попап награда шмотка.png"), плюс сервер теперь отдаёт shmotItemId в ответе
 *     (раньше только в $debug) — popups/reward.js показывает имя предмета по наведению.
 *
 *  3) interface-currency-purchase.js: countTxt теперь включает название валюты (напр. "1600
 *     сухарей", не просто "1600") — "руб" для рублей (неизменяемо), словоформы для
 *     тушёнки/сухарей (helper.numberEnd). titleTxt (название ресурса) сдвинут влево на 65px.
 *
 *  4) player_profile.js: подтверждено — круглое окно фото на визитке обрезано КОДОМ
 *     (PIXI.Graphics-маска avatarMask, не часть PNG) — помечено _uDraggable, теперь ловится
 *     универсальным редактором позиций (драг двигает, PageUp/PageDown меняет размер).
 *
 * Run: node tests/oct20-batch4-dice-revert-currency-units-shmot-reward-hover-avatar-editable.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const pokerPhp     = readSrc('server/core/controllers/poker.php');
const roulettePhp  = readSrc('server/core/controllers/roulette.php');
const roulBuySrc   = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');
const pokerBagSrc  = readSrc('_client/src/game/dvor/dvor-poker-bag.js');
const rewardSrc    = readSrc('_client/src/game/shell/popups/reward.js');
const profileSrc   = readSrc('_client/src/game/shell/overlays/player_profile.js');
const purchaseSrc  = readSrc('_client/src/game/interface/interface-currency-purchase.js');

console.log('\nTest 1: сервер отдаёт shmotItemId в основном ответе (не только в $debug)');
{
    assert(/'shmotItemId' => \$tatuItemId, 'clientRewards'/.test(roulettePhp), 'roulette.php.openCase() отдаёт shmotItemId клиенту');
    assert(/'shmotItemId' => \$tatuItemId, 'clientRewards'/.test(pokerPhp), 'poker.php.openBag() отдаёт shmotItemId клиенту');
}

console.log('\nTest 2: клиент передаёт shmotItemId дальше и шлёт reward type:"shmot" (не "tatu") с именем предмета');
{
    assert(/this\._openRouletteCaseOpenedScreen\(!!res\.hasTatu, res\.reward, res\.clientRewards \|\| \[\], res\.shmotItemId\);/.test(roulBuySrc),
        'dvor-roulette-buy.js прокидывает res.shmotItemId');
    // 24.10.2026: добавлен 4-й параметр shmotItem (полный предмет каталога) — нужен
    // buildShmotTooltipCard() для богатой карточки (имя/бонус/сет/требования), см.
    // tests/oct24-raznaryadka-buyout-popup-and-tooltip.test.js.
    assert(/rewards\.push\(\{type:'shmot', amount:1, name: shmotItem \? shmotItem\.name : 'Элемент шмотки', shmotItem\}\);/.test(roulBuySrc),
        'dvor-roulette-buy.js отправляет в попап награды type:"shmot" с именем и полным предметом (не "tatu")');
    assert(/this\._openPokerBagOpenedScreen\(res\.reward, res\.clientRewards \|\| \[\], !!res\.hasTatu, res\.shmotItemId\);/.test(pokerBagSrc),
        'dvor-poker-bag.js прокидывает res.shmotItemId');
    // 20.10.2026 (по прямому указанию, тот же день — "после ЗАБРАТЬ не вылезал попап награды"):
    // попап сумки покера убран целиком (см. tests/reward-popup-suppressed-yashik-ryukzak.test.js
    // Test 5) — shmotItemId теперь используется только для инлайн-отображения тату-текста на
    // самом экране сумки, не для rewards.push в попап, который больше не вызывается.
}

console.log('\nTest 3: popups/reward.js — наведение на карточку с item.name показывает тултип с названием');
{
    assert(/if\(item\.name\)\{/.test(rewardSrc), 'карточка проверяет наличие item.name перед включением hover');
    assert(/icon\.on\('pointerover', \(\) => _showNameTip\(/.test(rewardSrc), 'hover показывает тултип');
    assert(/icon\.on\('pointerout',\s*\(\) => \{ nameTip\.visible = false; \}\);/.test(rewardSrc), 'уход курсора прячет тултип');
}

console.log('\nTest 4: interface-currency-purchase.js — countTxt включает название валюты, titleTxt сдвинут');
{
    assert(/unitWord: \(n\) => 'руб',/.test(purchaseSrc), 'вкладка "рубли" — короткая неизменяемая подпись "руб"');
    // 28.10.2026 (по прямому указанию — "в магазине покупки пиши не 1000 а 1К"): count теперь
    // сокращается через formatAchNum(count, true) ("1.6К"), unitWord(count) по-прежнему
    // склоняется от РЕАЛЬНОГО числа.
    assert(/const countTxt = new PIXI\.Text\(formatAchNum\(count, true\) \+ ' ' \+ def\.unitWord\(count\), TXT_STYLE_COUNT\);/.test(purchaseSrc),
        'countTxt сокращает число через formatAchNum(count, true), unitWord включает склонение (напр. "1.6К сухарей")');
    assert(/wordWrap: true, wordWrapWidth: 130/.test(purchaseSrc), 'TXT_STYLE_COUNT переносит длинную подпись по ширине карты');
    assert(/titleTxt\.x = 652; titleTxt\.y = 122;/.test(purchaseSrc), 'titleTxt сдвинут влево: x 717→652');
}

console.log('\nTest 5: player_profile.js — круглое окно фото на визитке редактируемо через редактор позиций');
{
    const start = profileSrc.indexOf('const avatarMask = new PIXI.Graphics();');
    const end   = profileSrc.indexOf('const avatarSpr', start);
    const body  = profileSrc.slice(start, end);
    assert(/avatarMask\._uDraggable = true;/.test(body), 'avatarMask помечен _uDraggable — подхватывается универсальным редактором позиций');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
