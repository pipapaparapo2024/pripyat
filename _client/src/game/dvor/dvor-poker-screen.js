/** Покер — построение экрана и обновление UI карт/уровня. */
import { getTrimmedCardTexture } from './dvor-poker-card-trim.js';

// 25.09.2026 (по прямому указанию, редактор позиций): единый масштаб карт покера — общий для
// плейсхолдера при построении экрана (_buildPokerScreen) и для реально раздаваемых карт
// (_updatePokerCardVisual.applySize) — раньше второе место жило отдельным форсированным
// боксом 80×127, из-за чего два места было легко рассинхронизировать.
const CARD_SCALE = 1.036;
// 26.09.2026 (по прямому указанию — "чтобы обрезались прозрачные отступы по сторонам и была
// фиксированная высота 140 и ширина 86"): единый scale (CARD_SCALE) применённый к ТРИМНУТОЙ
// (обрезанной по содержимому, см. dvor-poker-card-trim.js) текстуре всё ещё давал РАЗНЫЙ
// итоговый spr.width/height по картам — у каждой карты своя обрезанная bbox (разное
// соотношение сторон после обрезки каймы), поэтому один и тот же множитель масштаба даёт
// разный пиксельный размер. CARD_W/CARD_H — фиксированный бокс, применяется через
// spr.width/spr.height (независимое растяжение по каждой оси до точного размера),
// а не через scale.set() — гарантирует одинаковый 86×140 для абсолютно любой карты.
const CARD_W = 86, CARD_H = 140;

