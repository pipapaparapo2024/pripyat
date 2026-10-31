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
        const persTex = PIXI.Texture.from('./images/персонаж который сидит.png');
        // 17.10.2026: см. докблок в home.js (тот же файл, тот же баг "пиксельный при мелком
        // показе") — форсирует мипмапы на WebGL2, безопасный no-op на WebGL1.
        persTex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        persTex.baseTexture.update();
        const persSpr = new PIXI.Sprite(persTex);
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
        // 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется"): раньше
        // тут была "фаланги правой руки.png" (мелкий оверлей костяшек), теперь — ПОЛНАЯ кисть,
        // переключается между "кисть расслабленная.png"/"кисть хват.png" в _updateManSprites()
        // ниже (та же логика, что в home.js — см. ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md).
        // Координаты — тот же сдвиг +224/+4, что и во всех остальных MAN_SLOTS относительно
        // home.js: 634+224=858, 441+4=445.
        // 22.10.2026 (по прямому указанию, редактор позиций): свой x/y/scale под каждую
        // текстуру кисти (не общий box 98×97, не формула +224/+4 от home.js — у кистей
        // отдельная калибровка на манекене) — актуальные значения в _updateManSprites() ниже,
        // здесь только начальная (дефолтная) поза.
        const rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/кисть расслабленная.png'));
        rightHandSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        rightHandSpr.texture.baseTexture.update();
        rightHandSpr.anchor.set(0, 0);
        // 22.10.2026 (по прямому указанию, повторная калибровка редактором позиций): 871,428 → 866,431.
        rightHandSpr.x = 866;
        rightHandSpr.y = 431;
        rightHandSpr.scale.set(0.200);
        this._manRightHandSpr = rightHandSpr;

        // 23.10.2026 (по прямому указанию — "почему-то ты не выводишь файл фаланги кистей,
        // когда игрок берёт что-то в руку... он должен находиться под оружием и под кистью"):
        // "фаланги правой руки.png" — тот самый файл, что до 21.10.2026 стоял на этом месте как
        // мелкий оверлей костяшек (см. докблок у rightHandSpr выше про замену на полноценную
        // кисть) — физически остался в images/, просто ничем не используется с той даты.
        // Возвращён ОТДЕЛЬНЫМ слоем между предметом в руке и предплечьем, видим только когда
        // что-то реально зажато (тот же признак _handWeaponHeld, см. _updateManSprites() ниже).
        // 27.10.2026 (по прямому указанию, редактор позиций — уточнение прежней прикидки):
        // x:862,y:449,scale:0.789.
        const phalanxSpr = new PIXI.Sprite(PIXI.Texture.from('./images/фаланги правой руки.png'));
        phalanxSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        phalanxSpr.texture.baseTexture.update();
        phalanxSpr.anchor.set(0, 0);
        phalanxSpr.x = 862;
        phalanxSpr.y = 449;
        phalanxSpr.scale.set(0.789);
        phalanxSpr.visible = false;
        this._manPhalanxSpr = phalanxSpr;

        this._manSlots = {};
        this._manSlotBases = {};
        MAN_SLOTS.forEach(s => {
            if(s.cat === 6){ win.addChild(rightHandSpr); win.addChild(phalanxSpr); }
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
        leftForearmSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        leftForearmSpr.texture.baseTexture.update();
        leftForearmSpr.anchor.set(0, 0);
        leftForearmSpr.x = 738; leftForearmSpr.y = 328;
        leftForearmSpr.scale.set(0.197);
        win.addChild(leftForearmSpr);
        this._leftForearmSpr = leftForearmSpr;

        // 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется"):
        // "правая рука.png" (единый файл кисть+часть предплечья) заменён на ОТДЕЛЬНЫЙ
        // статичный файл предплечья — больше никогда не переключается. Позиция — там же,
        // где раньше стояла "правая рука.png" (862-8=854, 373), кисть теперь отдельно (см.
        // this._manRightHandSpr выше). Рисуются ПОСЛЕ одежды (торс/штаны/обувь/голова/
        // аксессуар), чтобы быть поверх неё.
        const rightForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/предплечье правое.png'));
        rightForearmSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        rightForearmSpr.texture.baseTexture.update();
        rightForearmSpr.anchor.set(0, 0);
        // 22.10.2026 (по прямому указанию, повторная калибровка редактором позиций):
        // 873,381,0.197 → 866,379,0.218.
        rightForearmSpr.x = 866; rightForearmSpr.y = 379;
        rightForearmSpr.scale.set(0.218);
        win.addChild(rightForearmSpr);
        this._manRightForearmSpr = rightForearmSpr;
        // 24.10.2026 (по прямому указанию — "кисть находится под предплечьем, так быть не
        // должно"): явная гарантия сразу здесь, не полагаемся только на пересортировку в
        // _updateManSprites() ниже (она завязана на leftHandSpr и могла не успеть выполниться).
        win.addChild(rightHandSpr);
        win.addChild(phalanxSpr);

        const leftHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левая рука.png'));
        leftHandSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        leftHandSpr.texture.baseTexture.update();
        leftHandSpr.anchor.set(0, 0);
        leftHandSpr.x = 756 + 2; leftHandSpr.y = 389;
        win.addChild(leftHandSpr);
        this._manLeftHandSpr = leftHandSpr;

        // 21.10.2026 (по прямому указанию — "мини-анимация с морганием персонажа"): "глаза
        // закрыты.png" появляется раз в 15 сек и держится 0.3 сек. _buildShmotShop()
        // пересобирается заново при КАЖДОМ открытии экрана (см. _openShmotShop выше —
        // removeChild + полная пересборка) — поэтому обязательно гасим предыдущий интервал,
        // иначе каждое повторное открытие плодит ещё один параллельный setInterval поверх уже
        // висящих (старый спрайт при этом уже отсоединён от сцены, но таймер жил бы вечно).
        if(this._shopBlinkTimer) clearInterval(this._shopBlinkTimer);
        const eyesClosedSpr = new PIXI.Sprite(PIXI.Texture.from('./images/глаза закрыты.png'));
        eyesClosedSpr.anchor.set(0, 0);
        // 21.10.2026 (уточнено пользователем через редактор позиций — x:853 y:234 scale:0.219).
        eyesClosedSpr.x = 853;
        eyesClosedSpr.y = 236;
        eyesClosedSpr.scale.set(0.219);
        eyesClosedSpr.visible = false;
        win.addChild(eyesClosedSpr);
        // 26.10.2026 (по прямому указанию — "для шмотки маска исполнитель моргания не должно
        // быть"): id116 "Маска (Исполнитель)", cat:0 (голова) — проверяется на каждый тик, не
        // один раз при сборке экрана: здесь можно переодеться, не закрывая его.
        this._shopBlinkTimer = setInterval(() => {
            const headEq = window.shmot && (shmot.items || []).find(it => it.cat === 0 && it.equipped);
            if(headEq && headEq.id === 116) return;
            eyesClosedSpr.visible = true;
            setTimeout(() => { eyesClosedSpr.visible = false; }, 300);
        }, 15000);

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
        exitBtn.on('pointerover', ()=>{ exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>{
            win.visible = false;
            if(this._shopWheelHandler) document.querySelector('canvas').removeEventListener('wheel', this._shopWheelHandler);
            if(this._shopSwipeCleanup) this._shopSwipeCleanup();   // 28.09.2026: слушатели свайпа с корня сцены
            // 29.09.2026: popHud вместо ручного форсированного показа обоих ХУДов — снимает
            // СВОЮ запись из стека и восстанавливает требование экрана ПОД этим (если магазин
            // шмоток был открыт поверх боя с боссом — вернёт down:false боя, а не всегда true).
            if(window.iface) iface.popHud('shmot');
        });
        win.addChild(exitBtn); exitBtn._tutorialTarget = 'exit';

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
        // 23.10.2026 (по прямому указанию, скрин — "описание ниже по Z-индексу, чем то, что
        // надето на руку, такого быть не должно, описание должно покрывать поверх вообще
        // всего"): card добавлен в win ОДИН РАЗ при постройке экрана (до того, как
        // _updateManSprites() начинает переставлять оружие/кисть/торс выше по ходу игры) —
        // любая последующая смена экипировки поднимала надетые вещи ВЫШЕ уже показанного
        // тултипа. Переподнимаем карточку на самый верх при каждом показе.
        this._shopWin.addChild(card);
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
            const unit = {coins:'монет', stew:'тушёнки', cig:'сухарей'}[item.price.type] || '';
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
                // 18.10.2026 (тот же фикс, что и для манекена — см. докблок в
                // character-sprite-mipmap-fix.test.js): иконки каталога тоже крупные
                // исходники, сжатые ещё мельче (в ячейку 78×118) через cellScale/авто-fit.
                imgTex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
                imgTex.baseTexture.update();
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
                // 27.10.2026 (по прямому указанию — "поверни иконку по часовой стрелке на 10°"):
                // cellRot — новое поле (градусы по часовой стрелке), раньше у иконок гардероба
                // вращения не было вообще. anchor уже (0.5,0.5) — вращается вокруг своего центра.
                if(item.cellRot) img.rotation = item.cellRot * Math.PI / 180;
                // 23.10.2026 (по прямому указанию, редактор позиций — "штаны бродяга/следопыт"):
                // cellWidth/cellHeight — альтернатива cellScale, та же идея, что manWidth/
                // manHeight на персонаже (см. id111 Панама Следопыт) — явный пиксельный размер
                // вместо единого множителя, нужен когда пользователь тащит угловую ручку
                // редактора НЕ пропорционально (разный итоговый scale по X и Y).
                if(item.cellWidth && item.cellHeight){
                    img.width = item.cellWidth;
                    img.height = item.cellHeight;
                } else if(item.cellScale){
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
                const stateFile = !item.owned ? 'магазин вещей кнопка купить.png' : (item.equipped ? 'магазин вещей кнопка надето.png' : 'магазин вещей кнопка надеть.png');
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
                // 27.10.2026 (по прямому указанию — перевод предметов на персонаже с manScale на
                // явные manWidth/manHeight, по той же конвенции, что уже используется в гардеробной
                // сетке через cellWidth/cellHeight). Резкость при этом НЕ меняется (см. историю
                // отката 26.10.2026 в AGENTS.md) — manImgFile (заранее уменьшенный PNG) остаётся
                // реальным источником качества картинки, manWidth/manHeight лишь фиксируют тот же
                // видимый размер, что раньше давала пара manImgFile+manScale, явными пикселями.
                spr.texture = PIXI.Texture.from('./images/shmot/' + (eq.manImgFile || eq.imgFile));
                spr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
                spr.texture.baseTexture.update();
                spr.visible = true;

                const base = this._manSlotBases && this._manSlotBases[parseInt(cat)];
                if(base){
                    spr.x = base.x + (eq.manDx || 0);
                    // У «Брюки сталкера» пояс ниже верхнего края PNG: совмещаем именно пояс.
                    spr.y = base.y + (eq.manDy || 0) + (eq.imgFile === 'штаны_1.png' ? -28 : 0);
                }

                spr.width  = eq.manWidth  || spr.texture.width;
                spr.height = eq.manHeight || spr.texture.height;
            } else {
                spr.texture = PIXI.Texture.EMPTY;
                spr.visible = false;
                spr.scale.set(1);
            }
            // Обычный предмет: левая кисть → фаланги → предмет → правая кисть; часы/цепь выше кисти.
            if(parseInt(cat) === 6 && this._manLeftHandSpr && this._manLeftHandSpr.parent === this._shopWin){
                // 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется"):
                // предплечье (this._manRightForearmSpr) больше НЕ трогается здесь — статичный
                // файл. "кисть расслабленная.png" — пусто/часы Poker/цепь Teenager (id 62/92,
                // носятся НА руке, не в кулаке), "кисть хват.png" — что-то зажато. Исключение —
                // handBuiltIn-предметы (Сайга/Пистолет/Кружка новых сетов) уже рисуют кисть
                // внутри своего файла — для них кисть-спрайт скрывается целиком.
                const _handWeaponHeld = eq && eq.id !== 62 && eq.id !== 92;
                if(this._manRightHandSpr){
                    if(_handWeaponHeld && eq.handBuiltIn){
                        this._manRightHandSpr.visible = false;
                    } else {
                        this._manRightHandSpr.visible = true;
                        // 22.10.2026 (по прямому указанию, редактор позиций): свой x/y/scale под
                        // каждую текстуру кисти — см. тот же коммент в home.js.
                        this._manRightHandSpr.texture = PIXI.Texture.from(
                            _handWeaponHeld ? './images/кисть хват.png' : './images/кисть расслабленная.png'
                        );
                        this._manRightHandSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
                        this._manRightHandSpr.texture.baseTexture.update();
                        this._manRightHandSpr.x = _handWeaponHeld ? 858 : 866;
                        this._manRightHandSpr.y = _handWeaponHeld ? 425 : 431;
                        this._manRightHandSpr.scale.set(_handWeaponHeld ? 0.189 : 0.200);
                    }
                }
                // 23.10.2026 (по прямому указанию — "фаланги должны быть под оружием и под
                // кистью... создаёт эффект, как будто игрок взял в руку оружие реально"): видна
                // только когда что-то реально зажато (не у handBuiltIn-предметов — у них кисть
                // уже нарисована внутри файла самого предмета, свои фаланги были бы лишние).
                if(this._manPhalanxSpr) this._manPhalanxSpr.visible = !!(_handWeaponHeld && !eq.handBuiltIn);
                let topIdx = this._shopWin.getChildIndex(this._manLeftHandSpr) + 1;
                if(this._manPhalanxSpr && this._manPhalanxSpr.visible){
                    this._shopWin.addChildAt(this._manPhalanxSpr, Math.min(topIdx, this._shopWin.children.length));
                    topIdx = this._shopWin.getChildIndex(this._manPhalanxSpr) + 1;
                }
                this._shopWin.addChildAt(spr, Math.min(topIdx, this._shopWin.children.length));
                if(eq && (eq.id === 62 || eq.id === 92)) this._shopWin.addChild(spr);
                else if(this._manRightHandSpr) this._shopWin.addChildAt(this._manRightHandSpr, this._shopWin.getChildIndex(spr) + 1);
            }
        });
        // 22.10.2026 (по прямому указанию — то же правило, что в home.js, см. докблок там):
        // куртки сетов Бродяга/Ветеран/Следопыт (id102/107/112) поднимаются на самый верх
        // z-порядка, выше рук/предплечий/часов-цепи — длинный рукав должен закрывать руку.
        // 25.10.2026 (по прямому указанию — "почему шмотки на торс по Z-индексу меньше, чем
        // левое/правое предплечье? сделай так, чтобы одежда была поверх"): те же худи сета
        // "Исполнитель" (id118/119) — тот же класс одежды с длинным рукавом, добавлены в
        // тот же список.
        const _torsoEq = (this.items || []).find(it => it.cat === 1 && it.equipped);
        if(_torsoEq && [102, 107, 112, 118, 119].includes(_torsoEq.id) && this._manSlots[1]){
            this._shopWin.addChild(this._manSlots[1]);
            // 22.10.2026 (по прямому указанию — "шмотки на голову должны быть выше по
            // Z-индексу, чем шмотки на торс"): см. тот же коммент в home.js.
            if(this._manSlots[0]) this._shopWin.addChild(this._manSlots[0]);
            // 23.10.2026 (по прямому указанию, скрин — "бита прячется под куртку, такого быть не
            // должно"): подъём куртки выше хоронил уже переставленный выше в forEach оружие/
            // кисть/фаланги (cat:6) — переподнимаем их поверх куртки, НО только для предмета,
            // реально зажатого в кулаке (бита/нож/мачете и т.п.). 23.10.2026 (по прямому
            // указанию, повторный скрин — "Сайга/Пистолет/Кружка новых сетов должны быть МЕНЬШЕ
            // по Z-индексу, чем куртка; часы на руке тоже должны быть под курткой"):
            // handBuiltIn-предметы (своя кисть нарисована внутри файла — выглядят как лежащие на
            // бедре/за поясом, не зажатые в кулаке) и часы/цепь (id62/92, носятся НА запястье)
            // ТЕПЕРЬ исключены из переподъёма целиком — остаются в обычном порядке (под курткой),
            // как и было до появления самого переподъёма.
            // 26.10.2026 (по прямому указанию, скрин — "бита исполнителя должна быть поверх
            // шмоток на торс"): id117 (Бита, Исполнитель) — исключение из исключения. Она тоже
            // handBuiltIn (кисть нарисована в самом файле), но в отличие от Сайги/Пистолета/
            // Кружки держится поднятой в кулаке, а не у бедра — визуально должна вести себя как
            // обычное зажатое оружие (переподниматься поверх куртки), а не прятаться под рукав.
            const _handEq = (this.items || []).find(it => it.cat === 6 && it.equipped);
            const _handWeaponHeld2 = _handEq && _handEq.id !== 62 && _handEq.id !== 92 && (!_handEq.handBuiltIn || _handEq.id === 117);
            if(_handWeaponHeld2){
                if(this._manPhalanxSpr && this._manPhalanxSpr.parent === this._shopWin) this._shopWin.addChild(this._manPhalanxSpr);
                if(this._manSlots[6]) this._shopWin.addChild(this._manSlots[6]);
                if(this._manRightHandSpr && this._manRightHandSpr.parent === this._shopWin) this._shopWin.addChild(this._manRightHandSpr);
            }
        }
    };

    // _buy()/_saveToUdata()/_applyMaxEnergyBonus() НЕ определяются здесь — используются
    // одноимённые server-authoritative методы из game/shmot.js (см. комментарий у
    // _onShmotClick выше). Определять их здесь снова — значит опять затереть тот же путь.
}
