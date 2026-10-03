/**
 * Test: 26.09.2026, по прямому указанию — "при наведении на шмотку в карусели (экран выбора
 * режима босса) показывай то же описание, что и на вкладке шмотки" + позиции карусели/ряда
 * наград/кнопок режима сняты редактором заново на новом фоне.
 *
 * shmot_shop.js._showShopTip() рисует в this._shopTipCard (контейнер экрана магазина шмоток) —
 * его нельзя переиспользовать напрямую на экране предбоя (там этого контейнера нет), поэтому
 * контент (заголовок/Бонус/Сет/пунктир/Требования, тот же стиль) воспроизведён в
 * bosses_prefight.js._openBossPreFight() локально, по тому же item-каталогу window.shmot.items.
 *
 * Run: node tests/boss-prefight-shmot-carousel-hover-tooltip.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_prefight.js'), 'utf-8');

console.log('\nTest 1: рамка карусели интерактивна, hover/out подключены к показу/скрытию тултипа');
{
    assert(/shmotFrame\.interactive = true; shmotFrame\.buttonMode = true;/.test(src),
        'shmotFrame сделана интерактивной (хит-зона тултипа — вся рамка, не только картинка)');
    assert(/shmotFrame\.on\('pointerover', \(\) => \{ if\(currentShmotItemId != null\) _showBossShmotTip\(currentShmotItemId\); \}\);/.test(src),
        'pointerover показывает тултип для ТЕКУЩЕГО предмета карусели (если он есть)');
    assert(/shmotFrame\.on\('pointerout',\s*\(\) => _hideBossShmotTip\(\)\);/.test(src),
        'pointerout скрывает тултип');
}

console.log('\nTest 2: _showBossShmotTip(itemId) — тот же набор полей/стиль, что и shmot_shop.js._showShopTip()');
{
    const start = src.indexOf('const _showBossShmotTip = (itemId) => {');
    const end   = src.indexOf('\n        };', start);
    const body  = src.slice(start, end);
    assert(start !== -1, '_showBossShmotTip найдена');
    assert(/const item = window\.shmot && Array\.isArray\(shmot\.items\) \? shmot\.items\.find\(it => it\.id === itemId\) : null;/.test(body),
        'ищет предмет в общем каталоге window.shmot.items (та же серверная истина owned/equipped)');
    assert(/const title = new PIXI\.Text\(item\.name, titleStyle\);/.test(body), 'заголовок — item.name');
    assert(/const bonusVal = new PIXI\.Text\(item\.bonus \|\| 'нет бонуса',/.test(body), 'строка "Бонус: " — та же, что в магазине');
    assert(/const prog = shmot\._setProgress\(item\.set\);/.test(body),
        'прогресс сета читается через shmot._setProgress (общий метод, не задублирован)');
    assert(/const reqLbl = new PIXI\.Text\('Требования:', lblStyle\);/.test(body), '"Требования:" секция присутствует');
    assert(/reqText = 'Цена: ' \+ item\.price\.a \+ ' ' \+ unit;/.test(body), 'покупные вещи — "Цена: N единиц"');
    assert(/const have = \(shmot\.fragmentsProgress && shmot\.fragmentsProgress\[item\.id\]\) \|\| 0;/.test(body),
        'дроп-вещи с фрагментами — прогресс сборки читается из shmot.fragmentsProgress (тот же источник, что и в магазине)');
}

console.log('\nTest 3: currentShmotItemId синхронизирован с _renderShmotCarousel(), открытый тултип обновляется при листании стрелками');
{
    const start = src.indexOf('const _renderShmotCarousel = () => {');
    const end   = src.indexOf('\n        };', start);
    const body  = src.slice(start, end);
    assert(/currentShmotItemId = null; _hideBossShmotTip\(\);/.test(body),
        'пустой пул или предмет без картинки — currentShmotItemId сбрасывается, тултип скрывается (не показывает мусор)');
    assert(/currentShmotItemId = itemId;/.test(body), 'currentShmotItemId обновляется на реальный id текущего слота карусели');
    assert(/if\(bossShmotTipCard\.visible\) _showBossShmotTip\(itemId\);/.test(body),
        'если тултип уже открыт (курсор не уходил с рамки) — листание стрелкой сразу освежает описание на новый предмет');
}

console.log('\nTest 4: тултип-карточка добавлена в win ПОСЛЕДНЕЙ (рисуется поверх всего остального на экране)');
{
    const lastAddChildIdx = src.lastIndexOf('win.addChild(');
    const tipAddChildIdx  = src.indexOf('win.addChild(bossShmotTipCard);');
    assert(tipAddChildIdx !== -1, 'win.addChild(bossShmotTipCard) найден');
    assert(tipAddChildIdx === lastAddChildIdx, 'bossShmotTipCard — самый последний addChild в win (топ z-order)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
