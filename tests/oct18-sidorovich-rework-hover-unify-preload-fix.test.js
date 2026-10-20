/**
 * Test: батч 18.10.2026 (по прямому указанию, большой набор правок поверх вчерашней замены
 * сигарет на сухари) — покрывает только ПОВЕДЕНЧЕСКИЕ изменения (не x/y/scale-координаты,
 * для них по правилу №10/04.10.2026 AGENTS.md обновлены существующие regex-тесты на месте).
 *
 * 1) Сидорович: хит-зона сухарей реально ведёт в НОВЫЙ попап покупки, не в старое окно банка
 *    на вкладке "сиги" — это и был настоящий баг "до сих пор покупка сигарет, а не сухарей".
 * 2) bank.js: вкладка "сиги" внутри старого окна банка спрятана — второй, обходной путь к той
 *    же старой графике закрыт.
 * 3) Сидорович: банка/консервы получили idle+hover пару файлов, банка — специальный z-order
 *    (под сумкой в покое, НАД сумкой при наведении).
 * 4) Фон экрана Сидоровича — новый файл вместо popup_sidorovich.png.
 * 5) game-boot.js — весь батч ассетов (69 файлов 17.10 + новые 18.10) реально в прелоаде —
 *    регресс-страховка на баг-класс "текстура ещё не загружена, .width синхронно читается как
 *    плейсхолдер" (шкалы уровня/энергии заливка не отображались именно по этой причине).
 * 6) ui_kit.js — новый общий hover-эффект (_addHoverScale/_scHover): растёт и сжимается
 *    СИММЕТРИЧНО от центра, не от angle(0,0).
 * 7) interface.js — уровень игрока пишется просто цифрой, без префикса "УР.".
 * 8) ryukzak.js — уголок-ремешок добавлен ПОСЛЕ баннера "шанс на шмотку" (значит лежит НАД
 *    ним — явно продиктованный z-order).
 *
 * Run: node tests/oct18-sidorovich-rework-hover-unify-preload-fix.test.js
 */

const fs  = require('fs');
const path = require('path');
const vm  = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const sidSrc  = read('_client/src/game/shell/overlays/sidorovich.js');
const bankSrc = read('_client/src/game/bank.js');
const bootSrc = read('_client/src/game/game-boot.js');
const kitSrc  = read('_client/src/game/shell/ui_kit.js');
const ifaceSrc = read('_client/src/game/interface.js');
const ryukSrc  = read('_client/src/game/shell/overlays/ryukzak.js');

console.log('\n1) Сидорович — наведение/клик по сухарям ведёт в новый попап покупки, не в старое окно банка');
{
    // 18.10.2026 (4-е указание тем же днём — "не нужен отдельный хитбокс"): отдельная Graphics-
    // зона sigHit убрана, обработчик теперь висит прямо на sigShelf (idle-спрайт сухарей).
    const start = sidSrc.indexOf('sigShelf.interactive = true;');
    const end   = sidSrc.indexOf('sumkaFront.interactive = true;');
    const block = sidSrc.slice(start, end);
    assert(!!block && start !== -1, 'блок sigShelf-интерактивности найден');
    const handlerLine = block.slice(block.lastIndexOf("sigShelf.on('pointerdown'"));
    assert(/this\._openCurrencyPurchasePopup\('cigarettes'\)/.test(handlerLine), "pointerdown вызывает this._openCurrencyPurchasePopup('cigarettes')");
    assert(!/bank\.init\('cigarettes'\)/.test(handlerLine), "старый bank.init('cigarettes') в САМОМ ОБРАБОТЧИКЕ больше не вызывается");
}

