/** Магазин одежды — новый PIXI-экран. */

export function attachShmotShop(proto){

    proto._openShmotShop = function(){
        if(this._shopWin && this._shopWin.parent) this._shopWin.parent.removeChild(this._shopWin);
        this._buildShmotShop();
        root.layer2_mc.addChild(this._shopWin);
        // 29.09.2026 (репорт — "открыл магазин шмоток через боёвку с боссом→оружейку, нижний
        // ХУД пропал"): раньше здесь стоял просто iface.restoreHud() — экран НЕ заявлял свою
        // потребность в стек (interface.js.pushHud/popHud), поэтому restoreHud() применял
        // верхушку стека, оставшуюся от экрана НИЖЕ (bossFight с down:false, если магазин
        // шмоток открыт из-под боя с боссом через попап "нет оружия"→оружейку). Оружейка при
        // закрытии (openModule('shmot') → _closeAllPanels() → weapons.close()) корректно снимала
        // СВОЮ запись pushHud('weapons',{down:true}), обнажая bossFight — а магазин шмоток эту
        // обнажившуюся запись просто наследовал вместо того, чтобы заявить собственную (магазин
        // шмоток — обычный экран нижней панели, оба ХУДа видны по умолчанию).
        if(window.iface) iface.pushHud('shmot', {});
    };

    proto._buildShmotShop = function(){
        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;
        // 25.09.2026: this._shopWin проставляется СРАЗУ (было в самом конце функции) — нужен
        // уже во время первых двух вызовов _updateManSprites() ниже (условный z-order слота
        // cat:6 по id предмета), а не только по завершении сборки экрана.
        this._shopWin = win;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'магазин вещей.png'));
        bg.width = 1280; bg.height = 690; bg.y = 15;
        win.addChild(bg);

        // 24.09.2026 (по прямому указанию — "в пропущенных местах тоже замени на новый файл"):
        // та же замена, что и в home.js — pers.png -> "персонаж который сидит.png".
        const persSpr = new PIXI.Sprite(PIXI.Texture.from('./images/персонаж который сидит.png'));
        persSpr.anchor.set(0, 0);
        persSpr.x = 730; persSpr.y = 208;
        persSpr.width = 273; persSpr.height = 389;
        win.addChild(persSpr);

        // Спрайты одежды на манекене (координаты из PSD 1280×720).
        // cat 0 и cat 2: x — центр по горизонтали (шапки/штаны разного размера у разных
        // предметов, левый край давал разный визуальный сдвиг — центр даёт одинаковую посадку).
        // x пересчитан так, чтобы дефолтные предметы (голова_1.png, штаны_1.png) остались на месте.
        // Порядок в массиве = порядок addChild = z-index (позже добавлен → выше).
        // Обувь — самый нижний слой ног (штанина перекрывает голенище); Штаны — поверх Обуви;
        // Торс — поверх Штанов (подол майки/куртки визуально перекрывает пояс штанов).
        // 24.09.2026 (по прямому указанию — "голова выше торса по Z-индексу"): та же
        // перестановка, что и в home.js MAN_SLOTS/CLOTH_SLOTS.
        const MAN_SLOTS = [
            { cat: 3, x: 864, y: 591, centerX: true },  // Обувь — самый нижний слой ног
            { cat: 2, x: 893, y: 358, centerX: true },  // Штаны — выше Обуви
            { cat: 1, x: 804, y: 258 },                 // Торс — выше Штанов
            { cat: 0, x: 871, y: 195, centerX: true },  // Голова — выше Торса
            { cat: 4, x: 882, y: 414 },                 // Аксессуар
            { cat: 6, x: 856, y: 418 },                 // Рука
        ];
        // Фаланги правой руки — та же картинка, что на главном меню/базе, координаты
        // пересчитаны под манекен (тот же сдвиг +224/+4, что и во всех остальных
        // MAN_SLOTS относительно home.js: 634+224=858, 441+4=445).
        const rightHandPhalanxSpr = new PIXI.Sprite(PIXI.Texture.from('./images/фаланги правой руки.png'));
        rightHandPhalanxSpr.anchor.set(0, 0);
        rightHandPhalanxSpr.x = 858;
        rightHandPhalanxSpr.y = 445;
        this._manRightHandPhalanxSpr = rightHandPhalanxSpr;

        this._manSlots = {};
        this._manSlotBases = {};
        MAN_SLOTS.forEach(s => {
            if(s.cat === 6) win.addChild(rightHandPhalanxSpr);
            const spr = new PIXI.Sprite(PIXI.Texture.EMPTY);
            spr.anchor.set(s.centerX ? 0.5 : 0, s.cat === 3 ? 1 : 0);
            spr.x = s.x; spr.y = s.y;
            win.addChild(spr);
            this._manSlots[s.cat] = spr;
            this._manSlotBases[s.cat] = {x: s.x, y: s.y};
        });
        this._updateManSprites();

        // Левое предплечье (24.09.2026, уточнено пользователем через редактор позиций на
        // home.js — x:515 y:327 scale:0.197 при persSpr там в 506,204, т.е. смещение
        // +9x/+123y от персонажа) — persSpr здесь в (730,208), та же разница +224/+4, что
        // у остальных MAN_SLOTS относительно home.js: 739=730+9, 331=208+123.
        const leftForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левое предплечье.png'));
        leftForearmSpr.anchor.set(0, 0);
        leftForearmSpr.x = 738; leftForearmSpr.y = 328;
        leftForearmSpr.scale.set(0.197);
        win.addChild(leftForearmSpr);
        this._leftForearmSpr = leftForearmSpr;

        // Кисти рук персонажа — рисуются ПОСЛЕ одежды (торс/штаны/обувь/голова/аксессуар),
        // чтобы быть поверх неё
        const rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/правая рука.png'));
        rightHandSpr.anchor.set(0, 0);
        rightHandSpr.x = 862 - 8; rightHandSpr.y = 373;
        win.addChild(rightHandSpr);
        this._manRightHandSpr = rightHandSpr;

        const leftHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левая рука.png'));
        leftHandSpr.anchor.set(0, 0);
        leftHandSpr.x = 756 + 2; leftHandSpr.y = 389;
        win.addChild(leftHandSpr);
        this._manLeftHandSpr = leftHandSpr;

        // 25.09.2026 (уточнение по прямому указанию — то же, что в home.js): прошлое правило
        // "предмет в руке ВСЕГДА выше кистей" оказалось верно только для часов/цепи (надеты
        // НА руку) — остальные cat:6 предметы зажаты В руке и должны быть ПОД пальцами.
        // Позиционирование слота cat:6 теперь внутри _updateManSprites() (по id предмета) —
        // перевызываем её здесь же, теперь когда кисти/предплечье уже существуют.
        this._updateManSprites();

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>{
            win.visible = false;
            if(this._shopWheelHandler) document.querySelector('canvas').removeEventListener('wheel', this._shopWheelHandler);
            if(this._shopSwipeCleanup) this._shopSwipeCleanup();   // 28.09.2026: слушатели свайпа с корня сцены
            // 29.09.2026: popHud вместо ручного форсированного показа обоих ХУДов — снимает
            // СВОЮ запись из стека и восстанавливает требование экрана ПОД этим (если магазин
            // шмоток был открыт поверх боя с боссом — вернёт down:false боя, а не всегда true).
            if(window.iface) iface.popHud('shmot');
        });
        win.addChild(exitBtn);

        // 26.09.2026 (по прямому указанию, перед модерацией VK — MODERATION_HANDOFF_PROMPT.md,
        // критичная находка №2) — кнопки "🛠 РЕДАКТОР"/"📋 КОПИРОВАТЬ" (тумблер редактора
        // позиций шмоток на манекене) убраны из экрана магазина, без исключений. Сам
        // shmot_pos_editor.js НЕ удалён (по прямому указанию "не удаляй") — блок ниже можно
        // раскомментировать для локальной отладки позиций.
        //
        // const posBtnBg = new PIXI.Graphics();
        // posBtnBg.beginFill(0x1a1a3a, 0.85);
        // posBtnBg.lineStyle(1, 0x3ad4a4, 0.8);
        // posBtnBg.drawRoundedRect(0, 0, 150, 24, 4);
        // posBtnBg.endFill();
        // posBtnBg.x = 970; posBtnBg.y = 62;
        // posBtnBg.interactive = true; posBtnBg.buttonMode = true;
        // posBtnBg.on('pointerover', ()=>{ posBtnBg.alpha = 0.7; });
        // posBtnBg.on('pointerout',  ()=>{ posBtnBg.alpha = 1; });
        // posBtnBg.on('pointerdown', ()=>this._togglePosEditor());
        // const posBtnTxt = new PIXI.Text('🛠 РЕДАКТОР', {fontFamily:'Southbank LT', fontSize:12, fill:'#3af0c0'});
        // posBtnTxt.anchor.set(0.5, 0.5); posBtnTxt.x = 75; posBtnTxt.y = 12;
        // posBtnBg.addChild(posBtnTxt);
        // win.addChild(posBtnBg);
        // this._posEditorBtnTxt = posBtnTxt;
        //
        // const posCopyBtn = new PIXI.Graphics();
        // posCopyBtn.beginFill(0x1a3a1a, 0.85);
        // posCopyBtn.lineStyle(1, 0x50c050, 0.8);
        // posCopyBtn.drawRoundedRect(0, 0, 150, 24, 4);
        // posCopyBtn.endFill();
        // posCopyBtn.x = 970; posCopyBtn.y = 90;
        // posCopyBtn.interactive = true; posCopyBtn.buttonMode = true;
        // posCopyBtn.visible = false;
        // posCopyBtn.on('pointerover', ()=>{ posCopyBtn.alpha = 0.7; });
        // posCopyBtn.on('pointerout',  ()=>{ posCopyBtn.alpha = 1; });
        // posCopyBtn.on('pointerdown', ()=>this._copyPosEditorValues());
        // const posCopyTxt = new PIXI.Text('📋 КОПИРОВАТЬ', {fontFamily:'Southbank LT', fontSize:12, fill:'#80e080'});
        // posCopyTxt.anchor.set(0.5, 0.5); posCopyTxt.x = 75; posCopyTxt.y = 12;
        // posCopyBtn.addChild(posCopyTxt);
        // win.addChild(posCopyBtn);
        // this._posCopyBtn = posCopyBtn;

        // Категории
        const CATS = [
            { file: 'магазин вещей группа голова.png', cat: 0, y: 183 },
            { file: 'магазин вещей группа торс.png',   cat: 1, y: 268 },
            { file: 'магазин вещей группа ноги.png',   cat: 2, y: 352 },
            { file: 'магазин вещей группа обувь.png',  cat: 3, y: 437 },
            { file: 'магазин вещей группа руки.png',   cat: 6, x: 18, y: 514 },
        ];
        this._shopCat = 0;
        this._shopTab = 'all';

        CATS.forEach(c => {
            const spr = new PIXI.Sprite(PIXI.Texture.from(BASE + c.file));
            spr.anchor.set(0, 0.5);
            spr.x = c.x ?? 17; spr.y = c.y + 6;
            spr.interactive = true; spr.buttonMode = true;
            spr.on('pointerdown', ()=>{ this._shopCat = c.cat; this._shopRefresh(); });
            win.addChild(spr);
        });

        // Вкладки ВСЕ / МОИ / СЕТЫ
        const TABS = [
            { pass: 'магазин вещей все пассив.png',  actv: 'магазин вещей все актив.png',  x: 183, id: 'all'  },
            { pass: 'магазин вещей мои пассив.png',  actv: 'магазин вещей мои актив.png',  x: 260, id: 'mine' },
            { pass: 'магазин вещей сеты пассив.png', actv: 'магазин вещей сеты актив.png', x: 337, id: 'sets' },
        ];
        this._shopTabSprites = {};
        TABS.forEach(t => {
            const sprP = new PIXI.Sprite(PIXI.Texture.from(BASE + t.pass));
            const sprA = new PIXI.Sprite(PIXI.Texture.from(BASE + t.actv));
            sprP.x = sprA.x = t.x - 12;
            sprP.y = sprA.y = 154;
            sprA.visible = (t.id === 'all');
            sprP.visible = (t.id !== 'all');
            sprP.interactive = sprA.interactive = true;
            sprP.buttonMode = sprA.buttonMode = true;
            const onTab = () => {
                this._shopTab = t.id;
                TABS.forEach(tt => {
                    this._shopTabSprites[tt.id].p.visible = (tt.id !== t.id);
                    this._shopTabSprites[tt.id].a.visible = (tt.id === t.id);
                });
                this._shopRefresh();
            };
            sprP.on('pointerdown', onTab);
            sprA.on('pointerdown', onTab);
            win.addChild(sprP, sprA);
            this._shopTabSprites[t.id] = { p: sprP, a: sprA };
        });

        // Сетка предметов
        const GRID = { x: 178, y: 217, cellW: 145, cellH: 160, gap: 12, cols: 3, visH: 355 };
        this._shopGrid = GRID;

        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff);
        mask.drawRect(GRID.x, GRID.y, GRID.cols * GRID.cellW + (GRID.cols - 1) * GRID.gap, GRID.visH);
        mask.endFill();
        win.addChild(mask);

        const cont = new PIXI.Container();
        cont.x = GRID.x;
        cont.y = GRID.y;
        cont.mask = mask;
        win.addChild(cont);
        this._shopCont = cont;

        // Скролл
        const scrollTrack = new PIXI.Sprite(PIXI.Texture.from(BASE + 'магазин вещей скролл.png'));
        scrollTrack.x = 529; scrollTrack.y = 139;
        win.addChild(scrollTrack);

        const scrollThumb = new PIXI.Sprite(PIXI.Texture.from(BASE + 'магазин вещей бегунок.png'));
        scrollThumb.x = 645; scrollThumb.y = 239;
        scrollThumb.interactive = true; scrollThumb.buttonMode = true;
        win.addChild(scrollThumb);
        this._shopThumb = scrollThumb;
        this._shopScrollY = 0;

        const TRACK_TOP = 239, TRACK_BOT = 555;
        let drag = false, dragY0 = 0, thumbY0 = 0;
        scrollThumb.on('pointerdown', e => {
            drag = true; dragY0 = e.data.global.y; thumbY0 = scrollThumb.y;
            win.on('pointermove', onMove); win.on('pointerup', onUp); win.on('pointerupoutside', onUp);
        });
        const onMove = e => {
            if(!drag) return;
            const THUMB_H = scrollThumb.height;
            const ny = Math.max(TRACK_TOP, Math.min(TRACK_BOT - THUMB_H, thumbY0 + (e.data.global.y - dragY0)));
            scrollThumb.y = ny;
            this._shopScrollRatio = (ny - TRACK_TOP) / Math.max(1, TRACK_BOT - THUMB_H - TRACK_TOP);
            this._applyShopScroll();
        };
        const onUp = () => {
            drag = false;
            win.off('pointermove', onMove); win.off('pointerup', onUp); win.off('pointerupoutside', onUp);
        };

        this._shopScrollRatio = 0;
        this._shopWheelHandler = e => {
            if(!win.visible) return;
            this._shopScrollRatio = Math.max(0, Math.min(1, this._shopScrollRatio + e.deltaY * 0.002));
            this._applyShopScroll();
            this._updateShopThumb(TRACK_TOP, TRACK_BOT);
        };
        document.querySelector('canvas').addEventListener('wheel', this._shopWheelHandler, { passive: true });

        // 28.09.2026 (адаптив под мобильные): свайп-прокрутка сетки предметов пальцем. Тот же
        // приём, что в svod-scroll.js (эталон, рецепт записан в CLAUDE.md), с одним отличием:
        // здесь НЕ нужна отдельная drag-поверхность. У этого экрана первым ребёнком win лежит
        // полноэкранный интерактивный blocker (1280×720), он и так перехватывает нажатия в
        // любой пустой точке, а win.interactive=true — значит событие всё равно доходит сюда
        // всплытием. Вместо поверхности — прямая проверка, что палец опустился ВНУТРИ сетки:
        // иначе протяжка запускалась бы и с кнопок категорий, и с манекена слева.
        //
        // Прокрутка магазина считается не в пикселях, а в доле 0..1 (_shopScrollRatio), поэтому
        // смещение пальца делится на maxScroll — так палец и сетка едут с одинаковой скоростью.
        if(window.isMobile){
            const GRID_W = GRID.cols * GRID.cellW + (GRID.cols - 1) * GRID.gap;
            let swipe = false, swipeY0 = 0, swipeRatio0 = 0;
            const _maxScroll = () => Math.max(0, (this._shopTotalH || 0) - GRID.visH);

            const onSwipeStart = (e) => {
                if(!win.visible || _maxScroll() <= 0) return;
                // Бегунок тащат отдельным обработчиком выше — его нажатие тоже всплывает сюда.
                if(e.target === scrollThumb) return;
                const p = win.toLocal(e.data.global);
                if(p.x < GRID.x || p.x > GRID.x + GRID_W || p.y < GRID.y || p.y > GRID.y + GRID.visH) return;
                swipe = true; swipeY0 = e.data.global.y; swipeRatio0 = this._shopScrollRatio;
            };
            const onSwipeMove = (e) => {
                if(!swipe) return;
                const delta = (e.data.global.y - swipeY0) / Math.max(1, _maxScroll());
                this._shopScrollRatio = Math.max(0, Math.min(1, swipeRatio0 - delta));
                this._applyShopScroll();
                this._updateShopThumb(TRACK_TOP, TRACK_BOT);
            };
            const onSwipeEnd = () => { swipe = false; };

            win.on('pointerdown', onSwipeStart);
            // move/up — на корне сцены: палец во время протяжки уезжает за пределы ячейки.
            if(window.root){
                root.on('pointermove',      onSwipeMove);
                root.on('pointerup',        onSwipeEnd);
                root.on('pointerupoutside', onSwipeEnd);
            }
            // Снимается вместе с wheel-обработчиком при выходе с экрана (см. кнопку выхода) —
            // иначе слушатели корня переживут закрытие магазина и будут дёргать его скролл при
            // каждом движении пальца на любом другом экране игры.
            this._shopSwipeCleanup = () => {
                if(!window.root) return;
                root.off('pointermove',      onSwipeMove);
                root.off('pointerup',        onSwipeEnd);
                root.off('pointerupoutside', onSwipeEnd);
            };
        }

        // 25.09.2026 (по прямому указанию, референс-скриншот похожей игры — "Кофта
        // Лабрадора"): тултип переделан из тёмного однострочного блока в светлую карточку с
        // подписанными полями (Бонус/Сет/Требования), как в примере. Живёт прямо в win (не в
        // скроллируемом cont), чтобы не резаться маской сетки. Пользователь явно уточнил не
        // выдумывать поля, которых у нас нет ("Авторитет" из референса не наш — просто
        // конкретная инфа, которая реально есть: бонус/сет/источник или цена).
        const shopTipCard = new PIXI.Container();
        shopTipCard.visible = false;
        win.addChild(shopTipCard);
        this._shopTipCard = shopTipCard;

        this._shopTrack = { top: TRACK_TOP, bot: TRACK_BOT };
        this._shopRefresh();
    };

    // 25.09.2026: сколько предметов из указанного сета уже получено игроком / всего в сете —
    // для строки "Сет: Хули-Дог (1/1)" в карточке тултипа.
    proto._setProgress = function(setName){
        const items = (this.items || []).filter(i => i.set === setName);
        const total = items.length;
        const have  = items.filter(i => i.owned).length;
        return { have, total };
    };

    // 25.09.2026 (по прямому указанию, референс-скриншот — "Кофта Лабрадора"): светлая
    // карточка-тултип с подписанными полями вместо старого однострочного тёмного блока.
    // Реальные данные, которые у нас есть (Авторитет из референса намеренно не показываем —
    // такого бонуса у наших вещей нет, пользователь явно попросил не выдумывать поля):
    //   Название (заголовок) → Бонус: ... → Сет: имя (have/total) → пунктир → Требования:
    //   (цена, если продаётся, иначе источник дропа + прогресс фрагментов, если не собран).
    proto._showShopTip = function(frame, item){
        if(!this._shopTipCard || !this._shopWin) return;
        const card = this._shopTipCard;
        while(card.children.length) card.removeChildAt(0);

        const PAD = 12;
        const CONTENT_W = 250;
        const titleStyle = { fontFamily:'Southbank LT', fontSize:17, fontWeight:'bold', fill:'#ac3b26',
            wordWrap:true, wordWrapWidth:CONTENT_W };
        const lblStyle   = { fontFamily:'Southbank LT', fontSize:14, fontWeight:'bold', fill:'#2a2118' };
        const valStyle   = { fontFamily:'Southbank LT', fontSize:14, fill:'#ac5238' };

        let y = PAD;
        const title = new PIXI.Text(item.name, titleStyle);
        title.x = PAD; title.y = y;
        card.addChild(title);
        y += title.height + 8;

        const bonusLbl = new PIXI.Text('Бонус: ', lblStyle);
        bonusLbl.x = PAD; bonusLbl.y = y;
        card.addChild(bonusLbl);
        const bonusVal = new PIXI.Text(item.bonus || 'нет бонуса',
            Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - bonusLbl.width }));
        bonusVal.x = PAD + bonusLbl.width; bonusVal.y = y;
        card.addChild(bonusVal);
        y += Math.max(bonusLbl.height, bonusVal.height) + 6;

        if(item.set){
            const setLbl = new PIXI.Text('Сет: ', lblStyle);
            setLbl.x = PAD; setLbl.y = y;
            card.addChild(setLbl);
            const prog = this._setProgress(item.set);
            const setVal = new PIXI.Text(item.set + ' (' + prog.have + '/' + prog.total + ')',
                Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - setLbl.width }));
            setVal.x = PAD + setLbl.width; setVal.y = y;
            card.addChild(setVal);
            y += Math.max(setLbl.height, setVal.height) + 10;
        }

        // Пунктирная линия-разделитель (PIXI не умеет dashed lineStyle нативно — рисуем сами).
        const sep = new PIXI.Graphics();
        sep.lineStyle(1, 0x9c8770, 0.9);
        const DASH = 5, GAP = 4, sepY = y;
        for(let dx = 0; dx < CONTENT_W; dx += DASH + GAP){
            sep.moveTo(PAD + dx, sepY);
            sep.lineTo(Math.min(PAD + dx + DASH, PAD + CONTENT_W), sepY);
        }
        card.addChild(sep);
        y += 10;

        const reqLbl = new PIXI.Text('Требования:', lblStyle);
        reqLbl.x = PAD; reqLbl.y = y;
        card.addChild(reqLbl);
        y += reqLbl.height + 4;

        let reqText;
        if(item.price){
            const unit = {coins:'монет', stew:'тушёнки', cig:'сигарет'}[item.price.type] || '';
            reqText = 'Цена: ' + item.price.a + ' ' + unit;
        } else {
            reqText = item.source || '?';
            // 22.09.2026 (дроп персональных вещей боссов, по прямому указанию) — для предметов
            // с фрагментной сборкой показываем реальный накопленный прогресс
            // (this.fragmentsProgress, см. shmot.js._loadFromUdata), а не голый текст источника.
            if(item.fragments && !item.owned){
                const have = (this.fragmentsProgress && this.fragmentsProgress[item.id]) || 0;
                reqText += '\nСобрано частей: ' + have + '/' + item.fragments;
            }
        }
        const INDENT = 14;
        const reqVal = new PIXI.Text(reqText,
            Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - INDENT }));
        reqVal.x = PAD + INDENT; reqVal.y = y;
        card.addChild(reqVal);
        y += reqVal.height;

        const totalW = CONTENT_W + PAD * 2;
        const totalH = y + PAD;
        const bg = new PIXI.Graphics();
        bg.beginFill(0xfbeee0, 0.97);
        bg.lineStyle(2, 0xc79a72, 1);
        bg.drawRoundedRect(0, 0, totalW, totalH, 8);
        bg.endFill();
        card.addChildAt(bg, 0);

        // frame.x/y — координаты в системе cont (скроллируемый контейнер), переводим в глобальные,
        // а из них — в локальные для win, где и лежит тултип (чтобы не резался маской сетки).
        // 25.09.2026 (по прямому указанию — "окошко описания делай не сверху, а справа"): якорь
        // перенесён с верхнего края ячейки (центр по X) на правый край ячейки (центр по Y) —
        // карточка теперь появляется справа от предмета, а не над ним.
        const { cellW, cellH } = this._shopGrid;
        const MARGIN = 8;
        const g = frame.parent.toGlobal(new PIXI.Point(frame.x + cellW, frame.y + cellH / 2));
        const local = this._shopWin.toLocal(g);
        card.x = local.x + MARGIN;
        card.y = local.y - totalH / 2;
        card.visible = true;
    };

    proto._hideShopTip = function(){
        if(this._shopTipCard) this._shopTipCard.visible = false;
    };

    proto._shopRefresh = function(preserveScroll = false){
        const cont = this._shopCont;
        if(!cont) return;
        this._hideShopTip(); // карточки под курсором пересоздаются — старый тултип может зависнуть
        while(cont.children.length) cont.removeChildAt(0);

        const { cellW, cellH, gap, cols } = this._shopGrid;
        let items = (this.items || []).filter(i => i.cat === this._shopCat);
        if(this._shopTab === 'mine') items = items.filter(i => i.owned);

        const MIN_CELLS = 6;
        const padded = items.slice();
        while(padded.length < MIN_CELLS) padded.push(null);
        padded.forEach((item, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const cx = col * (cellW + gap);
            const cy = row * (cellH + gap);

            const frame = new PIXI.Sprite(PIXI.Texture.from('./images/магазин вещей рамка.png'));
            frame.x = cx; frame.y = cy;
            frame.width = cellW; frame.height = cellH;
            if(item){
                frame.interactive = true; frame.buttonMode = true;
                // 28.09.2026 (адаптив под мобильные): было frame.on('pointerdown', ...) —
                // предмет открывался в момент КАСАНИЯ, поэтому свайп по сетке гарантированно
                // открывал карточку той вещи, с которой начался. helper.onTap срабатывает на
                // отпускании и только если палец не уехал дальше 10px.
                helper.onTap(frame, ()=> this._onShmotClick(item));
                frame.on('pointerover', ()=> this._showShopTip(frame, item));
                frame.on('pointerout',  ()=> this._hideShopTip());
            }
            cont.addChild(frame);

            if(item && item.imgFile){
                const imgUrl = './images/shmot/' + item.imgFile;
                const imgTex = PIXI.Texture.from(imgUrl);
                const img = new PIXI.Sprite(imgTex);
                img.anchor.set(0.5, 0.5);
                // 25.09.2026 (по прямому указанию, снято редактором позиций поверх ~58 предметов
                // боссовых сетов — "именно в ячейках") — раньше ВСЕ предметы центрировались в
                // ячейке одной и той же формулой (cx+77, cy+98) с авто-fit-масштабом (никогда не
                // увеличивал, только уменьшал слишком крупные картинки) — для разных пропорций
                // исходных файлов (шапки/футболки/шорты/обувь/предметы в руку) это выглядело
                // неаккуратно (не по центру, слишком мелко/крупно). cellDx/cellDy/cellScale —
                // точные поправки на конкретный предмет (в каталоге shmot.js), СНЯТЫ относительно
                // той же формулы cx+77/cy+98 — то есть остаются корректными в любой ячейке грида,
                // независимо от того, в каком именно столбце/строке предмет оказался. Для
                // предметов БЕЗ этих полей (старый базовый набор id0-40) поведение не изменилось —
                // прежняя формула центра + авто-fit.
                img.x = cx + 77 + (item.cellDx || 0);
                img.y = cy + 98 + (item.cellDy || 0);
                if(item.cellScale){
                    img.scale.set(item.cellScale);
                } else {
                    const _fitImg = (tex) => {
                        const s = Math.min(1, 78 / Math.max(1, tex.width), 118 / Math.max(1, tex.height));
                        img.scale.set(s);
                    };
                    if(img.texture.width > 1) _fitImg(img.texture);
                    else img.texture.once('update', () => _fitImg(img.texture));
                }
                // 25.09.2026 (по прямому указанию — "шмотки, которые не выбиты, чёрно-белым,
                // которые получены — цветными, чтобы был контраст"): невладеемые предметы
                // (ещё не выбиты/не куплены) рендерятся через ColorMatrixFilter.desaturate() —
                // сразу видно по сетке, что уже есть, а что ещё нет, не наводясь на каждую ячейку.
                if(!item.owned){
                    const gsFilter = new PIXI.filters.ColorMatrixFilter();
                    gsFilter.desaturate();
                    img.filters = [gsFilter];
                }
                cont.addChild(img);
            } else if(item && item.icon){
                // Для предметов без PNG оставляем эмодзи как запасной вариант. У связки ключей
                // есть собственный imgFile, поэтому сюда она больше не попадёт.
                // Раньше карточка БЕЗ imgFile оставалась совсем пустой (см. батч 23.09.2026 —
                // предметы-заглушки без картинки тогда просто убрали из каталога целиком). Здесь
                // предмет намеренно data-only, поэтому текстовый emoji-фолбэк — не костыль, а
                // единственное отображение по решению пользователя.
                const iconTxt = new PIXI.Text(item.icon, {fontFamily:'Southbank LT', fontSize:48});
                iconTxt.anchor.set(0.5, 0.5);
                iconTxt.x = cx + 77 + (item.cellDx || 0);
                iconTxt.y = cy + 98 + (item.cellDy || 0);
                if(!item.owned) iconTxt.alpha = 0.45;
                cont.addChild(iconTxt);
            }

            // 19.09.2026 (по прямому указанию) — дроп-вещи (item.price === null, выпадают с
            // боссов/казино/тайника, см. game/shmot.js) не продаются за валюту вообще — кнопка
            // "купить" на них была декоративной ловушкой (клик просто показывал "не продаётся",
            // см. shmot.js._onWear). Теперь для таких НЕ ВЛАДЕЕМЫХ предметов кнопки нет совсем —
            // владеемые по-прежнему получают "надеть"/"надето" как раньше.
            // Связка ключей — такой же предмет руки, как оружие: владелец может надеть её,
            // снять и заменить другой вещью категории 6.
            if(item && (item.owned || item.price)){
                const stateFile = !item.owned ? 'купить.png' : (item.equipped ? 'надето.png' : 'надеть.png');
                const stateBtn = new PIXI.Sprite(PIXI.Texture.from('./images/' + stateFile));
                stateBtn.anchor.set(0.5, 0);
                stateBtn.x = cx + cellW / 2;
                stateBtn.y = cy + cellH - 27 - 11;
                cont.addChild(stateBtn);
            }
        });

        this._shopTotalH = Math.ceil(items.length / cols) * (cellH + gap);
        if(!preserveScroll) this._shopScrollRatio = 0;
        this._applyShopScroll();
        if(this._shopTrack) this._updateShopThumb(this._shopTrack.top, this._shopTrack.bot);
    };

    proto._applyShopScroll = function(){
        if(!this._shopCont) return;
        const { visH } = this._shopGrid;
        const maxScroll = Math.max(0, this._shopTotalH - visH);
        this._shopCont.y = this._shopGrid.y - this._shopScrollRatio * maxScroll;
    };

    proto._updateShopThumb = function(trackTop, trackBot){
        if(!this._shopThumb) return;
        const THUMB_H = this._shopThumb.height;
        this._shopThumb.y = trackTop + this._shopScrollRatio * (trackBot - THUMB_H - trackTop);
    };

    // 19.09.2026 (репорт "шмотки не выводятся, не покупаются" — разбор показал: этот файл
    // содержал СОБСТВЕННЫЕ _buy()/_saveToUdata()/_applyMaxEnergyBonus(), которые ЗАТИРАЛИ
    // одноимённые server-authoritative методы из game/shmot.js (attachShmotShop(Shmot.prototype)
    // выполняется ПОСЛЕ определения класса — последний присвоенный метод и побеждает). В
    // результате вся миграция покупки шмоток на сервер (TS.php('shmot.buy'), applyPatch,
    // achievements.onShmotBuy, id-индексация owned/equipped) была мёртвым кодом — реально
    // выполнялся старый путь: списание валюты на клиенте БЕЗ проверки сервера и падение с
    // TypeError на предметах с price:null (дроп-вещи, see game/shmot.js this.items id41+).
    // Дубликаты удалены, клик теперь идёт через единственную настоящую реализацию —
    // _onWear() (game/shmot.js) — она уже умеет и honest-buy, и дроп-предметы, и equip-toggle;
    // _renderGrid()/_renderMannequin() там же теперь дополнительно обновляют именно этот экран
    // (_shopRefresh/_updateManSprites), а home.updateClothes() вызывается внутри _onWear().
    proto._onShmotClick = function(item){
        this._onWear(item.id);
    };

    proto._updateManSprites = function(){
        if(!this._manSlots) return;
        Object.keys(this._manSlots).forEach(cat => {
            const spr = this._manSlots[cat];
            const eq = (this.items || []).find(it => it.cat === parseInt(cat) && it.equipped);
            if(eq && eq.imgFile){
                spr.texture = PIXI.Texture.from('./images/shmot/' + eq.imgFile);
                spr.visible = true;

                const base = this._manSlotBases && this._manSlotBases[parseInt(cat)];
                if(base){
                    spr.x = base.x + (eq.manDx || 0);
                    // У «Брюки сталкера» пояс ниже верхнего края PNG: совмещаем именно пояс.
                    spr.y = base.y + (eq.manDy || 0) + (eq.imgFile === 'штаны_1.png' ? -28 : 0);
                }

                // Натуральный размер (как в PSD), если не задан manScale. Нужен для тела-предметов
                // с завышенным разрешением исходника (Броня «Свобода», Плащ аномалии, Экзоскелет —
                // выглядели гораздо крупнее базовой Майки), приводим их к сопоставимому размеру.
                spr.scale.set(eq.manScale || 1);
            } else {
                spr.texture = PIXI.Texture.EMPTY;
                spr.visible = false;
                spr.scale.set(1);
            }
            // Обычный предмет: левая кисть → предмет → правая кисть; часы/цепь выше кисти.
            if(parseInt(cat) === 6 && this._manLeftHandSpr && this._manLeftHandSpr.parent === this._shopWin){
                const weaponIdx = this._shopWin.getChildIndex(this._manLeftHandSpr) + 1;
                this._shopWin.addChildAt(spr, Math.min(weaponIdx, this._shopWin.children.length));
                if(eq && (eq.id === 62 || eq.id === 92)) this._shopWin.addChild(spr);
                else if(this._manRightHandSpr) this._shopWin.addChildAt(this._manRightHandSpr, this._shopWin.getChildIndex(spr) + 1);
            }
        });
    };

    // _buy()/_saveToUdata()/_applyMaxEnergyBonus() НЕ определяются здесь — используются
    // одноимённые server-authoritative методы из game/shmot.js (см. комментарий у
    // _onShmotClick выше). Определять их здесь снова — значит опять затереть тот же путь.
}