export function attachPokerScreen(proto){

    proto._buildPokerScreen = function(){
        this._pokerState = 0;
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 19.09.2026: файл меньше канваса (1016×532 против 1280×720) — по краям, где
        // фона нет, раньше просвечивал предыдущий экран. Полноэкранное затемнение
        // (тот же стиль 0x000000/0.6, что у остальных попапов проекта — notifications.js,
        // skills.js, level_up.js, reward.js, yashik.js) закрывает эти края.
        const darkBg = new PIXI.Graphics();
        darkBg.beginFill(0x000000, 0.6);
        darkBg.drawRect(0, 0, 1280, 720);
        darkBg.endFill();
        win.addChild(darkBg);

        // По прямому указанию все файлы вставляются в НАТИВНОМ размере, без растяжения под
        // произвольный размер экрана (никаких width/height) — позиция снята через редактор.
        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/poker_screen.png'));
        bg.x = 157; bg.y = 72;
        win.addChild(bg);

        // Подсветка строки в напечатанной на фоне "ТАБЛИЦЕ КОМБИНАЦИЙ" (справа) — вместо
        // текстового попапа с наградой (см. _pokerShowComboHighlight). Координаты строк —
        // приблизительные (сняты по скриншоту фона), поправить точно через редактор позиций.
        const comboHighlight = new PIXI.Graphics();
        comboHighlight.visible = false;
        // Разрешаем универсальному редактору позиций хватать и двигать эту рамку —
        // обычно он видит только Sprite/Text, для произвольной Graphics нужен явный флаг.
        comboHighlight._uDraggable = true;
        win.addChild(comboHighlight);
        this._pokerComboHighlight = comboHighlight;

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 90;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closePokerScreen());
        win.addChild(exitBtn);

        const levelTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        // 25.09.2026 (по прямому указанию, редактор позиций — новый бокс x:439 y:98 w:58 h:27,
        // было x:434 y:97 w:51 h:29): уровень покера центрирован по горизонтали внутри блока.
        window._centerTextIn(levelTxt, {x:439, y:98, w:58, h:27});
        win.addChild(levelTxt);
        this._pokerLevelTxt = levelTxt;

        // 04.10.2026 (по прямому указанию — "полоску опыта... стоит опустить вниз на пару
        // пикселей"): вся шкала (фон + заливка + маска в _updatePokerUI) сдвинута на +2px.
        const barBg = new PIXI.Graphics();
        barBg.beginFill(0x333333, 0.85);
        barBg.drawRoundedRect(510, 118, 162, 10, 2);
        barBg.endFill();
        win.addChild(barBg);

        // 04.10.2026 (по прямому указанию, новый файл "заливка желтыя уровень покера.png",
        // нативный размер 163×9) — тот же паттерн "текстура + растущая маска", что уже
        // используется для шкалы уровня зариков (см. dvor-dice-screen.js/dvor-dice.js) и
        // блэкджека: раньше заливка была плоским Graphics-прямоугольником (0xbd7101), теперь —
        // текстурный спрайт, раскрытый маской слева направо на долю прогресса.
        const barFillImg = new PIXI.Sprite(PIXI.Texture.from('./images/заливка желтыя уровень покера.png'));
        barFillImg.x = 511; barFillImg.y = 115;
        win.addChild(barFillImg);
        this._pokerExpBarFillImg = barFillImg;

        // 04.10.2026 (баг найден по прямому указанию — "полоску опыта перекрывает что-то"):
        // barFill используется ТОЛЬКО как маска для barFillImg, но без renderable=false
        // Graphics сама по себе тоже рисуется (белая заливка из _updateUI ниже) поверх новой
        // текстуры — тот же паттерн уже учтён в dvor-dice-screen.js (_diceExpBarFill).
        const barFill = new PIXI.Graphics();
        barFill.renderable = false;
        win.addChild(barFill);
        barFillImg.mask = barFill;
        this._pokerExpBarFill = barFill;

        const expLbl = new PIXI.Text('0/1', {
            fontFamily:'Southbank LT', fontSize:16, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        expLbl.anchor.set(0.5, 0.5);
        expLbl.x = 595; expLbl.y = 105;
        win.addChild(expLbl);
        this._pokerExpLabelTxt = expLbl;

        const swapsTxt = new PIXI.Text('0/3', {
            fontFamily:'Southbank LT', fontSize:14, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        swapsTxt.x = 811; swapsTxt.y = 96;
        win.addChild(swapsTxt);
        this._pokerSwapsTxt = swapsTxt;

        // Замок (не достигнут) и галочка (достигнут) — РАЗНЫЕ спрайты с независимыми
        // координатами (не пытаться свести к одной позиции — расположение замка и
        // расположение галочки просто различаются по макету).
        // 24.09.2026 (по прямому указанию — "сдвинь эти файлы влево на 14px и вверх на 1px",
        // подтверждено скриншотом редактора позиций poker_20_level.png): и замки (lockX/Y), и
        // галочки "разрешено" (checkX/Y) сдвинуты одинаково — -14 по X, -1 по Y от прежних.
        // 25.09.2026 (по прямому указанию — новая позиция "покер разрешено.png" x:714,y:120,
        // scale:1.1, "аналогично поставить" для остальных): дан только один новый снимок
        // (для тира 20), но галочка "разрешено" — один и тот же файл в 3 экземплярах с общим
        // шагом между тирами (было 701/758/814, тот же шаг ~57px) — применён тот же +13x/+1y
        // сдвиг ко ВСЕМ 3 галочкам, не только к первой (иначе тиры разъехались бы по-разному).
        // 26.09.2026 (по прямому указанию, новые координаты редактора позиций): lockX/Y
        // уточнены ещё раз (scale не менялся — новые значения совпадают с прежними lockScale
        // 1-в-1, значит правка только по позиции). checkX/Y (галочка "разрешено") не трогаем —
        // новых координат для неё в этот раз не присылали.
        const LVL_DATA = [
            { img:'poker_20_level',  thr:20,  lockX:707, lockY:117, lockScale:0.981, checkX:714, checkY:120 },
            { img:'poker_60_level',  thr:60,  lockX:765, lockY:117, lockScale:0.975, checkX:771, checkY:120 },
            { img:'poker_100_level', thr:100, lockX:821, lockY:117, lockScale:1.000, checkX:827, checkY:120 },
        ];
        this._pokerLvlIcons = [];
        for(let li = 0; li < 3; li++){
            const cfg = LVL_DATA[li];

            const lockSpr = new PIXI.Sprite(PIXI.Texture.from('./images/' + cfg.img + '.png'));
            lockSpr.x = cfg.lockX; lockSpr.y = cfg.lockY;
            lockSpr.scale.set(cfg.lockScale);
            win.addChild(lockSpr);

            const checkSpr = new PIXI.Sprite(PIXI.Texture.from('./images/poker_razresheno.png'));
            checkSpr.x = cfg.checkX; checkSpr.y = cfg.checkY;
            checkSpr.scale.set(1.1);
            checkSpr.visible = false;
            win.addChild(checkSpr);

            this._pokerLvlIcons.push({ lockSpr, checkSpr, threshold:cfg.thr });
        }

        const ST  = { fontFamily:'Southbank LT', fontSize:20, fill:'#ffcc44', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1 };
        const ST2 = { ...ST, fill:'#88ccff' };
        const ST3 = { ...ST, fill:'#ffffff', fontSize:17 };
        const SX  = 175;

        const chipsTxt = new PIXI.Text('0', ST);
        chipsTxt.anchor.set(0.5, 0.5);
        chipsTxt.x = SX + 158; chipsTxt.y = 374;
        win.addChild(chipsTxt);
        this._pokerChipsTxt = chipsTxt;

        const spichkiTxt = new PIXI.Text('0', ST2);
        spichkiTxt.anchor.set(0.5, 0.5);
        spichkiTxt.x = SX + 158; spichkiTxt.y = 418;
        win.addChild(spichkiTxt);
        this._pokerSpichkiTxt = spichkiTxt;

        const triesTxt = new PIXI.Text('0/25', ST3);
        triesTxt.anchor.set(0.5, 0.5);
        triesTxt.x = SX + 86; triesTxt.y = 480;
        win.addChild(triesTxt);
        this._pokerTriesTxt = triesTxt;

        // 25.09.2026 (по прямому указанию, редактор позиций — "новые характеристики для
        // карточек в покере, они все должны быть такого размера"): карты переведены с
        // форсированного box (width/height, одинаковый для всех мастей/рангов независимо от
        // их фактических пропорций после обрезки) на единый scale:1.036 — тот же приём, что
        // у любого другого элемента в этой сессии, снятого редактором позиций. Позиция снята
        // для карты слота 0 (x:369, y:288 — было 383,290); слоты 1-4 сохраняют прежний X-шаг
        // между собой, Y общий для всей строки (все карты лежат на одной линии). CARD_SCALE —
        // общая константа модуля (см. верх файла), используется и здесь, и в applySize() ниже.
        // 25.09.2026 (по прямому указанию, редактор позиций — 5 координат по слотам 1-5):
        // x:[370,459,547,635,724] (было [369,467,551,635,719]), y:286 для всех (было 288).
        const CARD_XS = [370, 459, 547, 635, 724];
        const CARD_YS = [286, 286, 286, 286, 286];

        this._pokerCardSprites = [];
        this._pokerSuitTexts   = [];
        this._pokerCardBorders = [];
        this._pokerSwapBtns    = [];

        const SWAP_XS  = [415, 502, 587, 679, 767];
        for(let i = 0; i < 5; i++){
            const cx = CARD_XS[i];
            const cy = CARD_YS[i];

            const cardSpr = new PIXI.Sprite(PIXI.Texture.from('./images/семерка.png?v=221'));
            cardSpr.scale.set(CARD_SCALE);
            cardSpr.x = cx; cardSpr.y = cy;
            cardSpr._pokerBaseY = cardSpr.y;
            cardSpr.visible = false;
            win.addChild(cardSpr);
            this._pokerCardSprites.push(cardSpr);

            const border = new PIXI.Graphics();
            border.lineStyle(3, 0xffff00);
            border.drawRect(cx - 2, cy - 2, cardSpr.width + 4, cardSpr.height + 4);
            border.visible = false;
            win.addChild(border);
            this._pokerCardBorders.push(border);

            const suitTxt = new PIXI.Text('', {
                fontFamily:'Arial', fontSize:26, fill:'#111111', fontWeight:'bold'
            });
            suitTxt.anchor.set(0.5, 0);
            suitTxt.x = cx + cardSpr.width / 2; suitTxt.y = cy + 6;
            suitTxt.visible = false;
            win.addChild(suitTxt);
            this._pokerSuitTexts.push(suitTxt);

            const swapBtn = new PIXI.Sprite(PIXI.Texture.from('./images/smenit_passiv.png'));
            swapBtn.scale.set(1.096);
            swapBtn.anchor.set(0.5, 0);
            swapBtn.x = SWAP_XS[i]; swapBtn.y = 427;
            swapBtn.interactive = false; swapBtn.buttonMode = false;
            swapBtn.visible = true;
            const _si = i;
            swapBtn.on('pointerdown', ()=>this._togglePokerSwap(_si));
            win.addChild(swapBtn);
            this._pokerSwapBtns.push(swapBtn);
        }

        // Больше НЕ добавляется в win — выигрыш уже показывает подсветка строки в
        // таблице комбинаций (_pokerShowComboHighlight), текст дублировал её. Сам
        // объект оставлен headless: хранит строку результата для тоста в
        // _playPokerNewScreen (когда игрок жмёт ИГРАТЬ заново, не подтвердив раздачу).
        const resultTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ffdd44',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2
        });
        this._pokerResultTxt = resultTxt;

        const play1 = new PIXI.Sprite(PIXI.Texture.from('./images/igrat_1.png'));
        play1.anchor.set(0.5, 0);
        play1.x = 496; play1.y = 492;
        play1.interactive = true; play1.buttonMode = true;
        play1.on('pointerover', ()=>{ _sa(play1, 0.85); play1.scale.set(1.08); });
        play1.on('pointerout', ()=>{ _sa(play1, 1); play1.scale.set(1); });
        play1.on('pointerdown', ()=>this._playPokerNewScreen(true));
        win.addChild(play1);
        this._pokerPlayBtn1 = play1;

        const play5 = new PIXI.Sprite(PIXI.Texture.from('./images/igrat_5.png'));
        play5.anchor.set(0.5, 0);
        play5.x = 692; play5.y = 492;
        play5.interactive = true; play5.buttonMode = true;
        play5.on('pointerover', ()=>{ _sa(play5, 0.85); play5.scale.set(1.08); });
        play5.on('pointerout', ()=>{ _sa(play5, 1); play5.scale.set(1); });
        play5.on('pointerdown', ()=>this._playPokerNewScreen(false));
        win.addChild(play5);
        this._pokerPlayBtn5 = play5;

        // 25.09.2026 (по прямому указанию — новая тема кнопок "вскрытия" для азартных игр):
        // текстовая кнопка-Graphics "СЫГРАТЬ" заменена на новый арт-файл
        // "кнопка вскрыться для игр.png", позиция снята редактором позиций (x:491, y:478).
        const confirmGfx = new PIXI.Sprite(PIXI.Texture.from('./images/кнопка вскрыться для игр.png'));
        confirmGfx.anchor.set(0.5, 0.5);
        confirmGfx.x = 584; confirmGfx.y = 512; // 25.09.2026: снято заново через редактор позиций (было 491,478)
        confirmGfx.interactive = true; confirmGfx.buttonMode = true;
        confirmGfx.visible = false;
        confirmGfx.on('pointerover', ()=>{ _sa(confirmGfx, 0.85); confirmGfx.scale.set(1.08); });
        confirmGfx.on('pointerout',  ()=>{ _sa(confirmGfx, 1); confirmGfx.scale.set(1); });
        confirmGfx.on('pointerdown', ()=>this._pokerConfirmNewScreen());
        win.addChild(confirmGfx);
        this._pokerDealBtn = confirmGfx;

        const bagBtn = new PIXI.Sprite(PIXI.Texture.from('./images/otkryt_sumku.png'));
        bagBtn.anchor.set(0.5, 0);
        bagBtn.x = 882; bagBtn.y = 509;
        bagBtn.interactive = true; bagBtn.buttonMode = true;
        bagBtn.on('pointerover', ()=>{ _sa(bagBtn, 0.85); bagBtn.scale.set(1.08); });
        bagBtn.on('pointerout', ()=>{ _sa(bagBtn, 1); bagBtn.scale.set(1); });
        bagBtn.on('pointerdown', ()=>this._openPokerBagScreen());
        win.addChild(bagBtn);

        this._pokerWin = win;
    };

    proto._updatePokerCardVisual = function(idx){
        const card = this._pokerHand ? this._pokerHand[idx] : null;
        if(card){
            const spr    = this._pokerCardSprites[idx];
            const border = this._pokerCardBorders[idx];
            const tex = PIXI.Texture.from(this._getCardImgPath(card.rank, card.suit));
            // Каждый вызов метит спрайт своим "поколением" — если пока обрезка карты
            // считалась асинхронно, эта же карта успела смениться (быстрый повторный
            // swap), коллбэк ниже увидит несовпадение и не применит устаревший результат.
            const myGen = (spr._pokerGen = (spr._pokerGen || 0) + 1);

            // 25.09.2026 (по прямому указанию, редактор позиций — "они все должны быть такого
            // размера"): единый scale:1.036 вместо форсированного бокса 80×127 — та же
            // константа CARD_SCALE, что и у плейсхолдера в _buildPokerScreen().
            const applySize = () => {
                if(spr._pokerGen !== myGen) return;
                spr.width = CARD_W; spr.height = CARD_H;
                spr.y = spr._pokerBaseY;
                if(border){
                    border.clear();
                    border.lineStyle(3, 0xffff00);
                    border.drawRect(spr.x - 2, spr.y - 2, spr.width + 4, spr.height + 4);
                }
                console.log('[dvor-poker-screen._updatePokerCardVisual] idx='+idx, card.rank, card.suit,
                    '| ИТОГО spr.width='+spr.width.toFixed(2)+' spr.height='+spr.height.toFixed(2)+' spr.y='+spr.y);
            };

            // 1) Best-effort сразу — чтобы карта не была пустой, пока считается обрезка
            //    (сама текстура может ещё не быть загружена, но width/height от неё
            //    пересчитаются автоматически PixiJS-ом, когда картинка подгрузится).
            spr.texture = tex;
            applySize();

            // 2) Обрезаем поля/кайму по фактическому содержимому картинки (см.
            //    dvor-poker-card-trim.js) — разные исходники карт по-разному экспортированы
            //    (у одних рисунок залит от края до края, у других есть полупрозрачная кайма),
            //    из-за чего при одинаковом боксе 80×127 видимая часть карты казалась разного
            //    размера. Как только обрезанная текстура готова — переключаемся на неё.
            getTrimmedCardTexture(tex, (trimmedTex) => {
                if(spr._pokerGen !== myGen) return; // карта сменилась, пока считали обрезку
                spr.texture = trimmedTex;
                applySize();
            });

            if(this._pokerSuitTexts[idx]) this._pokerSuitTexts[idx].visible = false;
        }
        if(this._pokerCardBorders[idx]) this._pokerCardBorders[idx].visible = !!this._pokerSelected[idx];
    };

    // Y-центр каждой строки "ТАБЛИЦЫ КОМБИНАЦИЙ", напечатанной на poker_screen.png (справа).
    // Стрит — шестая строка таблицы. Его нельзя пропускать: тогда все комбинации ниже
    // флеша получают подсветку на строку выше своей награды.
    // Шаг между строками — 36px (считано через редактор позиций: "старшая карта" внизу →
    // выше на одну строку = -36px), не 38 как было раньше. База (royal_flush) — 172, не
    // 150: перепроверено по двум независимым замерам через редактор ("две пары" на
    // y:374, "старшая карта" на y:446 — обе совпадают ровно с базой 172 + шаг 36 и НЕ
    // совпадают с базой 150, которая была унаследована из старого кода и, похоже, сама
    // была неточной).
    // 26.09.2026 (по прямому указанию — точный замер редактором позиций по каждой из 10
    // строк отдельно, взамен формулы "база 160 + шаг 36 + офсет -53", которая давала лишь
    // приближение и уже дважды расходилась с реальной картинкой таблицы комбинаций).
    const COMBO_ROW_POS = {
        high_card:       { x: 1032, y: 431 },
        pair:            { x: 1032, y: 401 },
        two_pair:        { x: 1032, y: 369 },
        three_of_a_kind: { x: 1032, y: 338 },
        straight:        { x: 1032, y: 308 },
        flush:           { x: 1032, y: 277 },
        full_house:      { x: 1032, y: 241 },
        four_of_a_kind:  { x: 1032, y: 207 },
        straight_flush:  { x: 1032, y: 171 },
        royal_flush:     { x: 1032, y: 135 },
    };
    const COMBO_ROW_W = 257, COMBO_ROW_H = 37;

    proto._pokerShowComboHighlight = function(combo){
        const h = this._pokerComboHighlight;
        if(!h) return;
        const pos = COMBO_ROW_POS[combo];
        if(!pos){ h.visible = false; return; }
        // Позиция ставится в центр строки, а прямоугольник рисуется в ЛОКАЛЬНЫХ
        // координатах, центрированных на (0,0) — при pivot=0 (по умолчанию) это даёт
        // ровно ту же картинку, что и раньше (screen = local + position), но
        // PageUp/PageDown (масштаб через редактор) теперь сжимает/растит рамку
        // СИММЕТРИЧНО вокруг центра. (Предыдущая правка ошибочно ставила ЕЩЁ и pivot
        // в ту же точку — pivot и position взаимно гасили друг друга, и рамка рисовалась
        // у экранного (0,0) вместо стола — тем самым "подсветки не было видно" вообще.)
        h.position.set(pos.x, pos.y);
        h.clear();
        h.lineStyle(3, 0xffdd44, 1);
        h.beginFill(0xffdd44, 0.18);
        h.drawRoundedRect(-COMBO_ROW_W / 2, -COMBO_ROW_H / 2, COMBO_ROW_W, COMBO_ROW_H, 6);
        h.endFill();
        h.visible = true;
        h.alpha = 1;
        // Пока открыт универсальный редактор позиций — не прячем рамку по таймеру,
        // иначе её невозможно успеть выделить и перетащить мышкой.
        if(window.iface && iface._uEditOn) return;
        if(window.gsap){
            gsap.killTweensOf(h);
            gsap.timeline()
                .to(h, {alpha:0.35, duration:0.35, repeat:3, yoyo:true})
                .to(h, {alpha:0, duration:0.5, delay:1.2, onComplete:()=>{ h.visible = false; }});
        } else {
            setTimeout(()=>{ h.visible = false; }, 3000);
        }
    };

    proto._pokerUpdateCards = function(){
        for(let i = 0; i < 5; i++) this._updatePokerCardVisual(i);
    };

    proto._updatePokerSwapButtons = function(){
        const allowed = this._getPokerSwapsAllowed();
        const playing = this._pokerState === 1;
        const canSwap = playing && allowed > 0 && this._pokerSwapsLeft > 0;
        for(let i = 0; i < 5; i++){
            const btn = this._pokerSwapBtns[i];
            if(!btn) continue;
            btn.visible = true;
            if(canSwap){
                btn.interactive = true; btn.buttonMode = true;
                btn.texture = PIXI.Texture.from('./images/smenit_activ.png');
            } else {
                btn.interactive = false; btn.buttonMode = false;
                btn.texture = PIXI.Texture.from('./images/smenit_passiv.png');
            }
        }
        if(this._pokerSwapsTxt){
            this._pokerSwapsTxt.text = (this._pokerSwapsLeft || 0) + '/' + allowed;
        }
    };

    proto._updatePokerUI = function(){
        if(!this._data) return;
        const lvl = this._getLevelInfo('poker');
        if(this._pokerLevelTxt)    this._pokerLevelTxt.text    = String(lvl.level);
        if(this._pokerExpLabelTxt) this._pokerExpLabelTxt.text = lvl.maxed ? 'Опыт: МАКС' : 'Опыт: ' + lvl.cur + '/' + lvl.next;

        if(this._pokerExpBarFill){
            this._pokerExpBarFill.clear();
            const ratio = lvl.maxed ? 1 : (lvl.next > 0 ? Math.min(1, lvl.cur / lvl.next) : 0);
            // 163 — нативная ширина "заливка желтыя уровень покера.png" (см. build выше),
            // маска растёт от x:511 (позиция самой заливки), той же логики, что dice/blackjack.
            const fw = Math.max(0, Math.floor(163 * ratio));
            if(fw > 0){
                this._pokerExpBarFill.beginFill(0xffffff);
                this._pokerExpBarFill.drawRect(511, 115, fw, 9);
                this._pokerExpBarFill.endFill();
            }
            if(this._pokerExpBarFillImg) this._pokerExpBarFillImg.visible = fw > 0;
        }

        if(this._pokerLvlIcons){
            this._pokerLvlIcons.forEach(item => {
                const reached = lvl.level >= item.threshold;
                item.lockSpr.visible  = !reached;
                item.checkSpr.visible = reached;
            });
        }

        if(this._pokerChipsTxt)   this._pokerChipsTxt.text   = String(parseInt(udata['poker_chips']||0));
        // 27.09.2026 (баг "спички не выдаются за покер", по прямому указанию — расследование
        // показало, что сервер (poker.php.resolve()) честно начисляет poker_spichki при
        // каждом high_card/three_of_a_kind/straight, и код на 155.212.211.202 подтверждён
        // байт-в-байт идентичным этому файлу — награда реально попадает в БД). Настоящая
        // причина — здесь: счётчик "спички" на экране ПОКЕРА копипастой читал чужую валюту
        // roulette_spichki (спички РУЛЕТКИ, отдельное поле udata, см. CLAUDE.md "Поля udata")
        // вместо poker_spichki. Игрок никогда не видел, что счётчик растёт (он и не должен
        // расти от игры в рулетку), отсюда ощущение "спички вообще не начисляются".
        if(this._pokerSpichkiTxt) this._pokerSpichkiTxt.text = String(parseInt(udata['poker_spichki']||0));
        if(this._pokerTriesTxt)   this._pokerTriesTxt.text   = this._pokerUsed + '/25';

        const playing = this._pokerState === 1;
        if(this._pokerPlayBtn1) this._pokerPlayBtn1.visible = !playing;
        if(this._pokerPlayBtn5) this._pokerPlayBtn5.visible = !playing;
        if(this._pokerDealBtn)  this._pokerDealBtn.visible  = playing;
    };
}