console.log("\n2) bank.js — вкладка «сиги» внутри старого окна банка спрятана (второй путь к старой графике закрыт)");
{
    const start = bankSrc.indexOf('init(tab){');
    const end   = bankSrc.indexOf('for(let i = 0; i < keys_slot.length; i++)this.atm.win', start);
    const block = bankSrc.slice(start, end);
    assert(/butt_slot_cigarettes\.visible = false/.test(block), 'хитбокс-кнопка "сиги" скрыта');
    assert(/butt_slot_cigarettes\.interactive = false/.test(block), 'хитбокс-кнопка "сиги" некликабельна');
    // 18.10.2026 (баг найден по живому скриншоту — пачка "ЗВЕЗДА" всё ещё видна): butt_slot_*
    // это ТОЛЬКО хитбокс (тот же паттерн, что butt_settings/butt_settings_icon) — реальная
    // картинка пачки лежит в ОТДЕЛЬНОМ cigarettes_icon, скрывать нужно оба.
    assert(/cigarettes_icon\.visible = false/.test(block), 'ОТДЕЛЬНЫЙ видимый спрайт пачки (cigarettes_icon) тоже скрыт, не только хитбокс');
    assert(/tab !== 'cigarettes'/.test(bankSrc), "передача tab='cigarettes' извне тоже не откроет эту вкладку по умолчанию");
}

console.log('\n3) Сидорович — банка: idle ДО сумки (под рюкзаком), hover ПОСЛЕ сумки (над рюкзаком)');
{
    const idleIdx    = sidSrc.indexOf('const bankaIdle');
    const sumkaIdx    = sidSrc.indexOf('const sumkaFront');
    const bankaActIdx = sidSrc.indexOf('const bankaActiv');
    assert(idleIdx !== -1 && sumkaIdx !== -1 && bankaActIdx !== -1, 'все три объекта найдены в коде');
    assert(idleIdx < sumkaIdx, 'bankaIdle объявлен (и, следовательно, добавлен в win) РАНЬШЕ sumkaFront — лежит под сумкой');
    assert(bankaActIdx > sumkaIdx, 'bankaActiv объявлен (и добавлен) ПОЗЖЕ sumkaFront — ложится поверх сумки при наведении');

    // 18.10.2026 (по прямому указанию — "убери прозрачные отступы у всех файлов Сидоровича"):
    // оба файла обрезаны по альфа-каналу, суффикс "v2" — см.
    // oct18-batch4-sidorovich-crop-energy-relocate-ryukzak-fixes.test.js.
    assert(/сидорович консервы неактив v2\.png/.test(sidSrc) && /сидорович консервы актив v2\.png/.test(sidSrc),
        'консервы получили отдельную idle+hover пару файлов (раньше рисунок был запечён в общий фон)');
}

console.log('\n4) Сидорович — новый фон экрана вместо popup_sidorovich.png');
{
    assert(/сидорович фон экран\.png/.test(sidSrc), 'новый файл фона подключён');
    assert(!/popup_sidorovich\.png/.test(sidSrc), 'старое имя фона нигде не осталось');
}

console.log('\n5) game-boot.js — критичные файлы батча реально в общем прелоаде (регресс по классу "преждевременное чтение .width")');
{
    const mustPreload = [
        'верхний худ шкала уровня заливка.png',
        'верхний худ шкала энергии заливка.png',
        'нижний худ кнопка боссы.png',
        // 18.10.2026 (повторная правка тем же днём): фон попапа покупки переименован в
        // generic-имя при переходе на 3-вкладочный попап — см. interface-currency-purchase.js.
        'попап покупки фон окно.png',
        'рюкзак карточка сухарики.png',
        'ячейка награда сухари.png',
    ];
    for(const f of mustPreload){
        assert(bootSrc.includes("'" + f + "'"), `"${f}" присутствует в прелоаде`);
    }
}

