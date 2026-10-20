/**
 * Test: замена ресурса "сигареты" → "сухари" по всей игре + сопутствующая переработка UI
 * (17.10.2026, по прямому указанию — отказ от сигарет для прохождения модерации VK).
 *
 * Огромный батч правок, план согласован через EnterPlanMode/ExitPlanMode (см. план-файл
 * vast-spinning-comet.md). Это НЕ позиционные правки (x/y/scale) — несколько мест меняют
 * реальное поведение (новый аккордеон верхнего HUD, перестроенный нижний HUD с новыми
 * обработчиками, динамическая раскладка грида наград рюкзака вместо жёстких 6 слотов,
 * 3 стаканчика вместо 1 дизайна на всю мини-игру, новый серверный dev-permit) — по правилу
 * №10 AGENTS.md такие изменения ОБЯЗАНЫ иметь тест, а не только позиционные координаты.
 *
 * Run: node tests/sukhari-replace-cigarettes-ui-rebuild.test.js
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }
function exists(rel){ return fs.existsSync(path.join(root, rel)); }

console.log('\n1) Боевка — общая иконка награды сухарей вместо сигарет (reward.js ICON_MAP)');
{
    const src = read('_client/src/game/shell/popups/reward.js');
    // 18.10.2026 (баг найден по прямому указанию — "в попапе награды не выводится ячейка
    // награда сухари.png"): ICON_MAP здесь рисует КАРТОЧКИ этого конкретного попапа в масштабе,
    // рассчитанном под портретные карты вроде "попап награда опыт.png" — 'боевка награда
    // сухари.png' маленькая квадратная иконка для ДРУГИХ мест (двор/блэкджек/тултип перед боем),
    // в этом попапе с тем же масштабом она тонула почти до невидимости. ICON_MAP переключён на
    // 'ячейка награда сухари.png' — файл так и назван пользователем под размер именно этого
    // попапа. 'боевка награда сухари.png' по-прежнему используется в ДРУГИХ местах (см. grep —
    // dvor.js/dvor-blackjack.js/bosses_prefight.js), здесь это не регрессия, а две разные иконки.
    assert(/cig:\s*'ячейка награда сухари\.png'/.test(src), 'cig → ячейка награда сухари.png');
    assert(/cigarettes:\s*'ячейка награда сухари\.png'/.test(src), 'cigarettes → ячейка награда сухари.png');
    assert(!src.includes('попап награда сигареты.png'), 'старый файл сигарет больше не используется в ICON_MAP');
}

console.log('\n1b) Достижения — иконка "накопил сухарей" вместо старой пачки сигарет (18.10.2026,');
console.log('    новый файл прислан пользователем)');
{
    const achIcons = read('_client/src/game/interface/interface-achievements.js');
    assert(/cig_hoard:\s*'сухари\.png'/.test(achIcons), "ICON_MAP.cig_hoard → 'сухари.png'");
    assert(fs.existsSync(path.join(root, '_client/development/images/achievements/сухари.png')),
        'файл achievements/сухари.png реально лежит на диске');

    // Зона/бизнес — "СИГАРЕТЫ"/"СИГАРЕТ" были последними дословными упоминаниями валюты в
    // попапе бизнеса (income-лейбл + тултип цены улучшения), найдено при сверке соседнего файла
    // бизнес-фона (biz_bg.png), который в этом же батче заменён на новый арт "бизнес на локациях".
    const zoneBiz = read('_client/src/game/zone/zone-biz.js');
    assert(!/СИГАРЕТЫ|СИГАРЕТ\b/.test(zoneBiz), 'в попапе бизнеса не осталось дословных "СИГАРЕТЫ"/"СИГАРЕТ"');
    assert(/label:\s*'СУХАРИ'/.test(zoneBiz), "income_cig.label → 'СУХАРИ'");
    assert(/СУХАРЕЙ'/.test(zoneBiz), "тултип цены улучшения → 'СУХАРЕЙ'");
}

console.log('\n2) Верхний HUD — новый виджет валют (interface-top-currency.js)');
{
    assert(exists('_client/src/game/interface/interface-top-currency.js'), 'файл interface-top-currency.js создан');
    const src = read('_client/src/game/interface/interface-top-currency.js');
    assert(/proto\._buildTopCurrencyWidget = function/.test(src), '_buildTopCurrencyWidget определён');
    assert(/val_stew\.visible = false/.test(src) || /up\[k\]\.visible = false/.test(src), 'старые FLA-плашки (val_stew/val_coins/val_cigarettes) скрываются, не трогаются напрямую');
    assert(/верхний худ плашка ресурса\.png/.test(src), 'новая плашка переиспользуется (не старое имя "...имя уровень")');
    assert(/this\._topCurrencyExpanded = !this\._topCurrencyExpanded/.test(src), 'аккордеон — чистый тоггл (18.10.2026), не одноразовый "развернуть"');
    // 18.10.2026 (повторная правка тем же днём — "FLA → обычные изображения" для ВСЕХ точек
    // покупки): отдельный popup только для сухарей заменён общим 3-вкладочным попапом, см.
    // bank-currency-hud-restore.test.js (Test 3/5) для подробной проверки нового поведения.
    // 18.10.2026 (ещё раз тем же днём — "сухари должны оставаться сверху после свапа"): кнопка
    // "+" нижней строки больше не захардкожена на 'cigarettes' — ведёт в otherKey(pinned),
    // т.к. снизу может оказаться и тушёнка (после свапа), см. 2b ниже для поведенческой проверки.
    assert(/_openCurrencyPurchasePopup\(otherKey\(this\._topCurPinned\)\)/.test(src), 'кнопка "+" нижней строки открывает новый попап покупки (вкладка — текущая нижняя валюта)');

    const iface = read('_client/src/game/interface.js');
    assert(/attachTopCurrency\(Interface\.prototype\)/.test(iface), 'attachTopCurrency подключён в interface.js');
    assert(/this\._buildTopCurrencyWidget\(\)/.test(iface), '_buildTopCurrencyWidget вызывается при инициализации HUD');
    assert(/this\._updateTopCurrency\(\)/.test(iface), 'updateUp() обновляет новый виджет, не только старые val_*.tf_txt');
}

console.log('\n2b) Верхний HUD — аккордеон реально сворачивается обратно (18.10.2026, баг из живого');
console.log('    репорта — "развернул сухари, закрыл шторку, сухари остались висеть"), плюс');
console.log('    18.10.2026 (повторное указание тем же днём) — клик по раскрытой строке закрепляет её');
console.log('    валюту наверху и закрывает шторку, вместо открытия покупки');
{
    // Раньше btnToggle (тогда ещё btnStewToggle) при развёрнутом состоянии открывал
    // bank.init('stew') ВМЕСТО сворачивания — у стрелки не было пути просто спрятать нижнюю
    // строку обратно. Теперь покупка верхней строки переехала на клик по iconPrimary, а
    // стрелка — чистый тоггл visible-флагов. Отдельно — клик по иконке САМОЙ раскрытой (нижней)
    // строки больше не открывает покупку, а меняет местами закреплённую/раскрытую валюту и
    // закрывает шторку (this._topCurPinned). Реальное исполнение в vm-песочнице с моками
    // PIXI/window — проверяем ПОВЕДЕНИЕ, не текст. Объекты перехватываются через addChild
    // (порядок строго следует коду виджета).
    class FakeSprite {
        constructor(){ this.x=0; this.y=0; this.visible=true; this.interactive=false; this.buttonMode=false;
            this.scale={x:1,y:1,set(){}}; this._h = {}; }
        on(evt, fn){ this._h[evt] = fn; return this; }
        fire(evt){ if(this._h[evt]) this._h[evt](); }
    }
    class FakeText extends FakeSprite {}
    const created = [];
    class FakeContainer extends FakeSprite {
        addChild(c){ created.push(c); return c; }
    }
    const sandbox = {
        PIXI: { Sprite: FakeSprite, Text: FakeText, Container: FakeContainer, Texture: { from: () => ({}) } },
        console,
    };
    // 18.10.2026: iconPrimary/btnRubPlus/btnSecondaryPlus/shopBtn больше не зовут
    // window.bank.init() напрямую — все идут через this._openCurrencyPurchasePopup(tab) (новый
    // 3-вкладочный попап, interface-currency-purchase.js). purchCalls записывает эти вызовы.
    const purchCalls = [];
    sandbox.window = { isMobile:false, helper:null, bank:null, iface:{ restoreHud(){} } };
    sandbox.window.window = sandbox.window;
    sandbox.iface = sandbox.window.iface;
    sandbox.helper = { formatKK: (n) => String(n) };
    vm.createContext(sandbox);

    const srcTop = read('_client/src/game/interface/interface-top-currency.js');
    vm.runInContext(
        srcTop.replace('export function attachTopCurrency', 'function attachTopCurrency') + '\nthis._attachTopCurrency = attachTopCurrency;',
        sandbox
    );

    const fakeIface = { up: new sandbox.PIXI.Container(), _openCurrencyPurchasePopup: (tab) => purchCalls.push(tab) };
    sandbox._attachTopCurrency(fakeIface);
    fakeIface._buildTopCurrencyWidget();

    // Порядок addChild строго следует коду: bg, plateRub, iconRub, txtRub, btnRubPlus,
    // platePrimary, iconPrimary, txtPrimary, btnToggle, plateSecondary, iconSecondary,
    // txtSecondary, btnSecondaryPlus, ...
    const iconPrimary     = created[6];
    const btnToggle       = created[8];
    const plateSecondary  = created[9];
    const iconSecondary   = created[10];
    const txtSecondary    = created[11];
    const btnSecondaryPlus = created[12];

    assert(fakeIface._topCurPinned === 'stew', 'по умолчанию наверху закреплена тушёнка');
    assert(plateSecondary.visible === false && iconSecondary.visible === false, 'нижняя строка изначально скрыта');

    btnToggle.fire('pointerdown');
    assert(fakeIface._topCurrencyExpanded === true, 'первый клик по стрелке — развернул');
    assert(plateSecondary.visible === true && iconSecondary.visible === true && txtSecondary.visible === true && btnSecondaryPlus.visible === true,
        'нижняя строка показана после разворота');
    assert(purchCalls.length === 0, 'разворот НЕ открывает попап покупки — раньше это и было багом');

    btnToggle.fire('pointerdown');
    assert(fakeIface._topCurrencyExpanded === false, 'второй клик по той же стрелке — свернул обратно (18.10.2026 фикс)');
    assert(plateSecondary.visible === false && iconSecondary.visible === false && txtSecondary.visible === false && btnSecondaryPlus.visible === false,
        'нижняя строка СНОВА скрыта — раньше "не убиралась"');
    assert(purchCalls.length === 0, 'сворачивание тоже НЕ открывает попап покупки');

    iconPrimary.fire('pointerdown');
    assert(purchCalls[0] === 'stew', 'покупка закреплённой валюты висит на иконке верхней строки (ведёт в новый попап, вкладка stew)');

    // Новый сценарий: раскрыть → кликнуть по самой раскрытой (нижней) строке → валюта
    // закрепляется наверху, шторка закрывается, покупка НЕ открывается.
    btnToggle.fire('pointerdown');
    assert(fakeIface._topCurrencyExpanded === true, 'раскрыли ещё раз для сценария свапа');
    iconSecondary.fire('pointerdown');
    assert(fakeIface._topCurPinned === 'cigarettes', 'клик по раскрытой строке закрепил сухари наверху (были внизу)');
    assert(fakeIface._topCurrencyExpanded === false, 'после свапа шторка закрыта — сухари "остались сверху", как просил пользователь');
    assert(purchCalls.length === 1, 'клик по раскрытой строке НЕ открыл попап покупки (всё ещё только 1 вызов — предыдущий, от iconPrimary)');
}

console.log('\n3) Попап покупки валюты — 3 вкладки (консервы/рубли/сухари), 8 тарифов через donuts_info');
{
    // 18.10.2026 (по прямому указанию, повторный проход — "пройдись по всему проекту где есть
    // покупка, FLA → обычные изображения"): отдельный файл только для сухарей
    // (interface-sukhari-purchase.js) заменён общим 3-вкладочным попапом — консервы и рубли
    // раньше ВСЁ ЕЩЁ открывали старое FLA-окно банка (bank.init), хотя сухари уже были
    // переведены. Полная проверка нового файла — bank-currency-hud-restore.test.js (Test 5).
    assert(exists('_client/src/game/interface/interface-currency-purchase.js'), 'файл interface-currency-purchase.js создан');
    assert(!exists('_client/src/game/interface/interface-sukhari-purchase.js'), 'старый interface-sukhari-purchase.js удалён (не оставлен мёртвым кодом)');
    const src = read('_client/src/game/interface/interface-currency-purchase.js');
    assert(/startPurchase\(/.test(src), 'покупка идёт через общий startPurchase() (modules/iap.js), не напрямую VKWebAppShowOrderBox');
    assert(/bank\.set_donut = itemNum/.test(src), 'bank.set_donut выставляется ДО startPurchase — иначе successDonat() не узнает, что покупалось');

    const donuts = JSON.parse(read('server/json/donuts.json'));
    assert(JSON.stringify(donuts.cigarettes.default) === JSON.stringify([1600,3600,6000,8000,11000,22000,125000,300000]),
        'donuts.json.cigarettes.default даёт те же 8 сумм сухарей, что и раньше (тарифы не менялись)');
    assert(Array.isArray(donuts.stew.default) && donuts.stew.default.length === 8, 'donuts.json.stew — 8 тарифов консервов');
    assert(Array.isArray(donuts.coins.default) && donuts.coins.default.length === 8, 'donuts.json.coins — 8 тарифов рублей');
}

console.log('\n4) Нижний HUD — новый блок кнопок (interface-bottom-nav.js)');
{
    assert(exists('_client/src/game/interface/interface-bottom-nav.js'), 'файл interface-bottom-nav.js создан');
    const src = read('_client/src/game/interface/interface-bottom-nav.js');
    assert(/clickable: false/.test(src), 'кнопка "Банда" помечена некликабельной');
    assert(/'нижний худ кнопка банда\.png'/.test(src) && /'нижний худ кнопка боссы\.png'/.test(src)
        && /'нижний худ кнопка зона\.png'/.test(src) && /'нижний худ кнопка оружейка\.png'/.test(src)
        && /'нижний худ кнопка сидорович\.png'/.test(src) && /'нижний худ кнопка шмотки\.png'/.test(src),
        'все 6 новых файлов кнопок подключены');
    assert(/скоро банда\.png/.test(src), 'плашка "СКОРО" переиспользована (не удалена)');
    assert(/this\.down\.addChild\(nav\)/.test(src), 'новый блок — ДОЧЕРНИЙ this.down (иначе restoreHud() не будет прятать/двигать его вместе с остальным HUD)');
    assert(/nav\.y = -this\.down\.y/.test(src), 'компенсация смещения this.down.y=596, иначе координаты кнопок окажутся не абсолютными');
    assert(/butt_bosses.*interactive = false|interactive = false.*butt_bosses/.test(src) || /\]\.forEach\(k => \{\s*if\(this\.down\[k\]\) this\.down\[k\]\.interactive = false/.test(src),
        'старые невидимые хитбоксы (butt_bosses и т.д.) глушатся — иначе клики по новым кнопкам дублировались бы старыми обработчиками на старых координатах');

    const iface = read('_client/src/game/interface.js');
    assert(/attachBottomNav\(Interface\.prototype\)/.test(iface), 'attachBottomNav подключён в interface.js');
    assert(/this\._buildBottomNav\(\)/.test(iface), '_buildBottomNav() вызывается из init()');

    // 18.10.2026 (по прямому указанию — "эту подложку нужно убрать", сам поднял кнопки через
    // редактор позиций и показал тёмный прямоугольник под ними): закраска-"cover" была нужна,
    // пока не было точечного удаления старой FLA-подложки (interface_down_panel_bg) — теперь
    // есть _removeStrayAtlasArt(this.down), закраска стала лишним собственным прямоугольником.
    assert(!/beginFill\(0x1a1410/.test(src), 'тёмная закраска-подложка нижнего HUD убрана (была лишним "серым прямоугольником")');
    // 18.10.2026 (повторное указание тем же днём — "fla объект удаляй, может в этом проблема"):
    // точечное угадывание размеров ненадёжно — вместо этого прячем ВСЕ существующие дети
    // this.down перед добавлением nav, не полагаясь на то, что мы знаем размеры всего мусора.
    assert(/\[\.\.\.this\.down\.children\]\.forEach\(c => \{ c\.visible = false; \}\);/.test(src),
        'все существующие дети this.down принудительно прячутся перед добавлением nav (не полагаемся на угаданные размеры стрей-арта)');

    // Порядок внутри init(): downInit() (который сам зовёт _removeStrayAtlasArt) ДОЛЖЕН
    // выполниться раньше _buildBottomNav() — иначе nav добавится, а затем свежедобавленный
    // nav.visible тоже попадёт под раздачу "спрятать всё" в последующем _buildBottomNav(),
    // если бы порядок был обратным. Сравниваем позиции именно ВЫЗОВОВ внутри init(), а не
    // объявлений методов (та часть кода находится в другом месте файла).
    const initIdx = iface.indexOf('init(){');
    const initBody = iface.slice(initIdx, iface.indexOf('\n\t}', initIdx));
    const downInitCallIdx = initBody.indexOf('this.downInit();');
    const navCallIdx = initBody.indexOf('this._buildBottomNav();');
    assert(downInitCallIdx !== -1 && navCallIdx !== -1 && downInitCallIdx < navCallIdx,
        'this.downInit() вызывается РАНЬШЕ this._buildBottomNav() внутри init()');
    assert(/this\._removeStrayAtlasArt\(this\.down\);/.test(iface), '_removeStrayAtlasArt(this.down) по-прежнему вызывается внутри downInit() (первый, точечный слой защиты)');
}

console.log('\n5) Рулетка — 3 дизайна стаканчиков, вперемешку (dvor-roulette-minigame.js)');
{
    const src = read('_client/src/game/dvor/dvor-roulette-minigame.js');
    assert(/CUP_FILES = \[/.test(src), 'массив из 3 файлов стаканчиков определён');
    assert(/стаканчик суперигра предупреждение\.png/.test(src) && /стаканчик суперигра противогаз\.png/.test(src),
        'оба новых дизайна подключены');
    // 20.10.2026 (по прямому указанию — "три одинаковых подряд, нужно вперемешку"): было
    // 3 группы по 3 подряд (Math.floor(i/3)), теперь чередование (i % 3) — не захардкожен
    // один файл на все 9.
    assert(/CUP_FILES\[i % 3\]/.test(src), 'индекс цикла (0-8) выбирает файл по i % 3 — дизайны чередуются, не идут группами по 3 подряд');
}

console.log('\n6) Рулетка — баннер результата кейса по hasTatu (dvor-roulette-buy.js)');
{
    const src = read('_client/src/game/dvor/dvor-roulette-buy.js');
    assert(/двор рулетка кейс закрытый\.png/.test(src), 'закрытый кейс — новый файл');
    assert(/двор рулетка кейс открытый содержимое\.png/.test(src), 'открытый кейс (без тату) — новый файл');
    assert(/двор рулетка банер выпала шмотка\.png/.test(src) && /двор рулетка банер не выпало\.png/.test(src),
        'оба варианта баннера результата подключены');
    const bannerM = src.match(/const resultBanner[\s\S]{0,300}/);
    assert(!!bannerM && /hasTatu \? 'двор рулетка банер выпала шмотка\.png' : 'двор рулетка банер не выпало\.png'/.test(bannerM[0]),
        'баннер выбирается по hasTatu (выпало тату = "элемент шмотки" из рекламной таблички кейса)');
}

console.log('\n7) Двор — облака "сбор сухарей", 3 штуки вместо 4 (dvor.js)');
{
    const src = read('_client/src/game/dvor.js');
    const sigsM = src.match(/_SIGS\(\)\{([\s\S]*?)\n {4}\}/);
    assert(!!sigsM, '_SIGS() найден');
    if(sigsM){
        const body = sigsM[1];
        const fileCount = (body.match(/сбор сухарей \d\.png/g) || []).length;
        assert(fileCount === 3, '_SIGS() возвращает ровно 3 записи (было 4), найдено: ' + fileCount);
        assert(!/cloud_sig_/.test(body), 'старые cloud_sig_*.png больше не используются в _SIGS()');
    }
    assert(/for\(let i=0; i<3; i\+\+\)\{\s*\n\s*const s   = this\._SIGS\(\)\[i\]/.test(src), '_buildLobby() цикл облаков сухарей — i<3 (было i<4)');
    assert(/for\(let i=0;i<3;i\+\+\)\{\s*\n\s*const spr       = this\._cigSprites\[i\]/.test(src), '_refreshCigSprites() цикл — i<3 (было i<4)');
    assert(/return \[0,1,2\]\.map/.test(src), '_getSigState() — [0,1,2] (было [0,1,2,3])');

    const boot = read('_client/src/game/game-boot.js');
    assert(/'сбор сухарей 1\.png','сбор сухарей 2\.png','сбор сухарей 3\.png'/.test(boot), 'preload обновлён на новые 3 файла');
    assert(!/cloud_sig_1\.png/.test(boot), 'мёртвый preload старых cloud_sig_*.png убран');
}

console.log('\n8) Рюкзак — динамическая раскладка наград вместо 6 фиксированных слотов (ryukzak.js)');
{
    const src = read('_client/src/game/shell/overlays/ryukzak.js');
    assert(/proto\._openRyukzakReward = function\(mockReward\)/.test(src), 'функция принимает опциональный mockReward (для dev-превью)');
    assert(/const TOP_ROW/.test(src) && /const BOTTOM_ROW/.test(src), 'верхний/нижний ряд определены отдельно (не единый FIXED_POS на 6 конкретных наград)');
    assert(/топ.*ВСЕГДА заполнены|ВСЕГДА заполнены ресурсами/i.test(src), 'комментарий фиксирует инвариант: верхний ряд всегда 3 ресурса');
    assert(/рюкзак карточка рублики\.png/.test(src) && /рюкзак карточка сухарики\.png/.test(src) && /рюкзак карточка опыт\.png/.test(src),
        'верхний ряд — новые карточки рублики/сухарики/опыт');
    assert(/рюкзак карточка мачете\.png/.test(src) && /рюкзак карточка макар\.png/.test(src) && /рюкзак карточка калаш\.png/.test(src),
        'нижний ряд — новые карточки оружия (мачете/макар/калаш)');
    assert(/KEY_BOSS_CARD = \{ 1:'рюкзак карточка счастливчик\.png', 2:'рюкзак карточка ястреб\.png', 3:'рюкзак карточка меченный\.png' \}/.test(src),
        'карточка ключа босса — та же карта id→имя (1/2/3), что и раньше, просто новый арт');
    assert(/рюкзак банер шанс на шмотку\.png/.test(src), 'баннер "шанс на шмотку" подключён');
    assert(/ЗАРЕЗЕРВИРОВАНО ВСЕГДА/.test(src), 'комментарий фиксирует инвариант: место под баннер не сдвигает грид (ни сейчас, ни в будущем)');
    assert(!/const keyIconSpr = new PIXI\.Sprite/.test(src), 'старый отдельный floating-спрайт ключа с собственным тултипом удалён (заменён карточкой в гриде)');
    assert(/if\(!mockReward\) _fetchHonestPreview\(\)/.test(src), 'честное серверное превью НЕ перетирает mockReward (иначе dev-превью сразу сломалось бы)');
    assert(/mockShmotkaName/.test(src), 'поддержка тестового названия шмотки для dev-превью баннера');
    assert(!/lvlTxt\.text = 'УРОВЕНЬ РЮКЗАКА : '/.test(src), 'lvlTxt больше не дублирует подпись "УРОВЕНЬ РЮКЗАКА :" — она уже вшита в новую плашку');
}

console.log('\n9) Dev-панель — сброс дневного лимита боёв с боссами (сервер + клиент)');
{
    const php = read('server/core/controllers/bosses.php');
    assert(/'devResetDailyLimits'/.test(php), 'permit devResetDailyLimits зарегистрирован');
    assert(/function devResetDailyLimits\(\)/.test(php), 'метод devResetDailyLimits определён');
    const fnM = php.match(/function devResetDailyLimits\(\)\{([\s\S]*?)\n        \}/);
    assert(!!fnM, 'тело функции найдено');
    if(fnM){
        const body = fnM[1];
        assert(/_requireDevUser/.test(body), 'гейт по dev-uid — обычный игрок не может сбросить себе лимит');
        assert(/dailyKills.*array_fill\(0, 8, 0\)/.test(body), 'dailyKills сбрасывается на 8 нулей');
        assert(/dailyDate.*=\s*''/.test(body), 'dailyDate сбрасывается');
        assert(/saveUser\(\$user\)/.test(body), 'сохраняется через обычный Gameops::saveUser (не сырой UPDATE — риска гонки с другим saveUser в этом же запросе нет, функция простая)');
        assert(/patchCurrencies\(\$user, \['bosses_data'\]\)/.test(body), 'ответ содержит patch с обновлённым bosses_data — иначе клиент не узнает о сбросе без полной перезагрузки');
    }

    const jsPanel = read('_client/src/game/shell/overlays/dev_panel.js');
    assert(/proto\._resetBossDailyLimits = function/.test(jsPanel), 'клиентский метод добавлен');
    assert(/bosses\.devResetDailyLimits/.test(jsPanel), 'зовёт правильный серверный permit');
    assert(/applyPatch\(res\.patch\)/.test(jsPanel.match(/_resetBossDailyLimits = function[\s\S]{0,400}/)[0]), 'применяет patch из ответа (иначе udata останется старым)');
    assert(/_row\('Дневной лимит боёв'/.test(jsPanel), 'кнопка добавлена в секцию БОССЫ');
}

console.log('\n10) Dev-панель — превью рюкзака с мок-шмоткой');
{
    const jsPanel = read('_client/src/game/shell/overlays/dev_panel.js');
    assert(/_row\('Шмотка \(превью\)'/.test(jsPanel), 'кнопка "Шмотка (превью)" добавлена');
    const rowM = jsPanel.match(/_row\('Шмотка \(превью\)'[\s\S]{0,500}/);
    assert(!!rowM && /iface\._openRyukzakReward\(\{/.test(rowM[0]), 'вызывает _openRyukzakReward с объектом мок-награды');
    assert(!!rowM && /mockShmotkaName/.test(rowM[0]), 'передаёт тестовое название шмотки для проверки баннера');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
