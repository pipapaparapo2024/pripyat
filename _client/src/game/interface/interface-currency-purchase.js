import { startPurchase } from '../../modules/iap.js';
import { isOk } from '../../modules/platform.js';
import { formatAchNum } from '../../modules/achievement-tiers.js';

/** Попап покупки валюты — консервы(тушёнка)/рубли/сухари, 3 вкладки в одном окне.
 *
 * 18.10.2026 (по прямому указанию — "пройдись по всему проекту где есть покупка, убери
 * FLA, сделай новый визуал"): раньше тушёнка и рубли открывали СТАРОЕ FLA-окно банка
 * (bank.js, this.atm — тот же bank_bg 879×491, что был виновником бага с сухарями до
 * 17.10.2026) — только сухари уже вели в отдельный новый попап
 * (interface-sukhari-purchase.js, теперь заменён этим файлом). Этот модуль обобщает тот же
 * подход на все 3 валюты: один общий фон с 3 вкладками в левой колонке (запечён в сам
 * фон — см. "попап покупки фон окно.png"), при клике по вкладке активная подсвечивается
 * отдельным "вкладка иконка"-спрайтом (тот же приём, что остальные idle/hover-пары в
 * проекте — hover-арт лежит ПОВЕРХ запечённого в фон idle-рисунка той же вкладки).
 *
 * Покупка по-прежнему идёт через bank.js (window.bank.set_donut + startPurchase) — только
 * ВИЗУАЛ меняется, платёжный путь и server-side начисление (bank.successDonat) не трогались.
 *
 * Тарифы/цены — из server/json/donuts.json (donuts_info), ничего не хардкожено:
 *   stew       (консервы) — 8 тарифов, item0-7
 *   coins      (рубли)    — 8 тарифов, item8-15
 *   cigarettes (сухари)   — 8 тарифов, item16-23 (поле БД не переименовано, см. AGENTS.md)
 *
 * 18.10.2026 (по прямому указанию — "количество пишется сверху в отдельном блоке, цена
 * снизу"): новые файлы слотов ("попап покупки <тип> слот N.png") — уже готовые карточки-
 * рамки БЕЗ запечённого текста (в отличие от старых "попап покупки сухари 1600.png" с
 * вшитой надписью) — количество/цена рисуются отдельным PIXI.Text поверх каждой карточки.
 */