console.log('\n6) ui_kit.js — унифицированный hover (_addHoverScale/_scHover): растёт от ЦЕНТРА, не от (0,0)');
{
    assert(/proto\._addHoverScale = function/.test(kitSrc), '_addHoverScale определён');
    assert(/window\._scHover = /.test(kitSrc), '_scHover (RAF-степпер) определён');
    // 18.10.2026 (по прямому указанию — "кнопки нижнего худа зеленеют на hover, убери,
    // увеличение сделай в полтора раза меньше"): _addHoverGlow больше не красит tint'ом,
    // вызывает _addHoverScale с уменьшенной амплитудой (0.08/1.5 вместо дефолтных 0.08).
    assert(/this\._addHoverScale\(btn, 1 \+ 0\.08 \/ 1\.5\);/.test(kitSrc), '_addHoverGlow вызывает _addHoverScale с уменьшенной в 1.5 раза амплитудой роста, без tint');
    assert(!/btn\.tint = 0xFFDD88/.test(kitSrc), '_addHoverGlow больше НЕ красит кнопку tint-ом при наведении');

    // Реальное исполнение: центр объекта (local x + width/2, y + height/2) не должен сдвигаться
    // при включении/выключении hover, только сам объект должен расти и возвращаться обратно.
    const m = kitSrc.match(/window\._scHover = \(btn, factor, speed\) => \{[\s\S]*?\n\t\};/);
    assert(!!m, 'тело _scHover извлечено для исполнения в песочнице');

    const sandbox = { cancelAnimationFrame: () => {}, console };
    // Синхронный RAF-мок — степпер добегает до цели за конечное число вызовов без реального таймера.
    sandbox.requestAnimationFrame = (fn) => { sandbox._pending = fn; return 1; };
    sandbox.window = sandbox; // window.X = ... в исходнике должно попасть в тот же контекст
    vm.createContext(sandbox);
    vm.runInContext(m[0], sandbox);

    const btn = {
        x: 100, y: 50,
        scale: { x: 1, y: 1, set(x, y){ this.x = x; this.y = (y === undefined ? x : y); } },
        _hoverBaseScaleX: 1, _hoverBaseScaleY: 1,
        _hoverBaseX: 100, _hoverBaseY: 50,
        _hoverBaseW: 60, _hoverBaseH: 40,
    };
    const centerBefore = { x: btn.x + btn._hoverBaseW / 2, y: btn.y + btn._hoverBaseH / 2 };

    sandbox._scHover(btn, 1.08);
    for(let i = 0; i < 200 && sandbox._pending; i++){ const fn = sandbox._pending; sandbox._pending = null; fn(); }

    const w = btn._hoverBaseW * btn.scale.x, h = btn._hoverBaseH * btn.scale.y;
    const centerAfter = { x: btn.x + w / 2, y: btn.y + h / 2 };
    assert(Math.abs(centerAfter.x - centerBefore.x) < 0.5 && Math.abs(centerAfter.y - centerBefore.y) < 0.5,
        'центр объекта не сместился при увеличении (рост идёт симметрично во все стороны, не от верхнего левого угла)');
    assert(Math.abs(btn.scale.x - 1.08) < 0.01, 'scale реально доехал до целевого значения (1.08)');

    sandbox._scHover(btn, 1);
    for(let i = 0; i < 200 && sandbox._pending; i++){ const fn = sandbox._pending; sandbox._pending = null; fn(); }
    assert(Math.abs(btn.scale.x - 1) < 0.01 && Math.abs(btn.x - 100) < 0.5 && Math.abs(btn.y - 50) < 0.5,
        'при отведении курсора кнопка плавно возвращается ровно в исходные x/y/scale');
}

console.log('\n7) interface.js — уровень игрока пишется просто цифрой, без префикса "УР."');
{
    assert(/this\.level_txt\.text = String\(level\);/.test(ifaceSrc), 'updateNick() пишет String(level), не "УР." + level');
    assert(!/this\.level_txt\.text = 'УР\.' \+ level;/.test(ifaceSrc), 'старый формат с префиксом "УР." убран');
}

console.log('\n8) ryukzak.js — уголок-ремешок лежит НАД баннером "шанс на шмотку" (z-order)');
{
    const bannerIdx = ryukSrc.indexOf('const shmotBanner');
    const strapIdx  = ryukSrc.indexOf('const cornerStrap');
    assert(bannerIdx !== -1 && strapIdx !== -1, 'оба объекта найдены');
    assert(strapIdx > bannerIdx, 'cornerStrap объявлен (и добавлен в win) ПОСЛЕ shmotBanner — рендерится поверх него');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
