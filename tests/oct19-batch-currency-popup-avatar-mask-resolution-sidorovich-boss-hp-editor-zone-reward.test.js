/**
 * Test: 19.10.2026, по прямому указанию — батч из 10 независимых правок за один присест:
 *
 * 1. Попап покупки валюты (interface-currency-purchase.js) — закрытие только по крестику
 *    (blocker больше не закрывает по клику), заголовок переведён на тот же шрифт, что
 *    count/price (Southbank LT/18/белый), позиции count/price текста (голоса/количество
 *    товара) пересчитаны, иконка вкладки "рубли" стала фиксированной 89×89 вместо scale 1.03.
 * 2. Круглая маска под аватаром в верхнем HUD (interface.js) убрана целиком — была СИЛЬНО
 *    меньше декоративного кольца "кольцо верхний худ.png" (26px радиус маски vs 110×108px
 *    файл кольца без масштаба).
 * 3. PIXI.settings.RESOLUTION (index.js) теперь синхронизируется с КАЖДЫМ resize() по реальному
 *    targetRes, а не только статической догадкой по devicePixelRatio при загрузке — чинит
 *    "буквы разного размера" на широких десктопных окнах для текста, созданного ПОСЛЕ старта.
 * 4. Sidorovich (sidorovich.js) — мёртвый отдельный хитбокс "ящика" (chestHit) удалён, клик
 *    открывающий ящик перенесён прямо на спрайт посылки (posylkaIdle), тот же паттерн, что у
 *    банки/консервов/сумки.
 * 5. Попап результата боя (boss_result.js) — HP босса на обеих страницах (победа/поражение)
 *    переставлен на координаты с редактора позиций, fontSize уменьшен на 2px (16→14).
 * 6. Редактор позиций (universal_pos_editor.js) — для PIXI.Text объектов PageUp/PageDown теперь
 *    меняет style.fontSize напрямую (не scale), а в инфо-панели показывается fontSize вместо
 *    бесполезного "scale: 1.000".
 * 7. Награда за ячейку зоны (zone.js._showCpReward) — "+40 XP" (текстовый суффикс) заменён на
 *    иконку "опыт эмблема.png", все 3 ряда (опыт/сухари/уважение) переставлены на новые
 *    координаты, заначка (_showStashPickup) встала 4-м рядом ниже уважения с тем же шагом (62px).
 *
 * Run: node tests/oct19-batch-currency-popup-avatar-mask-resolution-sidorovich-boss-hp-editor-zone-reward.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf-8');

console.log('\n=== 1. Попап покупки валюты ===');
{
    const src = read('_client', 'src', 'game', 'interface', 'interface-currency-purchase.js');
    assert(!/blocker\.on\('pointerdown'/.test(src), 'blocker больше не закрывает попап по клику');
    assert(/exitBtn\.on\('pointerdown', \(\) => this\._closeCurrencyPurchasePopup\(\)\);/.test(src),
        'exitBtn (крестик) по-прежнему закрывает попап — единственный способ');
    // 20.10.2026: TXT_STYLE_TITLE больше не отдельный литерал — строится из общего TXT_STYLE_BASE
    // (перенос стиля слоя из Photoshop, см. tests/currency-purchase-text-style-photoshop-
    // transfer.test.js) тем же Object.assign, что и COUNT/PRICE — тот же шрифт/базовый цвет.
    assert(/const TXT_STYLE_TITLE = Object\.assign\(\{\}, TXT_STYLE_BASE\);/.test(src),
        'заголовок использует тот же общий стиль, что count/price (Southbank LT/18/градиент от белого)');
    assert(/countTxt\.y = slot\.y \+ 25;/.test(src), 'countTxt (количество товара) — новая позиция slot.y+25 (было +56, подняли на 31px)');
    assert(/priceTxt\.y = slot\.y \+ 170;/.test(src), 'priceTxt (цена в голосах) — новая позиция slot.y+170 (было +137, опустили на 33px)');
    assert(/fixedW: 89, fixedH: 89,/.test(src), 'вкладка "рубли" получила fixedW/fixedH 89×89');
    assert(/if\(t\.fixedW && t\.fixedH\)\{ spr\.width = t\.fixedW; spr\.height = t\.fixedH; \}/.test(src),
        'иконка вкладки использует fixedW/fixedH вместо scale, когда они заданы');
}

console.log('\n=== 2. Маска аватара в верхнем HUD ===');
{
    const src = read('_client', 'src', 'game', 'interface.js');
    // Проверяем отсутствие самого КОДА маски (new PIXI.Graphics под неё, drawCircle, bm.mask) —
    // не голого слова "avaMask", которое легитимно осталось в одном объясняющем комментарии.
    assert(!/const avaMask = new PIXI\.Graphics/.test(src), 'PIXI.Graphics для маски больше не создаётся');
    assert(!/avaMask\.drawCircle/.test(src), 'drawCircle для маски убран');
    assert(!/bm\.mask = avaMask/.test(src), 'bm.mask больше не выставляется');
    assert(/this\.up\.ava\.icon_mc\.addChild\(bm\);/.test(src), 'фото аватара по-прежнему добавляется в дерево (просто без маски)');
    assert(/this\._avatarRing = ring;/.test(src), 'декоративное кольцо (ring) не тронуто — остаётся как было');
}

console.log('\n=== 3. Синхронизация PIXI.settings.RESOLUTION с resize() ===');
{
    const src = read('_client', 'src', 'index.js');
    const resizeIdx = src.indexOf('if(window.scene && scene.renderer){');
    const resizeEnd = src.indexOf('\n\t}', resizeIdx);
    const block = src.slice(resizeIdx, resizeEnd);
    assert(/PIXI\.settings\.RESOLUTION = Math\.min\(4, Math\.max\(2, targetRes \+ 0\.5\)\);/.test(block),
        'PIXI.settings.RESOLUTION пересчитывается внутри resize() по targetRes (не только статически при загрузке)');
    assert(/Math\.min\(3, Math\.max\(2, window\.devicePixelRatio \|\| 1\)\)/.test(src),
        'статическая строка на старте оставлена как подстраховка ДО первого resize()');
}

console.log('\n=== 4. Хитбокс ящика у Сидоровича ===');
{
    const src = read('_client', 'src', 'game', 'shell', 'overlays', 'sidorovich.js');
    // Проверяем отсутствие самого КОДА хитбокса (new PIXI.Graphics под него, drawRect) — не
    // голого слова "chestHit", которое легитимно осталось в объясняющих комментариях.
    assert(!/const chestHit = new PIXI\.Graphics/.test(src), 'PIXI.Graphics для chestHit больше не создаётся');
    assert(!/chestHit\.drawRect/.test(src), 'drawRect для chestHit убран');
    assert(!/win\.addChild\(chestHit\)/.test(src), 'chestHit больше не добавляется в дерево');
    assert(/posylkaIdle\.interactive = true; posylkaIdle\.buttonMode = true;/.test(src),
        'posylkaIdle (сундук) стал interactive напрямую');
    assert(/posylkaIdle\.on\('pointerdown', \(\)=>\{ this\._openYashikScreen\(\); \}\);/.test(src),
        'клик по сундуку открывает экран ящика');
    assert(/posylkaIdle\.on\('pointerover', \(\)=>\{ posylkaActiv\.visible = true; \}\);/.test(src),
        'hover по-прежнему показывает posylkaActiv — поведение не сломано, только добавлен клик');
}

console.log('\n=== 5. HP босса на странице результата боя ===');
{
    const src = read('_client', 'src', 'game', 'shell', 'popups', 'boss_result.js');
    const matches = src.match(/fontSize: 14, fill: '#ffffff', fontWeight: 'bold',\s*\n\s*dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,/g) || [];
    assert(matches.length === 2, 'оба текста HP (победа и поражение) используют fontSize 14 (было 16) — найдено: ' + matches.length);
    assert((src.match(/hpTxt\.x = 494; hpTxt\.y = 419;/g) || []).length === 1, 'hpTxt (поражение) — координаты x:494,y:419 (20.10.2026, было 422)');
    assert((src.match(/hpBarTxt\.x = 494; hpBarTxt\.y = 419;/g) || []).length === 1, 'hpBarTxt (победа) — те же координаты x:494,y:419 (20.10.2026, было 422)');
}

console.log('\n=== 6. Редактор позиций — font-size для текста ===');
{
    const src = read('_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js');
    assert(/if\(obj instanceof PIXI\.Text\)\{\s*\n\s*const curSize = parseFloat\(obj\.style\.fontSize\) \|\| 16;/.test(src),
        '_uScaleStep различает PIXI.Text и меняет style.fontSize напрямую');
    assert(/obj\.style\.fontSize = nextSize;/.test(src), 'новое значение fontSize применяется к style');
    assert(/const isTextObj = s instanceof PIXI\.Text;/.test(src), '_uUpdateReadout определяет текстовый объект');
    assert(/'  fontSize: ' \+ \(parseFloat\(s\.style\.fontSize\) \|\| 16\)/.test(src),
        'инфо-панель показывает fontSize для текстовых объектов вместо scale');
}

console.log('\n=== 7. Награда за ячейку зоны (опыт/сухари/уважение/заначка) ===');
{
    const src = read('_client', 'src', 'game', 'zone.js');
    assert(!/'\+' \+ xp \+ ' XP'/.test(src), 'текстовый суффикс " XP" убран');
    assert(/const xpTxt = new PIXI\.Text\('\+' \+ xp, REWARD_STYLE\);/.test(src), 'xpTxt теперь просто число без суффикса');
    assert(/const xpIcon = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/опыт эмблема\.png'\)\);/.test(src),
        'добавлена иконка "опыт эмблема.png" рядом с числом опыта');
    assert(/const xpY\s*=\s*-55;/.test(src), 'xpY = -55 (опыт сверху)');
    assert(/const cigY\s*=\s*7;/.test(src), 'cigY = 7 (сухари)');
    assert(/const REWARD_ROW_STEP = 62;/.test(src), 'шаг между рядами пересчитан на 62px (был 38)');
    assert(/const respY = cigY \+ REWARD_ROW_STEP;/.test(src), 'respY вычисляется как cigY + шаг (= 69)');

    const stashIdx = src.indexOf('_showStashPickup(){');
    const stashBlock = src.slice(stashIdx, stashIdx + 1500);
    assert(/const STASH_ROW_Y = 7 \+ 62 \+ 62;/.test(stashBlock), 'заначка встаёт 4-м рядом (respY + ещё один шаг = 131)');
    assert(/bagIcon\.x = ROW_ICON_X; bagIcon\.y = STASH_ROW_Y;/.test(stashBlock), 'иконка заначки использует общий X-паттерн и новый Y');
}

console.log('\n=== 8. Preload: опыт эмблема.png добавлена в список ранней загрузки ===');
{
    const src = read('_client', 'src', 'game', 'game-boot.js');
    assert(/'монеты эмблема\.png','уважение эмблема\.png','опыт эмблема\.png',/.test(src),
        'опыт эмблема.png добавлена рядом с уважение/монеты эмблема в _allGamePngs');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