export function attachCurrencyPurchase(proto){

    const BASE = './images/';
    // 18.10.2026 (по прямому указанию — "сделай шрифт и цвет как на картинке 2: Southbank LT,
    // белый" — присланный скрин панели символов Illustrator, 18.34pt): оба текста (количество и
    // цена) получили одинаковый белый стиль вместо прежних жёлтого count/чуть мельче price.
    // 20.10.2026 (по прямому указанию — "буквы разного размера, Г/Л визуально крупнее О/С, '00'
    // ниже '6'"): без явного style.padding PIXI обрезает canvas-текстуру текста по тесной
    // bounding-box, рассчитанной по метрикам КАЖДОГО глифа отдельно — у засечек/выносных
    // элементов шрифта "Southbank LT" она плавает по буквам, из-за чего соседние глифы в одной
    // строке визуально "съезжают" по высоте/базовой линии на 1-2px. padding добавляет запас по
    // краям канваса текстуры (текст остаётся отцентрован anchor'ом, видимого сдвига нет) — тот
    // же стандартный приём для PIXI.Text с засечковыми/декоративными шрифтами.
    // 20.10.2026 (по прямому указанию — "прописывай не просто сколько получит игрок валюты, но
    // и какую валюту"): countTxt теперь включает unitWord (напр. "1600 сухарей", не просто
    // "1600") — добавлен wordWrap, чтобы более длинная подпись переносилась на карте шириной
    // SLOT_W (136px), а не вылезала за край.
    // 19.10.2026 (по прямому указанию — "сделай все шрифты в попапе покупки такими же, как на
    // картинке 3: Southbank LT, белый" — заголовок был единственным оставшимся на старом стиле
    // Bebas Neue Pro Middle/серый, count/price уже переведены на этот стиль 18.10.2026):
    // унифицирован с TXT_STYLE_COUNT/PRICE.
    // 20.10.2026 (по прямому указанию — перенос стиля слоя из Photoshop, присланы скрины панелей
    // "Выполнить обводку"/"Наложение градиента"/"Тень"): точные значения —
    //   Обводка: размер 2px, снаружи, чёрный, непрозрачность 38% (PIXI.Text не умеет отдельную
    //     альфу на обводку — приближено тёмно-серым цветом вместо чёрного на 100%, визуально
    //     близкий результат при композите поверх белой заливки).
    //   Градиент: линейный, "выровнять по слою", угол 90° — сверху вниз, белый → серый.
    //   Тень: чёрная, непрозрачность 72%, смещение 2px, размер(блюр) 3px, угол 112° (Photoshop,
    //     мат. против часовой от +X) — переведено в экранный угол PIXI (по часовой от +X, Y вниз)
    //     формулой 180° - 112° = 68° ≈ 1.187 рад.
    // Тиснение и внутреннее свечение НЕ переносятся — в PIXI.Text нет встроенной поддержки,
    // добавлять отдельную библиотеку фильтров (pixi-filters) под 3 текстовых поля решили не
    // делать (по прямому указанию — "без него можно обойтись").
    const TXT_STYLE_BASE = {
        fontFamily: 'Southbank LT', fontSize: 18,
        fill: ['#ffffff', '#c8c8c8'],
        stroke: '#3a3a3a', strokeThickness: 2,
        dropShadow: true, dropShadowColor: '#000000', dropShadowAlpha: 0.72,
        dropShadowDistance: 2, dropShadowBlur: 2, dropShadowAngle: 1.187,
        padding: 8,
    };
    const TXT_STYLE_COUNT = Object.assign({}, TXT_STYLE_BASE, { align: 'center', wordWrap: true, wordWrapWidth: 130 });
    const TXT_STYLE_PRICE = Object.assign({}, TXT_STYLE_BASE);
    const TXT_STYLE_TITLE = Object.assign({}, TXT_STYLE_BASE);

    const COLS = [372, 537, 702, 867];
    const ROWS = [142, 350];
    const SLOT_W = 136, SLOT_H = 193;

    // 18.10.2026 (по прямому указанию — новые файлы "активное нажатие" на замену старым
    // "вкладка иконка"): позиции вкладок в левой колонке фона сняты заново пользователем —
    // x:244 (было 245, замер того же дня), y по категориям 181/278/379 (консервы/рубли/
    // сухари — тот же порядок сверху вниз, что и раньше).
    const TAB_X = 244;

    const TABS = [
        {
            key: 'stew', label: 'ТУШЕНКА', tabY: 181,
            iconFile: 'попап покупки консервы активное нажатие.png',
            slotFile: (i) => 'попап покупки консервы слот ' + (i + 1) + '.png',
            unitWord: (n) => helper.numberEnd(n, 'stew'),
            // Позиция общего жёлтого маркера "активный слот.png" для этой вкладки (отдельная
            // от tabY — замерена пользователем отдельно, x всегда один и тот же, см. ниже).
            activeSlotY: 212,
        },
        {
            key: 'coins', label: 'РУБЛИ', tabY: 278,
            iconFile: 'попап покупки рубли активное нажатие.png',
            slotFile: (i) => 'попап покупки рубли слот ' + (i + 1) + '.png',
            // 20.10.2026 (по прямому указанию — "для рублей прописывай 'руб'"): короткая
            // неизменяемая подпись вместо склоняемого "монета/монеты/монет" (helper.numberEnd
            // 'coins') — игровая валюта называется "рубли", не "монеты".
            unitWord: (n) => 'руб',
            activeSlotY: 303,
            // 19.10.2026 (по прямому указанию — "сделай этот файл фиксированным 89×89 пикселей"):
            // вместо общего scale:1.03 (который на этом файле давал 84×88 — не квадрат) задаём
            // явный width/height, игнорируя .scale.set(1.03) ниже для этой одной вкладки.
            fixedW: 89, fixedH: 89,
        },
        {
            key: 'cigarettes', label: 'СУХАРИ', tabY: 379,
            iconFile: 'попап покупки сухари активное нажатие.png',
            slotFile: (i) => 'попап покупки сухари слот ' + (i + 1) + '.png',
            unitWord: (n) => helper.numberEnd(n, 'cigarettes'),
            activeSlotY: 402,
        },
    ];
    // Общий "активный слот.png" (жёлтый подсвеченный кружок) — x всегда 211, y берётся из
    // TABS[key].activeSlotY. Один переиспользуемый спрайт, не по одному на вкладку.
    const ACTIVE_SLOT_X = 211;

    proto._openCurrencyPurchasePopup = function(tab){
        // 20.10.2026 (по прямому указанию — репорт "буквы и цифры разного размера" на картах
        // валюты, ПОВТОРИЛСЯ даже после фикса padding:6 тем же днём — значит дело не в
        // обрезке canvas-текстуры): вероятная настоящая причина — гонка загрузки шрифта. PIXI
        // печёт текст на canvas сразу по запросу, не дожидаясь, пока браузер реально доскачает
        // и распарсит @font-face "Southbank LT" (он подключается только DOM-трюком в
        // index.html .font_preload, который лишь ЗАПУСКАЕТ закачку — нигде в проекте нет
        // ожидания document.fonts.ready/check() перед тем, как PIXI начинает рисовать этим
        // шрифтом). Если попап открыт раньше, чем шрифт реально готов, canvas молча подставляет
        // системный fallback ДЛЯ ВСЕЙ строки — но у fallback-шрифта другие пропорции по
        // конкретным глифам, отсюда "некоторые буквы крупнее других" внутри одной строки.
        // PIXI.Text печёт свой canvas ОДИН РАЗ при создании и не перерисовывается сам, когда
        // шрифт догружается позже — ошибка замораживается на весь срок жизни объекта. Ждём
        // document.fonts.ready и только потом реально строим попап — безопасный no-op там, где
        // Font Loading API недоступен (попап просто открывается сразу, как раньше).
        if(typeof document !== 'undefined' && document.fonts && typeof document.fonts.check === 'function'
            && !document.fonts.check("18px 'Southbank LT'")){
            console.log('[iface._openCurrencyPurchasePopup] шрифт Southbank LT ещё не готов — жду document.fonts.ready перед построением попапа');
            document.fonts.ready.then(() => {
                console.log('[iface._openCurrencyPurchasePopup] шрифт готов, открываю попап');
                this._openCurrencyPurchasePopup(tab);
            });
            return;
        }

        const startKey = (tab && TABS.some(t => t.key === tab)) ? tab : 'cigarettes';

        if(this._currPurchWin){
            if(this._currPurchWin.parent) this._currPurchWin.parent.removeChild(this._currPurchWin);
            this._currPurchWin = null;
        }
        if(!window.donuts_info){
            console.error('[iface._openCurrencyPurchasePopup] donuts_info ещё не загружен');
            return;
        }

        const win = new PIXI.Container();
        win.interactive = true;

        // 19.10.2026 (по прямому указанию — "закрывать попап покупки должен только крестик,
        // клик по любому месту ВНЕ попапа не должен его закрывать"): blocker остаётся
        // интерактивным (перехватывает клики по экрану ПОД попапом, чтобы они не проходили
        // насквозь), но больше не закрывает попап сам — только exitBtn ниже это делает.
        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.55);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап покупки фон окно.png'));
        bg.x = 213; bg.y = 99;
        win.addChild(bg);

        // Заголовок — "что покупается" (ТУШЕНКА/РУБЛИ/СУХАРИ), в верхней полосе окна.
        const titleTxt = new PIXI.Text('', TXT_STYLE_TITLE);
        // 20.10.2026: фиксированная высокая плотность растеризации — см. комментарий у
        // countTxt/priceTxt ниже в этом же файле (фикс "буквы разного размера").
        titleTxt.resolution = 4;
        titleTxt.anchor.set(0.5, 0.5);
        // 20.10.2026 (по прямому указанию — "сдвинь название ресурса влево на 65px"): x 717→652.
        titleTxt.x = 652; titleTxt.y = 122;
        win.addChild(titleTxt);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  () => { exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', () => this._closeCurrencyPurchasePopup());
        win.addChild(exitBtn);

        // 18.10.2026 (по прямому указанию — новый общий файл "активный слот.png", жёлтый
        // подсвеченный кружок): один переиспользуемый спрайт под активной вкладкой, позиция
        // переставляется в _switchTab() по TABS[key].activeSlotY (x всегда 211).
        // 18.10.2026 (повторное указание тем же днём — "опусти вниз на 7px, сдвинь вправо на
        // 7px"): применено к базовым координатам.
        const activeSlotSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап покупки активный слот.png'));
        activeSlotSpr.x = ACTIVE_SLOT_X + 7;
        // 18.10.2026 (по прямому указанию — "для всех элементов сдвинь вниз на 5 пикселей"):
        // применено в _switchTab() к каждому def.activeSlotY, не здесь (y там перезаписывается).
        win.addChild(activeSlotSpr);

        // 18.10.2026 (баг найден по прямому указанию — "не кликабельные зоны, вкладки рублей/
        // тушёнки/сухарей не переключаются"): раньше клик висел ПРЯМО на tabIcons[key] — спрайте
        // "активное нажатие", который видим ТОЛЬКО для уже активной вкладки (visible=false для
        // остальных двух). PIXI не хит-тестит invisible-объекты — значит переключиться можно
        // было только НА уже активную вкладку (бессмысленно), а на две другие — никогда. Теперь
        // под каждой вкладкой лежит отдельный ВСЕГДА интерактивный невидимый хитбокс (не зависит
        // от visible активного спрайта), а tabIcons[key] остаётся чисто визуальным оверлеем.
        const TAB_HIT_W = 220, TAB_HIT_H = 90;
        const tabIcons = {};
        TABS.forEach(t => {
            const hit = new PIXI.Graphics();
            hit.beginFill(0xffffff, 0.001);
            hit.drawRect(TAB_X - 20, t.tabY - 10, TAB_HIT_W, TAB_HIT_H);
            hit.endFill();
            hit.interactive = true; hit.buttonMode = true;
            hit.on('pointerdown', () => _switchTab(t.key));
            win.addChild(hit);

            // 18.10.2026 (по прямому указанию — "файлы активное нажатие: scale 1.03, вниз на
            // 2px, вправо на 2px"): применено к базовым координатам каждой вкладки.
            const spr = new PIXI.Sprite(PIXI.Texture.from(BASE + t.iconFile));
            spr.x = TAB_X + 2; spr.y = t.tabY + 2;
            if(t.fixedW && t.fixedH){ spr.width = t.fixedW; spr.height = t.fixedH; }
            else spr.scale.set(1.03);
            win.addChild(spr);
            tabIcons[t.key] = spr;
        });

        const gridCont = new PIXI.Container();
        win.addChild(gridCont);

        // stew(8) + coins(8) идут перед сухарями — тот же сдвиг itemNum, что в bank.js.genSlots.
        const stewLen  = donuts_info['stew']['price'].length;
        const coinsLen = donuts_info['coins']['price'].length;
        const itemBase = { stew: 0, coins: stewLen, cigarettes: stewLen + coinsLen };

        const _switchTab = (key) => {
            this._currPurchTab = key;
            const def = TABS.find(t => t.key === key);
            titleTxt.text = def.label;
            TABS.forEach(t => { tabIcons[t.key].visible = (t.key === key); });
            // 18.10.2026: +5 вниз для всех категорий (поверх уже применённых +7/+7 на x).
            activeSlotSpr.y = def.activeSlotY + 5;

            gridCont.removeChildren();
            const info = donuts_info[key];
            if(!info){ console.error('[iface._openCurrencyPurchasePopup] donuts_info нет для', key); return; }

            info['default'].forEach((count, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const slot = new PIXI.Sprite(PIXI.Texture.from(BASE + def.slotFile(i)));
                slot.x = COLS[col]; slot.y = ROWS[row];
                slot.interactive = true; slot.buttonMode = true;
                if(window.isMobile) helper.touchPad(slot, 96);
                // 20.10.2026 (по прямому указанию — "хайвер для покупки должен быть как на
                // нижнем худе: без увеличения, только лёгкое затемнение"): раньше был
                // _addHoverScale (рост 1.06×) ПОВЕРХ ручного alpha=0.85 — теперь единственный
                // эффект это _addHoverAlpha (тот же, что уже применён к кнопкам нижнего худа,
                // см. interface-bottom-nav.js), без изменения scale/позиции.
                if(typeof this._addHoverAlpha === 'function') this._addHoverAlpha(slot, 0.85);
                gridCont.addChild(slot);

                // 18.10.2026 (по прямому указанию — направление ПЕРЕПУТАНО в прошлой правке:
                // "количество голосов [цена], которые нужно потратить, подними вверх; количество
                // получаемого товара опусти вниз" — ранее применили ровно наоборот, count ушёл
                // вверх, price вниз). Исправлено и пересчитано от ИСХОДНЫХ базовых позиций
                // (slot.y+8 / slot.y+SLOT_H-8), чтобы не копить ошибку поверх ошибки: цена
                // (голоса, нужно потратить) — вверх на 32px от своей исходной нижней позиции;
                // количество (что получает игрок) — вниз на 32px от исходной верхней позиции.
                // 18.10.2026 (повторное указание тем же днём — "ещё на 16px, количество вниз,
                // цена вверх"): применено поверх уже выставленных ±32 (итого ±48 от исходной).
                // 19.10.2026 (по прямому указанию, направление ЧАСТИЧНО откатывается — "голоса
                // [цена], которые нужно потратить, опусти вниз на 33px; количество товара,
                // которое получит игрок, подними вверх на 31px"): применено поверх предыдущих
                // ±48 (итого count: -48+31=-17 от исходного +8 → +25; price: +48-33=+15 от
                // исходного SLOT_H-8 → SLOT_H-8+15, упрощено ниже).
                // 20.10.2026: подпись валюты добавлена к количеству (def.unitWord — то же
                // склонение, что уже используется в тексте подтверждения покупки ниже).
                // 20.10.2026 (по прямому указанию — "почему тогда в фотошопе этот шрифт
                // ровный?"): в Photoshop буквы ровные, в игре — нет, значит дело не в дизайне
                // шрифта (предыдущий вывод был неверным), а в самом растеризаторе. PIXI.Text
                // печёт canvas-текстуру ОДИН раз при создании с плотностью PIXI.settings.
                // RESOLUTION, а затем GPU растягивает её под фактический renderer.resolution —
                // если они хоть немного расходятся (нецелый масштаб), антиалиасинг каждого
                // глифа округляется к пикселям НЕЗАВИСИМО (круглые буквы типа О/С теряют/
                // получают лишний суб-пиксель иначе, чем угловатые Г/Л), и после растяжения это
                // проявляется как "буквы разного размера" — тот же класс бага, что системные
                // фиксы 17-19.10/20.10 (resolution-синхронизация, document.fonts.ready) должны
                // были покрыть, но на практике не покрыли именно для этого попапа. Фикс —
                // не полагаться на общий PIXI.settings.RESOLUTION вообще, а задать
                // ФИКСИРОВАННУЮ высокую плотность растеризации прямо на объекте (стандартный
                // приём PixiJS для мелкого текста) — текст печётся резким сразу, независимо от
                // текущего реального масштаба экрана.
                // 28.10.2026 (по прямому указанию — "если цифра выходит за 1000, пиши не 1000
                // а 1К, аналогично миллиону — 1КК"): formatAchNum(count, true) сокращает
                // ТОЛЬКО отображаемое число, def.unitWord(count) по-прежнему считает
                // склонение ("сухарей"/"сухаря") от РЕАЛЬНОГО count — склонение не должно
                // зависеть от того, как число сократили на экране.
                const countTxt = new PIXI.Text(formatAchNum(count, true) + ' ' + def.unitWord(count), TXT_STYLE_COUNT);
                countTxt.resolution = 4;
                countTxt.anchor.set(0.5, 0);
                countTxt.x = slot.x + SLOT_W / 2; countTxt.y = slot.y + 25;
                gridCont.addChild(countTxt);

                const price = isOk() ? info['price_ok'][i] : info['price'][i] / 7;
                const priceTxt = new PIXI.Text(price + ' ' + helper.numberEnd(price, 'votes'), TXT_STYLE_PRICE);
                priceTxt.resolution = 4;
                priceTxt.anchor.set(0.5, 1);
                priceTxt.x = slot.x + SLOT_W / 2; priceTxt.y = slot.y + 170;
                gridCont.addChild(priceTxt);

                slot.on('pointerdown', () => {
                    const itemNum = itemBase[key] + i;
                    console.log('[iface._openCurrencyPurchasePopup] клик по тарифу | tab:', key, '| i:', i, '| сумма:', count, '| item:', itemNum, '| цена:', price);
                    if(window.bank) bank.set_donut = itemNum;
                    startPurchase('item' + itemNum, price, count + ' ' + def.unitWord(count));
                });
            });
        };

        _switchTab(startKey);

        root.layer2_mc.addChild(win);
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        this._currPurchWin = win;
    };

    proto._closeCurrencyPurchasePopup = function(){
        if(this._currPurchWin && this._currPurchWin.parent) this._currPurchWin.parent.removeChild(this._currPurchWin);
        this._currPurchWin = null;
    };
}
