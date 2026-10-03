import { applyPatch } from '../../modules/patch.js';

/** Зарики — построение нового экрана и экран покупки поинтов. */
export function attachDiceScreen(proto){

    proto._buildDiceScreen = function(){
        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 24.09.2026 (по прямому указанию — "затемнение фона у игр, чтобы Двор не просвечивал
        // по краям"): та же тёмная подложка на весь канвас, что уже есть у покера (dvor-poker-
        // screen.js) — здесь bg ниже и так покрывает канвас на 100% (705+15=720, без зазора),
        // но подложка добавлена для единообразия со всеми остальными играми Двора и как
        // защита на случай, если фон когда-нибудь снова временно подменят (см. историю правок
        // ниже — такое уже случалось 21-22.09.2026).
        const darkBg = new PIXI.Graphics();
        darkBg.beginFill(0x000000, 0.6);
        darkBg.drawRect(0, 0, 1280, 720);
        darkBg.endFill();
        win.addChild(darkBg);

        // 18.09.2026: новый фон от пользователя, файл уже подогнан под экран (1280×705,
        // без прозрачных полей — проверено), вставляется в нативном размере, без scale.
        // y=15, т.к. 705+15=720 — ровно вся высота холста, без зазора снизу.
        // 21.09.2026: фон был временно переключён на копию лобби "вкладка двор.png" (под именем
        // "зарики фон вкладка двор.png") — байт-в-байт та же картинка, что фон лобби Двора, без
        // печатной таблицы наград/правил зариков.
        // 22.09.2026 (баг найден по прямому указанию — "не выводится задний фон игры в зарики,
        // видна картинка лобби Двора"): возвращён правильный тематический фон "задний фон
        // зарики.png" (панель ЗАРИКИ с правилами + печатная таблица наград, под которую и
        // калибровались DICE_ROW_Y/DICE_ROW_X ниже — см. комментарий у DICE_ROW_Y). Файл
        // 1280×705, тот же нативный размер/y=15, что был снят 18.09.2026, уже в списке
        // предзагрузки (game-boot.js._allGamePngs) — просто нигде не рендерился с 21.09.2026.
        // 22.09.2026 (повторный репорт тем же днём — "выводится не тот фон зариков"): САМ файл
        // "задний фон зарики.png" был дефектным (серые прямоугольники-артефакты в правом верхнем
        // и правом нижнем углу + впечатанная красная "0" рядом с "ПОИНТЫ") — заменён содержимым
        // присланного пользователем эталона (C:\Users\HONOR\Desktop\vk_game\вкладка двор\зарики
        // страница.png, было 1365×768 RGB без альфы), передискретизирован в те же 1280×705
        // RGBA, что и раньше — имя файла и код рендера не менялись, только содержимое.
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'задний фон зарики новыйй.png'));
        bg.y = 15;
        win.addChild(bg);

        // Подсветка строки в напечатанной на фоне таблице наград (справа) — вместо
        // отдельного текстового результата. Координаты — приблизительные (сняты по
        // скриншоту фона, с учётом растяжения нативной картинки до 1280×690),
        // поправить точно через редактор позиций.
        const comboHighlight = new PIXI.Graphics();
        comboHighlight.visible = false;
        // Разрешаем универсальному редактору позиций хватать и двигать эту рамку —
        // обычно он видит только Sprite/Text, для произвольной Graphics нужен явный флаг.
        comboHighlight._uDraggable = true;
        win.addChild(comboHighlight);
        this._diceComboHighlight = comboHighlight;

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 90;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closeDiceScreen());
        win.addChild(exitBtn);

        // 27.09.2026 (по прямому указанию — "текст шансов до сих пор светится, убери его"):
        // панель "До Куша: N/N" (добавлена 25.09.2026) убрана из HUD зариков — игрок не должен
        // видеть служебный pity-счётчик. proto._updateDicePityTxt() оставлен как есть (у него
        // уже есть guard `if(!this._dicePityTxt) return;`) — без this._dicePityTxt он просто
        // безопасно ничего не делает, отдельно чистить вызовы не нужно.

        const levelTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        levelTxt.anchor.set(0.5, 0.5);
        levelTxt.x = 342; levelTxt.y = 113;
        win.addChild(levelTxt);
        this._diceLevelTxt = levelTxt;

        // Шкала уровня — тот же паттерн "фон + маска + тонированная копия", что и в
        // блэкджеке (см. dvor-blackjack.js: levelScale/levelFill/levelTrackLit), только
        // горизонтальная. x/y/w/h — из PSD-слоя нового ассета "шкала уровня зарики.png".
        const levelScale = new PIXI.Sprite(PIXI.Texture.from(BASE + 'шкала уровня зарики.png'));
        levelScale.x = 370; levelScale.y = 97;
        levelScale.width = 525; levelScale.height = 28;
        win.addChild(levelScale);
        this._diceLevelScale = levelScale;

        const barFill = new PIXI.Graphics();
        barFill.renderable = false;
        win.addChild(barFill);
        this._diceExpBarFill = barFill;

        const levelTrackLit = new PIXI.Sprite(PIXI.Texture.from(BASE + 'шкала уровня зарики.png'));
        levelTrackLit.x = 370; levelTrackLit.y = 97;
        levelTrackLit.width = 525; levelTrackLit.height = 28;
        levelTrackLit.tint = 0xffab2e;
        levelTrackLit.mask = barFill;
        levelTrackLit.visible = false;
        win.addChild(levelTrackLit);
        this._diceLevelTrackLit = levelTrackLit;

        const nextLvlTxt = new PIXI.Text('1', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        nextLvlTxt.anchor.set(0.5, 0.5);
        nextLvlTxt.x = 934; nextLvlTxt.y = 113;
        win.addChild(nextLvlTxt);
        this._diceNextLvlTxt = nextLvlTxt;

        const availTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:16, fill:'#ffcc44',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        availTxt.anchor.set(0.5, 0.5);
        availTxt.x = 807; availTxt.y = 144;
        win.addChild(availTxt);
        this._diceAvailTxt = availTxt;

        const pointsTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ff2222',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        pointsTxt.anchor.set(0.5, 0.5);
        // 19.09.2026: позиция/поворот сняты пользователем через редактор позиций.
        pointsTxt.x = 183; pointsTxt.y = 443; pointsTxt.rotation = 3 * Math.PI / 180;
        win.addChild(pointsTxt);
        this._dicePointsTxt = pointsTxt;

        const buyBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'зарики купить поинты.png'));
        buyBtn.anchor.set(0.5, 0.5);
        buyBtn.x = 195; buyBtn.y = 535;
        buyBtn.interactive = true; buyBtn.buttonMode = true;
        buyBtn.on('pointerover', ()=>{ _sa(buyBtn, 0.85); buyBtn.scale.set(1.08); });
        buyBtn.on('pointerout',  ()=>{ _sa(buyBtn, 1); buyBtn.scale.set(1); });
        buyBtn.on('pointerdown', ()=>this._openDiceBuyScreen());
        win.addChild(buyBtn);

        const DICE_POSITIONS = [
            {x:438, y:318}, {x:544, y:318},
            {x:650, y:318}, {x:756, y:318}
        ];
        const DICE_STYLE = {
            fontFamily:'Arial', fontSize:60, fill:'#ffffff', fontWeight:'bold',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2
        };
        this._diceDiceTexts   = [];
        this._diceDiceSprites = [];
        this._diceDiceHits    = [];
        // 25.09.2026 (по прямому указанию — "убери жёлтую рамку, кубик должен сам меняться
        // при выборе"): жёлтая рамка-обводка (PIXI.Graphics поверх кубика) убрана целиком;
        // выбор для переброса теперь показывает лёгкое покачивание самого кубика через gsap
        // (см. _diceSelectAnim/_diceDeselectAnim в dvor-dice-game.js).
        this._diceWobbleTweens = [];

        for(let i = 0; i < 4; i++){
            const pos = DICE_POSITIONS[i];

            const dieTxt = new PIXI.Text('?', DICE_STYLE);
            dieTxt.anchor.set(0.5, 0.5);
            dieTxt.x = pos.x; dieTxt.y = pos.y;
            dieTxt.visible = false;
            win.addChild(dieTxt);
            this._diceDiceTexts.push(dieTxt);

            const dieSpr = new PIXI.Sprite(PIXI.Texture.from('./images/зарики кости 1.png'));
            dieSpr.anchor.set(0.5, 0.5);
            dieSpr.x = pos.x; dieSpr.y = pos.y;
            dieSpr.width = 92; dieSpr.height = 92;
            dieSpr.visible = false;
            win.addChild(dieSpr);
            this._diceDiceSprites.push(dieSpr);

            const hit = new PIXI.Graphics();
            hit.beginFill(0xffffff, 0.001);
            hit.drawRect(pos.x - 46, pos.y - 46, 92, 92);
            hit.endFill();
            hit.interactive = false; hit.buttonMode = false;
            const _di = i;
            hit.on('pointerdown', ()=>this._toggleDiceSwap(_di));
            win.addChild(hit);
            this._diceDiceHits.push(hit);
        }

        const timerTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:17, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        timerTxt.anchor.set(0.5, 0.5);
        // 19.09.2026: позиция снята пользователем через редактор позиций (x не менялся,
        // y=461→468), цвет — белый в обоих состояниях (было зелёный/серый).
        timerTxt.x = 595; timerTxt.y = 468;
        win.addChild(timerTxt);
        this._diceTimerTxt = timerTxt;

        const throwBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'зарики кнопка бросить.png'));
        throwBtn.anchor.set(0.5, 0.5);
        throwBtn.x = 604; throwBtn.y = 523;
        throwBtn.interactive = true; throwBtn.buttonMode = true;
        throwBtn.on('pointerover', ()=>{ _sa(throwBtn, 0.85); throwBtn.scale.set(1.08); });
        throwBtn.on('pointerout',  ()=>{ _sa(throwBtn, 1); throwBtn.scale.set(1); });
        throwBtn.on('pointerdown', ()=>this._playDiceNewScreen());
        win.addChild(throwBtn);
        this._diceThrowBtn = throwBtn;

        // 25.09.2026 (по прямому указанию — новая тема кнопок "вскрытия" для азартных игр):
        // текстовая кнопка-Graphics (текст менялся между двумя надписями смены хода, см.
        // dvor-dice-game.js) заменена на sprite с новым арт-файлом "кнопка вскрыться для
        // игр.png" — текст уже "запечён" в картинке, отдельный PIXI.Text-лейбл больше не
        // нужен ни для одного из двух состояний. Позиция не менялась (604,523 — то же место,
        // что и БРОСИТЬ, они никогда не показываются одновременно).
        const confirmBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'кнопка вскрыться для игр.png'));
        confirmBtn.anchor.set(0.5, 0.5);
        confirmBtn.x = 604; confirmBtn.y = 523;
        confirmBtn.interactive = true; confirmBtn.buttonMode = true;
        confirmBtn.visible = false;
        confirmBtn.on('pointerover', ()=>{ _sa(confirmBtn, 0.85); confirmBtn.scale.set(1.08); });
        confirmBtn.on('pointerout',  ()=>{ _sa(confirmBtn, 1); confirmBtn.scale.set(1); });
        confirmBtn.on('pointerdown', ()=>this._diceConfirmNewScreen());
        win.addChild(confirmBtn);
        this._diceConfirmBtn = confirmBtn;

        this._diceWin = win;
        this._diceState = 0;
    };

    proto._openDiceBuyScreen = function(){
        if(this._diceBuyWin && this._diceBuyWin.parent) this._diceBuyWin.parent.removeChild(this._diceBuyWin);
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/зарики купить поинты страница.png'));
        bg.width = 1280; bg.height = 690; bg.y = 15;
        win.addChild(bg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 90;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>{
            win.parent && win.parent.removeChild(win);
            this._diceBuyWin = null;
            // Купленные поинты обновляли только текст ЗДЕСЬ, на экране покупки — счётчик
            // на основном экране зариков (_dicePointsTxt) не трогался и показывал старое
            // значение, пока игрок не выходил из Двора и не заходил заново.
            this._updateDiceScreenUI();
            if(window.iface) iface.restoreHud();
        });
        win.addChild(exitBtn);

        const ptsTxt = new PIXI.Text(String(parseInt(udata['dice_points']||0)), {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ff2222',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        ptsTxt.anchor.set(0.5, 0.5);
        ptsTxt.x = 453; ptsTxt.y = 547;
        win.addChild(ptsTxt);

        const PKG_COLS = [{x:548},{x:689},{x:832}];
        const PKG_ROWS = [{y:324},{y:498}];
        const PKGS = [
            {pts:10,  price:100,  img:'рулетка 100.png'},
            {pts:25,  price:250,  img:'рулетка 250.png'},
            {pts:55,  price:550,  img:'рулетка 550.png'},
            {pts:115, price:1150, img:'рулетка 1150.png'},
            {pts:250, price:2500, img:'рулетка 2500.png'},
            {pts:550, price:5500, img:'рулетка 5500.png'},
        ];
        const PKG_W = 152;

        let purchasePending = false;
        const buyDicePoints = (pkg)=>{
            if(purchasePending){
                console.log('[dvor-dice-screen.buyDicePoints] покупка уже сохраняется, повторный клик пропущен');
                return;
            }

            const coinsBefore = parseInt(udata['coins'] || 0);
            const pointsBefore = parseInt(udata['dice_points'] || 0);
            console.log('[dvor-dice-screen.buyDicePoints] попытка покупки | цена:', pkg.price, '| поинты:', pkg.pts, '| рублей:', coinsBefore, '| красных поинтов:', pointsBefore);

            if(coinsBefore < pkg.price){
                console.warn('[dvor-dice-screen.buyDicePoints] недостаточно рублей | нужно:', pkg.price, '| есть:', coinsBefore);
                if(window.iface) iface._openSidorovichError('Недостаточно рублей!', 'Нужно: ' + pkg.price + ' • У вас: ' + coinsBefore);
                return;
            }

            purchasePending = true;
            const coinsAfter = coinsBefore - pkg.price;
            const pointsAfter = pointsBefore + pkg.pts;
            udata['coins'] = coinsAfter.toString();
            udata['dice_points'] = pointsAfter.toString();
            ptsTxt.text = udata['dice_points'];
            if(window.iface) iface.updateUp();

            if(!window.TS || typeof TS.php !== 'function'){
                udata['coins'] = coinsBefore.toString();
                udata['dice_points'] = pointsBefore.toString();
                ptsTxt.text = udata['dice_points'];
                purchasePending = false;
                if(window.iface){
                    iface.updateUp();
                    iface._openSidorovichError('Покупка не сохранена', 'Сервер игры недоступен');
                }
                console.error('[dvor-dice-screen.buyDicePoints] TS.php недоступен, покупка отменена');
                return;
            }

            // 26.09.2026 (по прямому указанию — аудит "покупка поинтов зариков напрямую вызывает
            // users.save"): раньше здесь был общий whitelist-эндпоинт users.save, которому
            // передавалось уже оптимистично посчитанное udata целиком — сервер верил присланным
            // coins/dice_points без проверки, читер мог накрутить любое число поинтов, просто
            // отредактировав udata перед вызовом. Теперь считает и проверяет ТОЛЬКО сервер
            // (dice.php.buyPoints() — таблица цены в dice_config.json.buy_points), клиент шлёт
            // только индекс пакета, а не итоговые суммы. Ответ применяется через applyPatch(),
            // не ручным присвоением полей (см. модуль patch.js / ПРАВИЛО №9 CLAUDE.md).
            const pkgIdx = PKGS.indexOf(pkg);
            TS.php('dice.buyPoints', {pkg_idx: pkgIdx}, (result)=>{
                purchasePending = false;
                if(result && result.patch) applyPatch(result.patch);
                ptsTxt.text = String(parseInt(udata['dice_points'] || pointsAfter));
                if(window.iface) iface.updateUp();
                console.log('[dvor-dice-screen.buyDicePoints] покупка подтверждена сервером | pkg_idx:', pkgIdx, '| цена:', pkg.price, '| получено поинтов:', pkg.pts, '| результат:', result);
            }, (error)=>{
                if(parseInt(udata['coins'] || 0) === coinsAfter && parseInt(udata['dice_points'] || 0) === pointsAfter){
                    udata['coins'] = coinsBefore.toString();
                    udata['dice_points'] = pointsBefore.toString();
                }
                purchasePending = false;
                ptsTxt.text = String(parseInt(udata['dice_points'] || 0));
                if(window.iface){
                    iface.updateUp();
                    iface._openSidorovichError('Покупка не сохранена', 'Попробуйте ещё раз');
                }
                console.error('[dvor-dice-screen.buyDicePoints] ошибка сохранения, покупка отменена | цена:', pkg.price, '| поинты:', pkg.pts, '| ошибка:', error);
            });
        };

        PKGS.forEach((pkg, idx)=>{
            const col = idx % 3, row = Math.floor(idx / 3);
            const hx = PKG_COLS[col].x, hy = PKG_ROWS[row].y;
            const card = new PIXI.Sprite(PIXI.Texture.from('./images/' + pkg.img));
            card.anchor.set(0.5, 0);
            card.x = hx + PKG_W/2; card.y = hy;
            card.interactive = true; card.buttonMode = true;
            card.on('pointerover', ()=>{ _sa(card, 0.85); card.scale.set(1.08); });
            card.on('pointerout',  ()=>{ _sa(card, 1); card.scale.set(1); });
            card.on('pointerdown', ()=>buyDicePoints(pkg));
            win.addChild(card);
            // 26.09.2026 (по прямому указанию, скриншот — "убери иконки рублей с попапа
            // покупки поинтов"): раньше здесь стояла отдельная оверлей-иконка "монеты
            // эмблема.png" поверх каждой карточки — сама карточка (pkg.img) уже содержит
            // готовую отрисованную цену/валюту художника, отдельная иконка была лишней и на
            // одной из карточек рендерилась битой текстурой. Убрана целиком.
        });

        this._diceBuyWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };

    // Y-центр каждой из 18 строк таблицы наград, напечатанной на фоне (справа) — в том же
    // порядке, что и TABLE в dvor-dice-game.js (v:6×n4,n3,n2, v:5×..., ...).
    // 18.09.2026: фон сменился на "задний фон зарики.png" — координаты ниже сняты по СТАРОЙ
    // картинке ("зарики страница.png") и почти наверняка не совпадут с таблицей на новом фоне
    // построчно — нужно перепроверить/подвинуть через редактор позиций после деплоя.
    // Строки идут группами по 3 (n4/n3/n2 одного значения кубика). Точные замеры через
    // редактор позиций по факту НОВОЙ картинки (с 6-й группой): верхняя строка (4×6) —
    // база 152 (было 147, +5 по прямой правке — проверено на строке "2×4 → +2000 сигарет",
    // индекс 8: редактор показал y:334 при формуле 329, сдвиг применён ко ВСЕМ строкам
    // одинаково, относительный шаг внутри/между групп не менялся), шаг внутри группы —
    // 22px, шаг через черточку-разделитель между группами (напр. "2×6" → "4×5") — 27px.
    // 22.09.2026: после возврата фона на "задний фон зарики.png" (см. bg выше) эта калибровка
    // снова актуальна — она и была снята под эту же картинку, просто фон временно подменялся
    // на другую (21.09.2026), не сами координаты.
    //
    // 22.09.2026 (повторный репорт тем же днём, по прямому указанию — "пытался сделать
    // алгоритм... не получается, лучше поточечно"): формула (152 + шаг 22/27) заменена на
    // ЯВНЫЙ массив — 18 отдельных чисел, по одному на строку таблицы (тот же порядок, что
    // TABLE в dvor-dice-game.js), чтобы любую конкретную строку можно было поправить точечно,
    // не трогая формулу и не сдвигая остальные 17.
    //
    // ⚠️ Пользователь прислал ~15 скриншотов редактора позиций с координатами каждой строки —
    // НЕ смог надёжно сопоставить каждое число с конкретной строкой: показанные в скриншотах
    // значения (например x:-39 y:-9, ..., y:-374) отрицательные и не попадают в диапазон самой
    // таблицы (152-551) — похоже, они сняты относительно ДРУГОЙ точки отсчёта (например
    // относительно места клика/якоря создания бокса в редакторе), а не как абсолютная позиция
    // на холсте, как это обычно бывает у других объектов в этом проекте.
    // 22.09.2026: перекалибровано по двум НОВЫМ, явно подписанным скриншотам редактора позиций
    // ("3×6" и "4×6") — прежний массив был получен переносом старой формулы (152, +22/+27) без
    // подтверждённой привязки к конкретным строкам. Новые точки: 3×6 (idx1, "100 рублей") дали
    // raw y=-397, 4×6 (idx0, "Шмотка") дали raw y=-420 — линейное преобразование true_y=raw_y+572
    // применено ко всем 18 старым замерам и перепроверено по внутригрупповому шагу (22-23px)
    // и межгрупповому шагу через разделитель (27-29px), см.
    // blackjack-combo-highlight-point-data-and-error-popup-position.test.js.
    const DICE_ROW_Y = [
        152, // 0: 4×6 — Шмотка 5шт
        175, // 1: 3×6 — 100 рублей
        198, // 2: 2×6 — 10.000 сигарет
        226, // 3: 4×5 — 50 рублей
        248, // 4: 3×5 — 5.000 сигарет
        271, // 5: 2×5 — 2 поинта
        299, // 6: 4×4 — 10 автоматов
        322, // 7: 3×4 — 10 стволов
        344, // 8: 2×4 — 2000 сигарет
        373, // 9: 4×3 — 10 мачете
        396, // 10: 3×3 — 1000 опыта
        418, // 11: 2×3 — 25 рублей
        446, // 12: 4×2 — 2 автомат
        468, // 13: 3×2 — 1 автомат
        491, // 14: 2×2 — 500 опыта
        518, // 15: 4×1 — 1000 сигарет
        540, // 16: 3×1 — 250 опыта
        563, // 17: 2×1 — 500 сигарет
    ];
    // DICE_ROW_X: было 873, +7 по той же правке (та же строка индекс 8: редактор x:1009
    // при формуле 1002). DICE_ROW_H: было 20, +3 по прямому указанию.
    const DICE_ROW_X = 880, DICE_ROW_W = 258, DICE_ROW_H = 23;

    // rowIndex — либо один номер строки, либо массив номеров (несколько одновременных
    // комбинаций, напр. 1,1,6,6 — пара по 1 И пара по 6 сразу, см. dvor-dice-game.js).
    proto._diceShowComboHighlight = function(rowIndex){
        const h = this._diceComboHighlight;
        if(!h) return;
        const indices = (Array.isArray(rowIndex) ? rowIndex : [rowIndex]).filter(i => i >= 0 && i < DICE_ROW_Y.length);
        if(!indices.length){ h.visible = false; return; }
        // Раньше h.position.set(cx,cy) двигал ОДИН прямоугольник в центр нужной строки —
        // теперь рисуем НЕСКОЛЬКО прямоугольников прямо в координатах DICE_ROW_X/Y (без
        // сдвига через position), h.position остаётся (0,0) — эффект тот же для одной
        // строки, но позволяет подсветить сразу несколько строк одним объектом.
        h.position.set(0, 0);
        h.clear();
        h.lineStyle(3, 0xffdd44, 1);
        h.beginFill(0xffdd44, 0.18);
        const cx = DICE_ROW_X + DICE_ROW_W / 2;
        indices.forEach(idx => {
            const cy = DICE_ROW_Y[idx] - 4;
            h.drawRoundedRect(cx - DICE_ROW_W / 2, cy - DICE_ROW_H / 2, DICE_ROW_W, DICE_ROW_H, 5);
        });
        h.endFill();
        h.visible = true;
        h.alpha = 1;
        // По прямому указанию — подсветка должна оставаться видна ДО следующего броска
        // (кнопка БРОСИТЬ, см. _playDiceNewScreen), а не гаснуть сама по таймеру через
        // ~3 секунды. Пульс при появлении оставлен (акцент на результате), но в конце
        // возвращается к alpha:1, а не к invisible — h.visible гасится явно только из
        // _playDiceNewScreen при старте новой партии.
        if(window.gsap){
            gsap.killTweensOf(h);
            gsap.timeline()
                .to(h, {alpha:0.35, duration:0.35, repeat:3, yoyo:true})
                .to(h, {alpha:1, duration:0.3});
        }
    };

}
