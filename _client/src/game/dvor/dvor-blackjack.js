/** Блэкджек — 4 карты (2×2), поиск пар, ставка 1 монета.
 *
 * ── SERVER-AUTHORITATIVE (18.09.2026, перенос экономики — Казино, игра 4/4, последняя) ──
 * Раньше списание рубля/бесплатной попытки, скрытый pity-счётчик AA/KK/QQ, честная раздача
 * пары и честная замена карты считались ПРЯМО В БРАУЗЕРЕ — читер мог подделать pity-счётчики
 * (this._data.cards.aa/kk/qq, часть client-writable dvor_games_data) через users.save и
 * форсировать гарантированную пару тузов (10000 сигарет + шмотка) в каждой партии. Теперь
 * раздача/замена/итог — три отдельных запроса (blackjack.deal/swap/resolve,
 * server/core/controllers/blackjack.php); pity и "бесплатная попытка сегодня" хранятся в
 * udata['blackjack_session'] — это поле НЕ в whitelist users.php (как dice_session/
 * poker_session), клиент физически не может подделать его через users.save.
 *
 * Декоративные карты (слоты 0/1) ни на что не влияют (не формируют пару) и остаются
 * полностью клиентскими — их RNG переносить незачем, экономики там нет.
 */
import { applyPatch } from '../../modules/patch.js';

export function attachBlackjack(proto){

    const RANKS = ['семерка','восьмерка','девятка','десятка','валет','дама','король','туз'];
    const SUITS = ['♠','♥','♦','♣'];

    const pick     = (arr) => arr[Math.floor(Math.random()*arr.length)];
    const sameCard = (a, b) => !!a && !!b && a.rank === b.rank && a.suit === b.suit;

    // 23.09.2026 (по прямому указанию — репорт "выпала AA хотя pity ещё далеко", максимально
    // подробное логирование): сервер (blackjack.php) теперь кладёт поле debug в КАЖДЫЙ ответ
    // deal/swap/resolve — полная трассировка (сырой blackjack_session из БД, каталог рангов,
    // pity-счётчики, попытка за попыткой в цикле розыгрыша). Печатаем ОТДЕЛЬНО от общего
    // console.log(JSON.stringify(res)) — раскрытым объектом (не строкой), чтобы в devtools
    // можно было развернуть вложенные массивы/поля, а не читать одну длинную строку. Если
    // сервер сам пометил находку ("!!! ... ДЫРА ..." внутри isPremiumPairAfter/isPremiumWin) —
    // выводим отдельным console.error с восклицательными знаками, чтобы не потерялось среди
    // обычных логов.
    function logBlackjackDebug(fnLabel, debug){
        if(!debug) { console.warn('[dvor-blackjack.' + fnLabel + '] сервер не вернул debug — правка ещё не задеплоена?'); return; }
        console.log('[dvor-blackjack.' + fnLabel + '] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', debug);
        const suspicious = debug.isPremiumPairAfter || debug.isPremiumWin;
        const forced = debug.forcedRank || debug.forcedRank_at_deal;
        if(suspicious && !forced){
            console.error('[dvor-blackjack.' + fnLabel + '] !!! ПРЕМИУМ-ПАРА БЕЗ FORCEDRANK — ЭТО ТА САМАЯ ДЫРА !!! Пришлите этот лог целиком.', debug);
        }
        if(debug.usedFallback){
            console.error('[dvor-blackjack.' + fnLabel + '] !!! сработал fallback-путь swap() (50 попыток исчерпаны, без проверки на чужую пару) !!!', debug);
        }
    }

    // Декоративные слоты 0/1 — без ограничений на ранг, только не дублируют уже
    // выданные карты один в один (чисто визуально, чтобы не путать игрока).
    function dealDecorative(exclude){
        for(let attempt = 0; attempt < 50; attempt++){
            const card = {rank: pick(RANKS), suit: pick(SUITS)};
            if(!exclude.some(c => sameCard(c, card))) return card;
        }
        return {rank: pick(RANKS), suit: pick(SUITS)};
    }

    proto._openBlackjackScreen = function(){
        if(!this._blackjackWin) this._buildBlackjackScreen();
        root.layer2_mc.addChild(this._blackjackWin);
        // 24.09.2026 (по прямому указанию — "игры должны открываться поверх Двора, а не
        // Главного, фон Двора при этом затемнён"): лобби Двора остаётся ВИДИМЫМ (затемнённым и
        // некликабельным) позади экрана игры, вместо полного скрытия. См. подробный разбор
        // бага "фон двоится" (22.09.2026) в dvor-dice.js._openDiceScreen() — затемнение
        // попутно решает и его.
        if(this._dvorWrap){ this._dvorWrap.alpha = 0; this._dvorWrap.interactiveChildren = false; }
        this._updateBlackjackUI();
        this._syncBlackjackDailyStatus();
        if(window.iface) iface.restoreHud();
    };

    proto._buildBlackjackScreen = function(){
        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;
        // 18.09.2026 (прямое указание): весь экран блэкджека — фон, карты, кнопки, шкала
        // уровня — поднят на 8px. Сдвигаем контейнер целиком (не каждый элемент по
        // отдельности), поэтому blocker сделан на 8px выше (728 вместо 720) — после сдвига
        // всего контейнера на -8 он по-прежнему покрывает весь экран 0..720 без зазора внизу.
        win.y = -8;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 728);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 24.09.2026 (по прямому указанию — "затемнение фона у игр, чтобы Двор не просвечивал
        // по краям"): та же тёмная подложка, что уже есть у покера (dvor-poker-screen.js) —
        // здесь она тем более нужна: win.y=-8 выше сдвигает весь контейнер, а bg ниже
        // (height=690, y=15) реально покрывает только y=7..697 в экранных координатах,
        // оставляя ~7px сверху и ~23px снизу непокрытыми. Размер — как у blocker (0..728),
        // чтобы совпасть с тем же компенсированным сдвигом.
        const darkBg = new PIXI.Graphics();
        darkBg.beginFill(0x000000, 0.6);
        darkBg.drawRect(0, 0, 1280, 728);
        darkBg.endFill();
        win.addChild(darkBg);

        // 03.10.2026 (по прямому указанию — "замени задний фон в игре блекджек"): новый файл
        // "блекджек фон v2.png" (было "блекджек страница.png"). Имя сменено, не просто
        // перезаписан старый файл — тот же приём, что у "рулетка колесо v2.png": у VK Mini Apps
        // наблюдался прокси-кэш между сервером и игрой, который не реагирует на обновление
        // содержимого при том же имени файла (см. комментарий в dvor-roulette-screen.js).
        //
        // 04.10.2026 (по прямому указанию — "ты растянул фон блекджека, не нужно это делать,
        // вставляй файл в натуральном размере"): отменяет правку 03.10.2026 (тогда просили
        // letterbox-вписывание с масштабом 1.3218× — см. старый коммент в истории файла).
        // Нативный размер файла 838×522, БЕЗ width/height (никакого масштабирования), по центру
        // области 1280×690 (y начинается с 15, как у остальных экранов): x=(1280-838)/2=221,
        // y=15+(690-522)/2=99. Сплошная подложка — чистое чёрное поле вокруг изображения вместо
        // полупрозрачного darkBg (тот скрывает тонкие непокрытые края, не широкие поля).
        const bgLetterbox = new PIXI.Graphics();
        bgLetterbox.beginFill(0x000000, 1);
        bgLetterbox.drawRect(0, 15, 1280, 690);
        bgLetterbox.endFill();
        win.addChild(bgLetterbox);

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'блекджек фон v2.png'));
        bg.x = 221; bg.y = 99;
        win.addChild(bg);

        // Подсветка строки в напечатанной на фоне "ТАБЛИЦЕ ВЫПЛАТ" (справа) — вместо
        // текстового результата отдельно. Координаты — приблизительные (сняты по
        // скриншоту фона), поправить точно через редактор позиций.
        const comboHighlight = new PIXI.Graphics();
        comboHighlight.visible = false;
        // Разрешаем универсальному редактору позиций хватать и двигать эту рамку —
        // обычно он видит только Sprite/Text, для произвольной Graphics нужен явный флаг.
        comboHighlight._uDraggable = true;
        win.addChild(comboHighlight);
        this._bjComboHighlight = comboHighlight;

        // Шкала уровня блэкджека — отдельный ассет из макета.
        const levelScale = new PIXI.Sprite(PIXI.Texture.from(BASE + 'уровень фон.png'));
        levelScale.x = 228;
        levelScale.y = 89;
        win.addChild(levelScale);
        this._bjLevelScale = levelScale;

        // Заполнение шкалы идет сверху вниз по прогрессу текущего уровня.
        const levelTrack = new PIXI.Sprite(PIXI.Texture.from(BASE + 'уровень игры.png'));
        levelTrack.position.set(238, 138);
        win.addChild(levelTrack);

        // Маска-геометрия заполнения — сама не рисуется (renderable=false), только задаёт
        // форму видимой области для levelTrackLit ниже (тот же паттерн, что в рулетке —
        // см. dvor-roulette-screen.js). Раньше здесь рисовался плоский полупрозрачный
        // прямоугольник ПОВЕРХ линейки, скрывая деления и текстуру дерева.
        const levelFill = new PIXI.Graphics();
        levelFill.renderable = false;
        win.addChild(levelFill);
        this._bjLevelFill = levelFill;

        // Тонированная копия той же самой картинки линейки — закрашенная часть выглядит
        // так, будто закрашивается сама картинка, а не лежит отдельный цветной блок сверху.
        const levelTrackLit = new PIXI.Sprite(PIXI.Texture.from(BASE + 'уровень игры.png'));
        levelTrackLit.position.set(238, 138);
        levelTrackLit.tint = 0xffab2e;
        levelTrackLit.mask = levelFill;
        levelTrackLit.visible = false;
        win.addChild(levelTrackLit);
        this._bjLevelTrackLit = levelTrackLit;

        const levelTxtStyle = {
            fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        };
        const levelTopTxt = new PIXI.Text('0', levelTxtStyle);
        levelTopTxt.anchor.set(0.5, 0.5);
        levelTopTxt.x = levelScale.x + 25; levelTopTxt.y = levelScale.y + 23;
        win.addChild(levelTopTxt);
        const levelBottomTxt = new PIXI.Text('1', levelTxtStyle);
        levelBottomTxt.anchor.set(0.5, 0.5);
        levelBottomTxt.x = levelScale.x + 21; levelBottomTxt.y = levelScale.y + 488;
        win.addChild(levelBottomTxt);
        this._bjLevelTxt = levelTopTxt;
        this._bjLevelBottomTxt = levelBottomTxt;

        // 27.09.2026 (по прямому указанию — "текст шансов до сих пор светится, убери его"):
        // панель "До AA/KK/QQ: N/N" (добавлена 25.09.2026) убрана из HUD блэкджека. proto.
        // _updateBjPityTxt() оставлен как есть — каждое присваивание там защищено проверкой
        // `if(this._bjPityXxTxt)`, без самих текстов метод просто ничего не делает.

        // Смены карт (справа от названия)
        const swapsTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:20, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        swapsTxt.anchor.set(0.5, 0.5);
        swapsTxt.x = 355; swapsTxt.y = 141;
        swapsTxt.scale.set(1.141);
        win.addChild(swapsTxt);
        this._bjSwapsTxt = swapsTxt;

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 98; // 21.09.2026: снято через редактор позиций (было 90)
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closeBlackjackScreen());
        win.addChild(exitBtn);

        // 4 карты в позициях 2×2
        const CW = 101;
        const CH = 152;
        const POSITIONS = [
            {x: 325, y: 179 + 18}, {x: 445, y: 179 + 18},
            {x: 325, y: 337 + 18}, {x: 445, y: 337 + 18},
        ];

        this._bjCardSprites = [];
        this._bjSuitTexts   = [];

        for(let i = 0; i < 4; i++){
            const pos = POSITIONS[i];

            const cardSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'туз.png?v=221'));
            cardSpr.width = CW; cardSpr.height = CH;
            cardSpr.x = pos.x; cardSpr.y = pos.y;
            cardSpr.visible = false;
            cardSpr.interactive = false;
            cardSpr.buttonMode  = false;
            win.addChild(cardSpr);
            this._bjCardSprites.push(cardSpr);

            const suitTxt = new PIXI.Text('', {
                fontFamily:'Arial', fontSize:24, fill:'#111111', fontWeight:'bold'
            });
            suitTxt.anchor.set(0.5, 0);
            suitTxt.x = pos.x + CW / 2; suitTxt.y = pos.y + 6;
            suitTxt.visible = false;
            win.addChild(suitTxt);
            this._bjSuitTexts.push(suitTxt);
        }

        // Иконка сигарет (рядом с результатом)
        const cigSpr = new PIXI.Sprite(PIXI.Texture.from('./images/боевка награда Сиги.png'));
        cigSpr.anchor.set(0.5, 0.5);
        cigSpr.x = 598; cigSpr.y = 497;
        cigSpr.visible = false;
        win.addChild(cigSpr);
        this._bjCigSpr = cigSpr;

        // Больше НЕ добавляется в win — выигрыш уже показывает подсветка строки в
        // таблице выплат (_bjShowComboHighlight), текст дублировал её.
        const resultTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
        });
        this._bjResultTxt = resultTxt;

        // Кнопка Играть
        const playBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'блекджек кнопка играть.png'));
        playBtn.anchor.set(0.5, 0.5);
        playBtn.x = 485; playBtn.y = 544;
        playBtn.interactive = true; playBtn.buttonMode = true;
        playBtn.on('pointerover', ()=>{ _sa(playBtn, 0.85); playBtn.scale.set(1.08); });
        playBtn.on('pointerout', ()=>{ _sa(playBtn, 1); playBtn.scale.set(1); });
        playBtn.on('pointerdown', ()=>this._playBlackjack());
        win.addChild(playBtn);
        this._bjPlayBtn = playBtn;

        // Кнопка Готово (появляется при свапе) — 25.09.2026 (по прямому указанию — новая
        // тема кнопок "вскрытия" для азартных игр): текстовая Graphics-кнопка "ГОТОВО"
        // заменена на sprite с новым арт-файлом "кнопка вскрыться для игр.png" (текст уже
        // "запечён" в картинке). Позиция не менялась.
        const doneGfx = new PIXI.Sprite(PIXI.Texture.from(BASE + 'кнопка вскрыться для игр.png'));
        doneGfx.anchor.set(0.5, 0.5);
        doneGfx.x = 485; doneGfx.y = 550;
        doneGfx.interactive = true; doneGfx.buttonMode = true;
        doneGfx.visible = false;
        doneGfx.on('pointerover', ()=>{ _sa(doneGfx, 0.85); doneGfx.scale.set(1.08); });
        doneGfx.on('pointerout',  ()=>{ _sa(doneGfx, 1); doneGfx.scale.set(1); });
        doneGfx.on('pointerdown', ()=>this._bjFinishSwap());
        win.addChild(doneGfx);
        this._bjDoneBtn = doneGfx;

        // Метка «БЕСПЛАТНО!» рядом с кнопкой
        const freeLbl = new PIXI.Text('БЕСПЛАТНО!', {
            fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        freeLbl.anchor.set(0.5, 0.5);
        freeLbl.x = 670; freeLbl.y = 489; // 21.09.2026: снято через редактор позиций
        freeLbl.visible = false;
        win.addChild(freeLbl);
        this._bjFreeLbl = freeLbl;

        // Ценник (1 монета)
        const priceSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'блекджек ценник.png'));
        priceSpr.anchor.set(0.5, 0.5);
        priceSpr.x = 615; priceSpr.y = 552;
        win.addChild(priceSpr);
        this._bjPriceSpr = priceSpr;

        this._blackjackWin = win;
    };

    // Y-центр каждой строки "ТАБЛИЦЫ ВЫПЛАТ", напечатанной на "блекджек страница.png" (справа).
    // 22.09.2026 (по прямому указанию, редактор позиций — точные замеры для ВСЕХ 9 строк
    // разом, каждая явно подписана комбинацией на скриншоте): формула (235 + i*35) заменена
    // явными значениями — реальный шаг оказался 34px (не 35), с накопленной погрешностью в
    // 2-3px к низу таблицы у формулы, поэтому поточечные числа точнее на нижних строках.
    // 04.10.2026 (РЕАЛЬНЫЙ замер пользователем через универсальный редактор позиций — строка
    // "семерки": x:906 y:475 scale:1.494 w:276 h:34): предыдущая пропорциональная оценка (449)
    // оказалась на -26px выше настоящей позиции. Та же дельта (+26) применена ко всем ОСТАЛЬНЫМ
    // 8 строкам (единственная точка калибровки — экстраполяция, не точный замер каждой строки).
    // Если какая-то строка окажется мимо — пришлите реальный замер (лучше для верхней строки,
    // "туз") через редактор позиций, поправим и X/W/H, и шаг между строками разом.
    const BJ_ROW_Y = {
        'туз':       290,
        'король':    318,
        'дама':      345,
        'валет':     372,
        'десятка':   397,
        'девятка':   424,
        'восьмерка': 450,
        'семерка':   475,
        '__nonpair': 501,
    };
    // 26.09.2026 (баг найден по прямому указанию — "подсветка сдвинута вправо примерно на
    // 140px"): BJ_ROW_X считался как ЛЕВЫЙ край строки, и в cx ниже к нему ЕЩЁ добавлялась
    // BJ_ROW_W/2 — а BJ_ROW_Y при этом уже хранит готовый ЦЕНТР строки (без аналогичного
    // добавления). Эта асимметрия X-vs-Y и давала сдвиг ровно на BJ_ROW_W/2 (≈137.5px) вправо.
    // BJ_ROW_X теперь тоже готовый центр (снят редактором позиций по строке "валет": 915,342).
    // 04.10.2026: X/W/H заменены на реальный замер строки "семерки" (906/276/34) — те же
    // значения применяются ко всем 9 строкам (единая ширина/высота ячейки таблицы, только Y
    // отличается, см. коммент у BJ_ROW_Y выше).
    const BJ_ROW_X = 906, BJ_ROW_W = 276, BJ_ROW_H = 34;
    // "Любая непарная комбинация" теперь по общей формуле выше (BJ_ROW_Y.__nonpair) — та же
    // ширина/высота, что и остальные 8 строк (раньше была отдельной, чуть шире/выше).

    proto._bjShowComboHighlight = function(rank){
        const h = this._bjComboHighlight;
        if(!h) return;
        const key = rank || '__nonpair';
        if(BJ_ROW_Y[key] === undefined){ h.visible = false; return; }
        const cy = BJ_ROW_Y[key];
        // Позиция — в центр строки, прямоугольник рисуется в локальных координатах,
        // центрированных на (0,0) — при pivot=0 (по умолчанию) даёт ту же картинку, что
        // раньше, но масштаб (PageUp/PageDown через редактор) теперь симметричен.
        // (pivot туда же НЕ ставим — он гасит position, см. dvor-poker-screen.js.)
        h.position.set(BJ_ROW_X, cy);
        h.clear();
        h.lineStyle(3, 0xffdd44, 1);
        h.beginFill(0xffdd44, 0.18);
        h.drawRoundedRect(-BJ_ROW_W / 2, -BJ_ROW_H / 2, BJ_ROW_W, BJ_ROW_H, 6);
        h.endFill();
        h.visible = true;
        h.alpha = 1;
        // Результат остаётся подсвеченным до начала следующей партии. Раньше рамка исчезала
        // через несколько секунд, поэтому корректная пара (например JJ) выглядела как будто
        // не распознана сервером.
        if(window.gsap){
            gsap.killTweensOf(h);
        }
    };

    proto._updateBlackjackUI = function(){
        const levelInfo = this._getLevelInfo('cards');
        const lvl = levelInfo.level;
        if(this._bjLevelTxt) this._bjLevelTxt.text = String(lvl);
        if(this._bjLevelBottomTxt) this._bjLevelBottomTxt.text = String(lvl + 1);
        if(this._bjLevelFill){
            const ratio = levelInfo.next > 0 ? Math.min(1, levelInfo.cur / levelInfo.next) : 0;
            const fillH = Math.round(407 * ratio);
            this._bjLevelFill.clear();
            this._bjLevelFill.pivot.set(250, 138);
            this._bjLevelFill.position.set(250, 138);
            this._bjLevelFill.rotation = (2 / 7) * Math.PI / 180; // угол уменьшен в 7 раз, как в рулетке
            if(fillH > 0){
                // Цвет тут не важен (маска использует только форму/альфу) — реальный
                // "цвет заливки" задаёт tint у levelTrackLit выше.
                this._bjLevelFill.beginFill(0xffffff, 1);
                this._bjLevelFill.drawRoundedRect(238 + 2, 138, 23 - 2 - 1, fillH, 6);
                this._bjLevelFill.endFill();
            }
            if(this._bjLevelTrackLit) this._bjLevelTrackLit.visible = fillH > 0;
        }

        const maxSwaps = lvl >= 60 ? 2 : lvl >= 20 ? 1 : 0;
        if(this._bjSwapsTxt){
            this._bjSwapsTxt.text = maxSwaps > 0 ? ('Смен: 0/' + maxSwaps) : '';
        }

        this._renderBlackjackDailyStatus();
    };

    proto._renderBlackjackDailyStatus = function(){
        // 25.09.2026 (репорт: "бирка с ценой мигает во время игры") — этот метод дёргается
        // раз в секунду через _bjDailyTimer (обратный отсчёт "бесплатно через"), и раньше
        // безусловно выставлял visible=true/!isFree на _bjFreeLbl/_bjPriceSpr — это
        // перебивало явное скрытие при старте раунда (this._bjPlaying=true, см. запуск
        // партии выше по файлу) на следующем же тике таймера, отсюда и "моргание" бирки
        // прямо поверх кнопки "ВСКРЫТЬСЯ". Пока раунд идёт — этот метод вообще ничего не
        // трогает у обеих меток, оставляя их скрытыми до конца раунда.
        if(this._bjPlaying) return;
        const isFree = this._bjServerFree === true;
        if(this._bjFreeLbl){
            this._bjFreeLbl.visible = true;
            if(isFree){
                this._bjFreeLbl.text = 'БЕСПЛАТНО!';
            } else if(this._bjNextFreeAt){
                const left = Math.max(0, this._bjNextFreeAt - (Date.now() + (this._bjServerClockOffset || 0)));
                const sec = Math.ceil(left / 1000);
                const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
                const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
                const ss = String(sec % 60).padStart(2, '0');
                this._bjFreeLbl.text = left > 0 ? ('БЕСПЛАТНО ЧЕРЕЗ ' + hh + ':' + mm + ':' + ss) : 'БЕСПЛАТНО!';
            } else {
                this._bjFreeLbl.text = '';
            }
        }
        if(this._bjPriceSpr) this._bjPriceSpr.visible = !isFree;
    };

    proto._syncBlackjackDailyStatus = function(){
        if(!window.TS) return;
        TS.php('blackjack.status', {}, (res)=>{
            this._bjServerFree = !!res.isFree;
            this._bjNextFreeAt = Number(res.nextFreeAt) || 0;
            this._bjServerClockOffset = (Number(res.serverNow) || Date.now()) - Date.now();
            if(this._bjDailyTimer) clearInterval(this._bjDailyTimer);
            this._renderBlackjackDailyStatus();
            this._bjDailyTimer = setInterval(()=>{
                this._renderBlackjackDailyStatus();
                if(this._bjNextFreeAt && Date.now() + (this._bjServerClockOffset || 0) >= this._bjNextFreeAt){
                    clearInterval(this._bjDailyTimer); this._bjDailyTimer = null;
                    this._syncBlackjackDailyStatus();
                }
            }, 1000);

            // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/
            // перезагрузке, игра уничтожается"): status() уже вызывается при каждом открытии
            // экрана и теперь дополнительно сообщает активную раздачу (см. blackjack.php.status()).
            // this._bjPlaying живёт только в JS-памяти — при перезагрузке страницы/новой вкладке
            // он всегда false, даже если на сервере раздача ещё активна (деньги уже списаны).
            if(res.active && !this._bjPlaying) this._bjRestoreSession(res.active);
            this._updateBjPityTxt(res);
        });
    };

    // 25.09.2026 (по прямому указанию — "показывай сбоку количество игр до комбинации"):
    // res — любой ответ сервера, содержащий aa/aa_t/kk/kk_t/qq/qq_t (blackjack.status()
    // и blackjack.resolve() оба возвращают эти поля в одном и том же формате).
    proto._updateBjPityTxt = function(res){
        if(!res) return;
        if(this._bjPityAaTxt) this._bjPityAaTxt.text = 'До AA: ' + (parseInt(res.aa,10)||0) + '/' + (parseInt(res.aa_t,10)||0);
        if(this._bjPityKkTxt) this._bjPityKkTxt.text = 'До KK: ' + (parseInt(res.kk,10)||0) + '/' + (parseInt(res.kk_t,10)||0);
        if(this._bjPityQqTxt) this._bjPityQqTxt.text = 'До QQ: ' + (parseInt(res.qq,10)||0) + '/' + (parseInt(res.qq_t,10)||0);
    };

    // Восстанавливает незавершённую раздачу ровно в то же визуальное состояние, что и успешный
    // blackjack.deal — декоративные слоты 0/1 генерируются заново (чисто косметические, не
    // персистятся), реальные слоты 2/3 — из серверной active.hand.
    proto._bjRestoreSession = function(active){
        console.log('[dvor-blackjack._bjRestoreSession] найдена незавершённая раздача, восстанавливаю:', JSON.stringify(active));
        this._bjPlaying = true;
        if(this._bjFreeLbl)  this._bjFreeLbl.visible = false;
        if(this._bjPriceSpr) this._bjPriceSpr.visible = false;
        if(this._bjResultTxt) this._bjResultTxt.text = '';
        if(this._bjCigSpr) this._bjCigSpr.visible = false;
        if(this._bjComboHighlight){
            if(window.gsap) gsap.killTweensOf(this._bjComboHighlight);
            this._bjComboHighlight.visible = false;
            this._bjComboHighlight.alpha = 1;
        }
        if(this._bjPlayBtn) this._bjPlayBtn.visible = false;

        const [rank2, rank3] = active.hand;
        const card2 = {rank: rank2, suit: null};
        const card3 = {rank: rank3, suit: null};
        const card0 = dealDecorative([card2, card3]);
        const card1 = dealDecorative([card2, card3, card0]);
        this._bjHand = [card0, card1, card2, card3];
        this._bjSwapsLeft = Math.max(0, (parseInt(active.swapsAllowed,10)||0) - (parseInt(active.swapsUsed,10)||0));

        for(let i = 0; i < 4; i++){
            const spr = this._bjCardSprites[i];
            const card = this._bjHand[i];
            if(spr){
                spr.texture = PIXI.Texture.from('./images/' + card.rank + '.png?v=221');
                spr.width = 101; spr.height = 152; spr.visible = true;
                spr.interactive = false; spr.buttonMode = false; spr.alpha = 1;
            }
            if(this._bjSuitTexts[i]) this._bjSuitTexts[i].visible = false;
        }

        if(this._bjSwapsLeft > 0){
            this._activateSwapMode();
        } else {
            // Все смены уже были потрачены до перезагрузки, но резолв не успел выполниться —
            // подводим итог сразу, как и в обычном потоке (см. _swapBlackjackCard).
            this._resolveBlackjack();
        }
    };

    proto._playBlackjack = function(){
        if(this._bjPlaying || this._bjReqInFlight) return;

        this._bjReqInFlight = true;
        // 23.09.2026 (по прямому указанию — "залогируй вообще всё"): метка времени самого
        // КЛИКА (не ответа сервера) — независимая от памяти игрока проверка "подряд/быстро/
        // медленно", сверяется с microtime в debug-ответе сервера.
        console.log('[dvor-blackjack._playBlackjack] КЛИК раздать | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        // Баланс до сих пор меняется в нескольких старых модулях через udata и сохраняется
        // с debounce. Без флаша сервер мог прочитать прежний баланс (например 0), пока HUD уже
        // показывает полученные 20K, и отклонить платную партию кодом 84.
        flushPlayerSave('blackjack_deal', () => {
        console.log('[dvor-blackjack._playBlackjack] → сервер: blackjack.deal | coins после флаша:', udata['coins']);
        // 28.09.2026 (репорт — "опыт/уровень в азартных играх не сохраняется"): flushPlayerSave()
        // выше уже защищает от гонки СО СТОРОНЫ уже стоявшего в очереди сейва (см. коммент про
        // coins/код 84), но НЕ мешает НОВОМУ автосейву сработать, ПОКА сам blackjack.deal летит
        // туда-обратно — он пишет blackjack_session напрямую на сервере (Gameops::saveUser()),
        // тот же класс гонки, что уже чинили для poker.deal/dice.start. suspend/resume
        // перекрывают именно это окно.
        if(window.suspendPlayerSave) suspendPlayerSave('blackjack_deal');
        TS.php('blackjack.deal', {}, (res) => {
            this._bjReqInFlight = false;
            console.log('[dvor-blackjack._playBlackjack] ← ответ сервера:', JSON.stringify(res));
            logBlackjackDebug('_playBlackjack (deal)', res && res.debug);
            if(!res || !res.patch || !res.hand){
                console.error('[dvor-blackjack._playBlackjack] некорректный ответ сервера (нет patch/hand), раздача не начата:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('blackjack_deal');
                return;
            }
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('blackjack_deal');
            if(window.iface) iface.updateUp();
            udata['bj_games'] = (parseInt(udata['bj_games']||0)+1).toString();

            // Синхронизируем local-кэш "бесплатно сегодня" с ответом сервера — источник
            // истины теперь blackjack_session (сервер), это поле только для косметического
            // лейбла "БЕСПЛАТНО!" на кнопке (см. _updateBlackjackUI), реальное списание
            // проверяет только сервер.
            this._bjServerFree = false;
            this._bjNextFreeAt = Number(res.nextFreeAt) || this._bjNextFreeAt || 0;
            this._bjServerClockOffset = (Number(res.serverNow) || Date.now()) - Date.now();

            this._bjPlaying = true;

            // Скрываем лэйблы бесплатности
            if(this._bjFreeLbl)  this._bjFreeLbl.visible  = false;
            if(this._bjPriceSpr) this._bjPriceSpr.visible = false;

            // Скрываем карты
            for(let i = 0; i < 4; i++){
                if(this._bjCardSprites[i]){
                    this._bjCardSprites[i].visible    = false;
                    this._bjCardSprites[i].interactive= false;
                    this._bjCardSprites[i].alpha      = 1;
                }
                if(this._bjSuitTexts[i]) this._bjSuitTexts[i].visible = false;
            }
            if(this._bjResultTxt) this._bjResultTxt.text = '';
            if(this._bjCigSpr)   this._bjCigSpr.visible = false;
            if(this._bjComboHighlight){
                if(window.gsap) gsap.killTweensOf(this._bjComboHighlight);
                this._bjComboHighlight.visible = false;
                this._bjComboHighlight.alpha = 1;
            }

            // Слоты 2/3 — "настоящие" карты, честно розданные сервером (только они формируют
            // пару, включая гарантированный премиум, если порог пити уже выбит). Слоты 0/1 —
            // декоративные, ни на что не влияют, остаются на клиенте.
            const [rank2, rank3] = res.hand;
            const card2 = {rank: rank2, suit: null};
            const card3 = {rank: rank3, suit: null};
            const card0 = dealDecorative([card2, card3]);
            const card1 = dealDecorative([card2, card3, card0]);
            this._bjHand = [card0, card1, card2, card3];
            // 25.09.2026: если deal() вернул уже АКТИВНУЮ раздачу (res.resumed — сервер не стал
            // раздавать заново, см. blackjack.php.deal()), swapsUsed может быть >0.
            this._bjSwapsLeft = Math.max(0, (parseInt(res.swapsAllowed,10)||0) - (parseInt(res.swapsUsed,10)||0));

            // Анимация
            let fr = 0;
            const anim = setInterval(()=>{
                for(let i = 0; i < 4; i++){
                    if(this._bjCardSprites[i]){
                        this._bjCardSprites[i].texture = PIXI.Texture.from('./images/' + RANKS[Math.floor(Math.random()*8)] + '.png?v=221');
                        this._bjCardSprites[i].width = 101; this._bjCardSprites[i].height = 152;
                        this._bjCardSprites[i].visible = true;
                    }
                }
                if(++fr >= 10){
                    clearInterval(anim);
                    this._revealBlackjackCards();
                }
            }, 104);
        }, (err) => {
            this._bjReqInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('blackjack_deal');
            // Код 84 — недостаточно рублей (бесплатная попытка уже использована сегодня).
            if(err && err.code === 84){
                console.warn('[dvor-blackjack._playBlackjack] партия не начата: недостаточно рублей | ответ сервера:', JSON.stringify(err));
                if(window.iface) iface._openSidorovichError('Недостаточно рублей!', 'Нужно: 1 • У вас: ' + parseInt(udata['coins'] || 0));
            } else {
                console.error('[dvor-blackjack._playBlackjack] ← ошибка сервера:', JSON.stringify(err));
                if(window.notify) notify.showResult({text:'Не удалось начать партию'}, 0);
            }
        });
        });
    };

    proto._revealBlackjackCards = function(){
        const hand = this._bjHand;

        for(let i = 0; i < 4; i++){
            const card = hand[i];
            const spr  = this._bjCardSprites[i];
            const txt  = this._bjSuitTexts[i];
            if(spr){
                // 23.09.2026 (репорт "карты пропадают" — картинки грузятся битым URL вида
                // "u0434u0435..." вместо кириллицы или %D0%B4...): вся цепочка (каталог,
                // ответ сервера, JSON.parse, asset-version.js) проверена построчно и выглядит
                // чистой — не нашёл, где именно портится строка. Лог здесь ловит РЕАЛЬНОЕ
                // значение card.rank прямо перед сборкой URL — если тут уже испорчено, значит
                // проблема где-то ДО этой точки (сеть/парсинг); если тут чисто, а 404 всё равно
                // случается — проблема в самом PIXI.Texture.from()/asset-version.js или в
                // прокси VK (window_proxy.js, видно в консоли рядом с этой же ошибкой).
                console.log('[dvor-blackjack._revealBlackjackCards] карта', i, '| rank=', JSON.stringify(card.rank),
                    '| charCodes=', card.rank ? Array.from(card.rank).map(c => c.charCodeAt(0)) : null,
                    '| url=', './images/' + card.rank + '.png?v=221');
                // Защитная проверка — если rank не входит в известный список (порченая строка
                // из сети/ответа сервера), URL заведомо будет 404. Не чиним, но хотя бы громко
                // сигналим и не рисуем заведомо битую текстуру поверх карты.
                if(!RANKS.includes(card.rank)){
                    console.error('[dvor-blackjack._revealBlackjackCards] !!! card.rank НЕ входит в известный RANKS — вероятно порченая строка !!!', JSON.stringify(card.rank), RANKS);
                }
                spr.texture = PIXI.Texture.from('./images/' + card.rank + '.png?v=221');
                spr.width = 101; spr.height = 152;
                spr.visible = true;
            }
            if(txt){
                txt.visible = false;  // suit hidden
            }
        }

        // Кол-во доступных смен пришло от сервера при раздаче (this._bjSwapsLeft уже
        // выставлен в _playBlackjack из res.swapsAllowed).
        if(this._bjSwapsLeft > 0){
            this._activateSwapMode();
        } else {
            this._resolveBlackjack();
        }
    };

    proto._activateSwapMode = function(){
        // Смена возможна ТОЛЬКО на нижних картах (2/3 — единственные, что формируют
        // пару); верхние декоративные карты больше не участвуют в свапе вовсе.
        for(let i = 2; i <= 3; i++){
            const spr = this._bjCardSprites[i];
            if(!spr) continue;
            spr.interactive = true;
            spr.buttonMode  = true;
            spr.alpha = 1;
            spr.removeAllListeners('pointerdown');
            spr.removeAllListeners('pointerover');
            spr.removeAllListeners('pointerout');
            const idx = i;
            spr.on('pointerdown', ()=>this._swapBlackjackCard(idx));
            // Лёгкий ховер-эффект (полупрозрачность) вместо постоянной жёлтой рамки на
            // всё время смены — подсказывает кликабельность, не загромождая экран.
            spr.on('pointerover', ()=>{ spr.alpha = 0.7; });
            spr.on('pointerout',  ()=>{ spr.alpha = 1; });
        }
        for(let i = 0; i <= 1; i++){
            const spr = this._bjCardSprites[i];
            if(!spr) continue;
            spr.interactive = false;
            spr.buttonMode  = false;
            spr.removeAllListeners('pointerdown');
            spr.removeAllListeners('pointerover');
            spr.removeAllListeners('pointerout');
        }

        if(this._bjDoneBtn)  this._bjDoneBtn.visible  = true;
        if(this._bjPlayBtn)  this._bjPlayBtn.visible   = false;

        this._refreshSwapsDisplay();
    };

    proto._swapBlackjackCard = function(idx){
        if(this._bjSwapsLeft <= 0 || this._bjReqInFlight) return;

        // Смена доступна только для слотов 2/3 (формируют пару) — ЧЕСТНАЯ и случайная,
        // по прямому указанию: может сломать даже уже выбитую сменой гарантированную
        // пару (игрок реально рискует). Единственное, что по-прежнему запрещено —
        // случайно СОБРАТЬ чужую (не выбитую в этой партии) премиум-пару — иначе игрок
        // мог бы вручную "нафармить" AA/KK/QQ сменами, обходя скрытый порог. Вся эта
        // логика теперь на сервере (blackjack.php.swap()) — клиент лишь просит замену.
        this._bjReqInFlight = true;
        console.log('[dvor-blackjack._swapBlackjackCard] КЛИК смена idx=' + idx + ' | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        console.log('[dvor-blackjack._swapBlackjackCard] → сервер: blackjack.swap | idx:', idx);
        TS.php('blackjack.swap', {idx: idx}, (res) => {
            this._bjReqInFlight = false;
            console.log('[dvor-blackjack._swapBlackjackCard] ← ответ сервера:', JSON.stringify(res));
            logBlackjackDebug('_swapBlackjackCard (swap)', res && res.debug);
            if(!res || !res.rank){
                console.error('[dvor-blackjack._swapBlackjackCard] некорректный ответ сервера (нет rank), замена не применена:', JSON.stringify(res));
                return;
            }
            const authoritativeHand = Array.isArray(res.hand) && res.hand.length === 2
                ? res.hand : [this._bjHand[2].rank, this._bjHand[3].rank];
            if(!Array.isArray(res.hand)) authoritativeHand[idx - 2] = res.rank;
            // После каждой смены перерисовываем обе реальные карты из полной серверной руки.
            // Это устраняет рассинхронизацию, когда смена была сохранена, но локальный слот
            // продолжал показывать прежнюю текстуру.
            for(let realIdx = 2; realIdx <= 3; realIdx++){
                const rank = authoritativeHand[realIdx - 2];
                this._bjHand[realIdx] = {rank: rank, suit: null};
                const spr = this._bjCardSprites[realIdx];
                const txt = this._bjSuitTexts[realIdx];
                if(spr){
                    // 23.09.2026: см. тот же диагностический лог в _revealBlackjackCards —
                    // репорт "карты пропадают" именно при смене, ловим rank прямо из ответа
                    // сервера здесь тоже.
                    console.log('[dvor-blackjack._swapBlackjackCard] слот', realIdx, '| rank=', JSON.stringify(rank),
                        '| charCodes=', rank ? Array.from(rank).map(c => c.charCodeAt(0)) : null,
                        '| url=', './images/' + rank + '.png?v=221');
                    if(!RANKS.includes(rank)){
                        console.error('[dvor-blackjack._swapBlackjackCard] !!! rank НЕ входит в известный RANKS — вероятно порченая строка !!!', JSON.stringify(rank), RANKS);
                    }
                    spr.texture = PIXI.Texture.from('./images/' + rank + '.png?v=221');
                    spr.width = 101; spr.height = 152; spr.visible = true;
                }
                if(txt) txt.visible = false;
            }

            this._bjSwapsLeft = res.swapsLeft;
            this._refreshSwapsDisplay();

            if(this._bjSwapsLeft <= 0){
                this._bjFinishSwap();
            }
        }, (err) => {
            this._bjReqInFlight = false;
            console.error('[dvor-blackjack._swapBlackjackCard] ← ошибка сервера:', JSON.stringify(err));
            // Коды: 85 — нет активной раздачи, 86 — смены закончились. В обоих случаях
            // синхронизируем UI-состояние с реальностью на сервере.
            if(err && err.code === 86) this._bjSwapsLeft = 0;
            this._refreshSwapsDisplay();
        });
    };

    proto._refreshSwapsDisplay = function(){
        const lvl = this._getLevelInfo('cards').level;
        const maxSwaps = lvl >= 60 ? 2 : lvl >= 20 ? 1 : 0;
        if(this._bjSwapsTxt){
            this._bjSwapsTxt.text = 'Смен: ' + this._bjSwapsLeft + '/' + maxSwaps;
        }
    };

    proto._bjFinishSwap = function(){
        // 23.09.2026 (баг по репорту — "подсветка/готово не срабатывает, если Готово нажать
        // сразу после смены карты"): раньше guard _bjReqInFlight проверялся ТОЛЬКО внутри
        // _resolveBlackjack() — если игрок кликал ГОТОВО, пока предыдущий запрос blackjack.swap
        // ещё не вернул ответ, этот метод УЖЕ успевал отключить карты и спрятать кнопку ГОТОВО,
        // а вызванный следом _resolveBlackjack() молча выходил по guard'у и НИЧЕГО не отправлял
        // на сервер — игра зависала: финальная (честно свапнутая) пара оставалась на столе, но
        // highlight не показывался и нажать было больше нечего (ГОТОВО уже скрыта, карты
        // неинтерактивны). Теперь guard проверяется ДО отключения UI — клик по ГОТОВО во время
        // ещё летящего запроса просто игнорируется, кнопка и карты остаются как были, повторный
        // клик после ответа сервера на swap сработает нормально.
        if(this._bjReqInFlight) return;

        console.log('[dvor-blackjack._bjFinishSwap] КЛИК готово | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());

        // Отключаем карты
        for(let i = 0; i < 4; i++){
            const spr = this._bjCardSprites[i];
            if(!spr) continue;
            spr.interactive = false;
            spr.buttonMode  = false;
            spr.alpha = 1;
            spr.removeAllListeners('pointerover');
            spr.removeAllListeners('pointerout');
        }
        if(this._bjDoneBtn) this._bjDoneBtn.visible = false;
        this._resolveBlackjack();
    };

    proto._resolveBlackjack = function(){
        if(this._bjReqInFlight) return;
        this._bjReqInFlight = true;

        console.log('[dvor-blackjack._resolveBlackjack] → сервер: blackjack.resolve');
        TS.php('blackjack.resolve', {}, (res) => {
            this._bjReqInFlight = false;
            console.log('[dvor-blackjack._resolveBlackjack] ← ответ сервера:', JSON.stringify(res));
            logBlackjackDebug('_resolveBlackjack (resolve)', res && res.debug);
            if(!res || !res.patch){
                console.error('[dvor-blackjack._resolveBlackjack] некорректный ответ сервера (нет patch), итог не применён:', JSON.stringify(res));
                this._finishBlackjack(null);
                return;
            }
            applyPatch(res.patch);
            if(res.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function'){
                shmot._loadFromUdata();
            }
            if(window.iface) iface.updateUp();
            this._updateBjPityTxt(res);

            const bestRank = res.bestRank;

            // 22.09.2026 (по прямому указанию — "с каких пор вообще выводится попап награда в
            // играх во дворе, такого быть не должно, верни как было раньше — просто был
            // прямоугольник вокруг того, что выиграл игрок"): попап _showRewardPopup (введён
            // 19.09.2026 для пар БЕЗ шмотки, см. историю в git) убран целиком — единственная
            // обратная связь по результату раздачи снова только подсветка строки таблицы
            // (_bjShowComboHighlight), как и во всех остальных играх Двора (зарики/рулетка).
            if(this._bjResultTxt) this._bjResultTxt.text = '';
            this._bjShowComboHighlight(bestRank);

            // 22.09.2026 (батч по прямому указанию — "нужно окно награды шмотки при АА, КК,
            // QQ"): это НЕ тот общий попап на каждую раздачу, что убрали строкой выше — новый
            // отдельный попап показывается ТОЛЬКО на res.shmot===true (туз/король/дама, см.
            // blackjack_config.json payouts), переиспользует уже существующий общий
            // iface._showRewardPopup (используется ачивками/зоной/etc, поддерживает type:'shmot'
            // из коробки, см. shell/popups/reward.js ICON_MAP).
            if(res.shmot && window.iface && typeof iface._showRewardPopup === 'function'){
                const items = [];
                if(res.cigAmt)  items.push({type:'cigarettes', amount: res.cigAmt});
                if(res.respAmt) items.push({type:'respect',    amount: res.respAmt});
                if(res.expAmt)  items.push({type:'exp',        amount: res.expAmt});
                items.push({type:'shmot', amount: 1});
                iface._showRewardPopup(items);
            }

            this._finishBlackjack(bestRank);
        }, (err) => {
            this._bjReqInFlight = false;
            console.error('[dvor-blackjack._resolveBlackjack] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text:'Не удалось подвести итог партии'}, 0);
            this._finishBlackjack(null);
        });
    };

    proto._finishBlackjack = function(bestRank){
        this._addExp('cards', 1);

        this._bjPlaying = false;
        if(this._bjPlayBtn) this._bjPlayBtn.visible = true;
        this._updateBlackjackUI();
        if(window.achievements){
            const COMBO_CODE = { 'туз':'aa', 'король':'kk', 'дама':'qq', 'валет':'jj', 'десятка':'tt', 'девятка':'99', 'восьмерка':'88', 'семерка':'77' };
            achievements.onDvorGame('cards', { combo: bestRank ? COMBO_CODE[bestRank] : null });
        }
    };

    proto._closeBlackjackScreen = function(){
        if(this._blackjackWin && this._blackjackWin.parent) this._blackjackWin.parent.removeChild(this._blackjackWin);
        if(this._dvorWrap){ this._dvorWrap.alpha = 1; this._dvorWrap.interactiveChildren = true; }
    };
}
