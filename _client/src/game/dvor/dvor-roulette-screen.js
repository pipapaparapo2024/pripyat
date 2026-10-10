/** Рулетка — построение нового экрана, анимация колеса, разрешение результата. */
export function attachRouletteScreen(proto){

    proto._buildRouletteScreen = function(){
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
        // screen.js) — гарантирует тёмный фон независимо от того, покрывает ли bg ниже канвас
        // на 100% (у рулетки bg.y=15 оставляет полоску сверху непокрытой).
        const darkBg = new PIXI.Graphics();
        darkBg.beginFill(0x000000, 0.6);
        darkBg.drawRect(0, 0, 1280, 720);
        darkBg.endFill();
        win.addChild(darkBg);

        // Новый лист рулетки предоставлен отдельным PNG и должен стоять в нативном размере
        // ровно по координатам редактора пользователя, без растяжения.
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка новая страница.png'));
        bg.x = 327; bg.y = 77;

        const openDescription = (file) => {
            const overlay = new PIXI.Container();
            const close = () => { if(overlay.parent) overlay.parent.removeChild(overlay); };
            overlay.addChild(window._makeModalDimmer(close, 0.55));
            const detail = new PIXI.Sprite(PIXI.Texture.from(BASE + file));
            detail.x = 80; detail.y = 160;
            detail.interactive = true;
            overlay.addChild(detail);
            root.layer2_mc.addChild(overlay);
        };
        const addDescriptionButton = (file, x, y, detailFile) => {
            const button = new PIXI.Sprite(PIXI.Texture.from(BASE + file));
            button.x = x; button.y = y;
            button.interactive = true; button.buttonMode = true;
            button.on('pointerover', () => window._ss(button, 1.03));
            button.on('pointerout', () => window._ss(button, 1));
            button.on('pointerdown', () => openDescription(detailFile));
            win.addChild(button);
        };
        addDescriptionButton('рулетка описание.png', 32, 99, 'рулетка описание клик.png');
        addDescriptionButton('опыт и уровни описание.png', 967, 153, 'опыт и уровни описание клик.png');
        // Обе карточки-описания должны лежать ПОД новым листом рулетки: его прозрачные
        // области открывают текст, а непрозрачная центральная часть не перекрывается ими.
        win.addChild(bg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 90;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closeRouletteScreen());
        win.addChild(exitBtn);

        // 30.09.2026 (третий заход в тот же день — диагностика на экране доказала: загруженная
        // текстура НЕ совпадала ни с одним файлом на диске, хотя ?cb=2/?cb=3 честно менял URL и
        // сервер отдавал верный файл с no-cache). Значит кэш живёт МЕЖДУ сервером и игрой, вне
        // нашего контроля (похоже на собственный прокси/CDN ВК для мини-приложений внутри
        // second_wave/window_proxy — виден в консоли, не реагирует на смену query-параметра).
        // Единственный гарантированный способ обойти такой кэш — сменить сам ПУТЬ файла, не
        // только query: переименовано в "рулетка колесо v2.png" (реальный файл на диске тоже
        // переименован, см. upload.sh при деплое).
        const wheelUrl = BASE + 'рулетка колесо v2.png';
        const wheelTex = PIXI.Texture.from(wheelUrl);
        const wheelSpr = new PIXI.Sprite(wheelTex);
        wheelSpr.anchor.set(0.5, 0.5);
        wheelSpr.x = 541; wheelSpr.y = 322;
        wheelSpr.width = 370; wheelSpr.height = 363;
        win.addChild(wheelSpr);
        this._roulWheelSpr = wheelSpr;

        // 23.09.2026 (по прямому указанию — "убери подсвечивание для игры рулетку"): жёлтый
        // клин-подсветка сектора (sectorHighlight, мигал после остановки колеса) убран целиком.
        const arrowSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка стрелка.png'));
        arrowSpr.anchor.set(0.5, 0.5);
        arrowSpr.x = 712; arrowSpr.y = 323;
        arrowSpr.width = 40; arrowSpr.height = 30;
        arrowSpr.rotation = 0;
        win.addChild(arrowSpr);
        this._roulArrowSpr = arrowSpr;
        this._roulWheelDeg = 0;

        // 22.09.2026 (по прямому указанию, координаты сняты редактором позиций через
        // "БОКС ДЛЯ ТЕКСТА"): джекпот и ник победителя центрируются в размеченных боксах через
        // window._centerTextIn (ui_kit.js) вместо ручного anchor+x/y.
        const jackTxt = new PIXI.Text('3 000', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#f5c842',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2, fontWeight:'bold'
        });
        // 03.10.2026 (по прямому указанию — "текст кол-во джекпота поднять вверх на 13px"): было y:216.
        window._centerTextIn(jackTxt, {x:748, y:203, w:152, h:42});
        win.addChild(jackTxt);
        this._roulJackTxt = jackTxt;

        // 27.09.2026 (по прямому указанию — "текст шансов до сих пор светится, убери его"):
        // панель "До джекпота: N/N" (добавлена 25.09.2026) убрана из HUD рулетки. proto.
        // _updateRoulettePityTxt() оставлен как есть — у него уже есть guard
        // `if(!this._roulPityTxt || !res) return;`, без this._roulPityTxt он просто ничего
        // не делает, отдельно чистить вызовы не нужно.

        const winnerNameTxt = new PIXI.Text('—', {
            fontFamily:'Southbank LT', fontSize:15, fill:'#e8d8b0',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        // 23.09.2026 (уточнено редактором позиций, по прямому указанию): было {x:794,y:285,
        // w:152,h:42}, стало {x:794,y:288,w:152,h:31}.
        // 03.10.2026 (по прямому указанию — "имя игрока что выбил куш поднять на 10px вверх").
        window._centerTextIn(winnerNameTxt, {x:794, y:278, w:152, h:31});
        win.addChild(winnerNameTxt);
        this._roulWinnerNameTxt = winnerNameTxt;

        const winnerAmtTxt = new PIXI.Text('—', {
            fontFamily:'Southbank LT', fontSize:16, fill:'#f5c842',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1, fontWeight:'bold'
        });
        // Бокс размечен редактором позиций: сумма сорванного куша всегда центрируется
        // внутри него, независимо от количества цифр.
        // 03.10.2026 (по прямому указанию — "текст кол-во куша справа от «сорвал куш» поднять
        // вверх на 12px").
        window._centerTextIn(winnerAmtTxt, {x:848, y:320, w:104, h:23});
        win.addChild(winnerAmtTxt);
        this._roulWinnerAmtTxt = winnerAmtTxt;

        // 03.10.2026 (по прямому указанию — старый файл-заглушка иконки сталкера удалён с
        // сервера, выводить его нигде не нужно): заглушка-иконка убрана целиком (была добавлена
        // 23.09.2026 как placeholder "чтобы видно было окно/размер"). Теперь до резолва
        // настоящего фото победителя по VK id спрайт пустой и невидимый — ничего не
        // показывается, фото появляется, только когда реально резолвится (см. dvor-roulette.js).
        // 10.10.2026 (по прямому указанию, редактор позиций — новое расположение иконки
        // победителя джекпота): было x:739,y:279,47×42 → стало x:741,y:265,44×44 (квадрат).
        const winnerPhotoSpr = new PIXI.Sprite(PIXI.Texture.EMPTY);
        winnerPhotoSpr.width = 44; winnerPhotoSpr.height = 44;
        winnerPhotoSpr.x = 741; winnerPhotoSpr.y = 265;
        winnerPhotoSpr.visible = false;
        // 22.09.2026 (по прямому указанию): помечен _uDraggable — универсальный редактор позиций
        // по умолчанию хит-тестит только интерактивные объекты, без флага плейсхолдер не найти.
        winnerPhotoSpr._uDraggable = true;
        win.addChild(winnerPhotoSpr);
        this._roulWinnerPhotoSpr = winnerPhotoSpr;

        const ptsTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:20, fill:'#7fb8ff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1, fontWeight:'bold'
        });
        ptsTxt.anchor.set(0, 0.5);
        ptsTxt.x = 822; ptsTxt.y = 386;
        win.addChild(ptsTxt);
        this._roulPtsTxt = ptsTxt;

        const buyPlusBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка покупка поинтов.png'));
        buyPlusBtn.anchor.set(0.5, 0.5);
        buyPlusBtn.scale.set(0.85);
        // 03.10.2026 (редактор позиций, новое расположение): было y:396.
        buyPlusBtn.x = 922; buyPlusBtn.y = 376;
        buyPlusBtn.interactive = true; buyPlusBtn.buttonMode = true;
        buyPlusBtn.on('pointerover', ()=>{ _sa(buyPlusBtn, 0.8); buyPlusBtn.scale.set(0.918); });
        buyPlusBtn.on('pointerout', ()=>{ _sa(buyPlusBtn, 1); buyPlusBtn.scale.set(0.85); });
        buyPlusBtn.on('pointerdown', ()=>this._openRouletteBuyScreen());
        win.addChild(buyPlusBtn);

        const spichTxt = new PIXI.Text('0 СПИЧЕК', {
            fontFamily:'Southbank LT', fontSize:18, fill:'#7fb8ff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1, fontWeight:'bold'
        });
        spichTxt.anchor.set(0, 0.5);
        spichTxt.x = 775; spichTxt.y = 444;
        win.addChild(spichTxt);
        this._roulSpichTxt = spichTxt;

        const spinBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка кнопка крутить.png'));
        spinBtn.anchor.set(0.5, 0.5);
        // 03.10.2026 (редактор позиций, новое расположение): было y:528.
        spinBtn.x = 848; spinBtn.y = 515;
        spinBtn.interactive = true; spinBtn.buttonMode = true;
        spinBtn.on('pointerover', ()=>{ if(!this._roulSpinning) spinBtn.alpha = 0.85; });
        spinBtn.on('pointerout', ()=>{ _sa(spinBtn, 1); });
        spinBtn.on('pointerdown', ()=>this._spinRoulette());
        win.addChild(spinBtn);
        this._roulSpinBtn = spinBtn;

        const openBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка открыть кейс.png'));
        openBtn.anchor.set(0.5, 0.5);
        // 03.10.2026 (редактор позиций, новое расположение): было x:686, y:518.
        openBtn.x = 676; openBtn.y = 520;
        openBtn.interactive = true; openBtn.buttonMode = true;
        openBtn.on('pointerover', ()=>{ _sa(openBtn, 0.85); openBtn.scale.set(1.08); });
        openBtn.on('pointerout', ()=>{ _sa(openBtn, 1); openBtn.scale.set(1); });
        openBtn.on('pointerdown', ()=>this._openRouletteCaseScreen());
        win.addChild(openBtn);

        this._roulAutoOn = false;

        const autoCheckbox = new PIXI.Graphics();
        autoCheckbox.beginFill(0x2a1e0a, 0.9);
        autoCheckbox.drawRect(0, 0, 28, 28);
        autoCheckbox.endFill();
        autoCheckbox.lineStyle(2, 0x6e5430);
        autoCheckbox.drawRect(0, 0, 28, 28);
        // 03.10.2026 (редактор позиций): было y:547.
        autoCheckbox.x = 894; autoCheckbox.y = 559;
        autoCheckbox.scale.set(0.5);
        autoCheckbox.alpha = 0;
        autoCheckbox.interactive = true; autoCheckbox.buttonMode = true;
        win.addChild(autoCheckbox);
        this._roulAutoCheckbox = autoCheckbox;

        const autoTick = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка галочка автоматически.png'));
        autoTick.anchor.set(0.5, 0.5);
        // 04.10.2026 (по прямому указанию, редактор позиций — x:902 y:565 scale:1.000 w:15 h:14):
        // снова своя явная позиция, не завязана на autoCheckbox.x/y (03.10.2026 эта привязка
        // чуть промахнулась визуально).
        autoTick.x = 902; autoTick.y = 565;
        autoTick.visible = false;
        win.addChild(autoTick);
        this._roulAutoTick = autoTick;

        autoCheckbox.on('pointerdown', ()=>{
            this._roulAutoOn = !this._roulAutoOn;
            this._roulAutoTick.visible = this._roulAutoOn;
        });

        const resultTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2
        });
        resultTxt.anchor.set(0.5, 0.5);
        resultTxt.x = 548; resultTxt.y = 555;
        win.addChild(resultTxt);
        this._roulResultTxt = resultTxt;

        const levelFrame = new PIXI.Sprite(PIXI.Texture.from(BASE + 'уровень фон.png'));
        levelFrame.position.set(967, 76);
        win.addChild(levelFrame);
        const levelTrack = new PIXI.Sprite(PIXI.Texture.from(BASE + 'уровень игры.png'));
        levelTrack.position.set(977, 125);
        win.addChild(levelTrack);

        // Маска-геометрия заполнения — сама НЕ рисуется (renderable=false), только задаёт
        // форму видимой области для levelTrackLit ниже. Геометрия/поворот те же, что раньше
        // рисовал плоский полупрозрачный прямоугольник поверх линейки.
        const roulLvlMask = new PIXI.Graphics();
        roulLvlMask.renderable = false;
        win.addChild(roulLvlMask);
        this._roulLvlBarFill = roulLvlMask;

        // "Подсвеченная" копия той же самой картинки линейки (тот же рисунок, деления,
        // текстура дерева), просто тонированная — замаскированная часть выглядит так,
        // будто закрашивается сама картинка, а не будто сверху лежит плоский цветной блок.
        const levelTrackLit = new PIXI.Sprite(PIXI.Texture.from(BASE + 'уровень игры.png'));
        levelTrackLit.position.set(977, 125);
        levelTrackLit.tint = 0xffab2e;
        levelTrackLit.mask = roulLvlMask;
        levelTrackLit.visible = false;
        win.addChild(levelTrackLit);
        this._roulLvlLitSpr = levelTrackLit;

        const roulLvlTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:17, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        roulLvlTxt.anchor.set(0.5, 0.5);
        roulLvlTxt.x = 992; roulLvlTxt.y = 101;
        win.addChild(roulLvlTxt);
        this._roulLvlTxt = roulLvlTxt;

        const roulNextLvlTxt = new PIXI.Text('1', {
            fontFamily:'Southbank LT', fontSize:16, fill:'#ffffff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        roulNextLvlTxt.anchor.set(0.5, 0.5);
        roulNextLvlTxt.x = 988; roulNextLvlTxt.y = 560;
        win.addChild(roulNextLvlTxt);
        this._roulNextLvlTxt = roulNextLvlTxt;

        this._roulWin = win;
        this._roulSpinning = false;
    };

    proto._animRouletteWheel = function(targetIdx, onComplete){
        if(this._roulResultTxt) this._roulResultTxt.text = '';
        // 360/15 — на арте колеса физически 15 равных секторов (не 16, см. _resolveRouletteNewScreen),
        // это и было корнем систематического расхождения "маркер стоит на одном секторе, награда —
        // за соседний" при 22.5° (360/16).
        const SEG = 24;
        // В исходном колесе сектор 5 (индекс 4) уже смотрит на правую стрелку.
        // Поворачиваем колесо так, чтобы центр выбранного сектора совпал со стрелкой.
        // ИСТОРИЯ: несколько прошлых попыток калибровки (+1 к индексу, потом его отмена) не
        // помогали до конца — корень оказался в том, что колесо физически имеет 15 секторов,
        // а формула считала 16 (SEG=22.5). Теперь SEG=24 (360/15) — сектор 4 как якорь этой
        // правки не касается (сдвинут только сектор "11", которого на арте и не было).
        const slotAtPointer = (90 - targetIdx * SEG + 360) % 360;
        const fullRotations = 7 + Math.floor(Math.random() * 4);
        const startDeg = this._roulWheelDeg || 0;
        const startDegMod = ((startDeg % 360) + 360) % 360;
        let extra = slotAtPointer - startDegMod;
        if(extra < 0) extra += 360;
        const totalDeg = fullRotations * 360 + extra;
        const finalDeg = startDeg + totalDeg;
        const duration = 4000;
        const startTime = performance.now();

        const tick = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - t, 4);
            const cur = startDeg + totalDeg * eased;
            this._roulWheelDeg = cur;
            if(this._roulWheelSpr) this._roulWheelSpr.rotation = cur * Math.PI / 180;
            if(t < 1){
                requestAnimationFrame(tick);
            } else {
                this._roulWheelDeg = finalDeg;
                if(this._roulWheelSpr) this._roulWheelSpr.rotation = finalDeg * Math.PI / 180;
                onComplete();
            }
        };
        requestAnimationFrame(tick);
    };

    // 23.09.2026 (перенос награды обычного спина на сервер — см. roulette.php.spin()/
    // _rollSlot()): reward/clientRewards теперь приходят от сервера (уже начислены/провалидны),
    // эта функция ТОЛЬКО отображает результат — не решает сама, что выдать. SLOTS ниже остался
    // только как таблица ПОДПИСЕЙ (lbl) по индексу — idx теперь авторитетный (от сервера), не
    // выбирается на клиенте, поэтому использовать его для текста безопасно.
    // 23.09.2026 (по прямому указанию — "убери подсвечивание для игры рулетку"): мигающий
    // жёлтый клин-подсветка сектора убран целиком (был здесь, см. историю выше в файле).
    proto._resolveRouletteNewScreen = function(idx, isJack, reward, clientRewards){
        // После остановки выбранный сектор находится у неподвижной стрелки справа.
        // 15 слотов — РОВНО столько физических секторов на арте колеса (рулетка колесо.png).
        // Художник заменил картинку 14.09.2026 — перенумеровал сектора подряд 1-15 (раньше
        // подписи шли 1-10,12-16, пропуская несуществующий "11" — оттуда когда-то и взялось
        // системное расхождение "маркер на одном секторе, награда — с соседнего"). Сама
        // последовательность наград по позициям на круге НЕ изменилась (сверено вручную по
        // новому файлу) — порядок SLOTS ниже по-прежнему совпадает 1-в-1 с картинкой.
        const SLOTS = [
            {lbl:'Связка ключей',   type:'key_bundle',       amt:1,     sp:0},
            {lbl:'+2 синих поинта', type:'blue_points',      amt:2,     sp:0},
            {lbl:'+40 спичек',      type:'roulette_spichki', amt:40,    sp:40},
            {lbl:'+1 автомат',      type:'auto',             amt:1,     sp:0},
            {lbl:'+10 спичек',      type:'roulette_spichki', amt:10,    sp:10},
            {lbl:'+10000 опыта',    type:'exp',              amt:10000, sp:0},
            {lbl:'+20 спичек',      type:'roulette_spichki', amt:20,    sp:20},
            {lbl:'+1 ствол',        type:'gun',              amt:1,     sp:0},
            {lbl:'+1000 сигарет',   type:'cig',              amt:1000,  sp:0},
            {lbl:'+50 спичек',      type:'roulette_spichki', amt:50,    sp:50},
            {lbl:'+20р',            type:'coins',            amt:20,    sp:0},
            {lbl:'+10р',            type:'coins',            amt:10,    sp:0},
            {lbl:'СУПЕРПРИЗ!',      type:'super',            amt:500,   sp:0},
            {lbl:'+30 спичек',      type:'roulette_spichki', amt:30,    sp:30},
            {lbl:'+10000 опыта',    type:'exp',              amt:10000, sp:0},
        ];
        const slot = SLOTS[idx];

        if(slot.type === 'super'){
            // Гарантированный приз фиксирован; накопленный куш разыгрывается в суперигре.
            if(this._roulResultTxt) this._roulResultTxt.text = '';
            // 25.09.2026 (по прямому указанию — "ник победителя показывается повреждённым/
            // СТАЛКЕР"): запись roulette_winner убрана отсюда целиком — раньше она срабатывала
            // ЗДЕСЬ, просто при попадании на сектор (ДО того, как игрок решил забрать 500р или
            // рискнуть в суперигре — т.е. "победитель" фиксировался даже если игрок в итоге
            // ничего не забрал), и писала JSON.stringify() напрямую в client-writable
            // udata['roulette_winner'] без гарантии кодировки кириллицы при round-trip через
            // БД. Теперь roulette.claimPrize() (сервер) сам пишет roulette_winner — только в
            // момент реального ЗАБРАТЬ 500р, с явным JSON_UNESCAPED_UNICODE и настоящим
            // сохранённым ником игрока (не сиюминутным udata['nickname']) — см. dvor-roulette-
            // minigame.js._openJackpotChoice()'s takeBtn (applyPatch(res.patch) уже применяет
            // обновлённый roulette_winner).
            this._openJackpotChoice();
        } else if(slot.type === 'key_bundle'){
            // 29.09.2026 (СРОЧНО, по прямому указанию — репорт "выбил связку ключей, ни она не
            // появилась, ни снова прокрутить не даёт"): раньше здесь был ОТДЕЛЬНЫЙ запрос
            // TS.php('roulette.claimKeyring', {}) уже ПОСЛЕ того, как колесо остановилось —
            // лишняя сетевая точка отказа (исторически проваливалась в 13 из 14 живых попыток,
            // см. коммент у KEYRING_COOLDOWN_DAYS в roulette.php), плюс сама она была ничем не
            // защищённым эксплойтом (звалась прямо из консоли без реального выигрыша). Сервер
            // теперь выдаёт Связку ПРЯМО внутри roulette.spin() — тот же ответ, что уже применён
            // через applyPatch(res.patch) в dvor-roulette.js._spinRoulette() ДО того, как эта
            // функция вообще вызывается (см. цепочку вызовов там) — udata['keyring_owner']
            // здесь уже актуален, отдельный запрос и не нужен, и не может провалиться отдельно.
            if(window.shmot && typeof shmot._loadFromUdata === 'function') shmot._loadFromUdata();
            if(window.home && typeof home.updateClothes === 'function') home.updateClothes();
            // Раньше здесь стояло просто '' (текст очищался, никакого подтверждения игрок не
            // видел вообще — от этого и родился репорт "она не появилась", хотя сервер выдал
            // её честно). Тот же текст, что уже показывает мини-игра "Куш" на этот же исход
            // (dvor-roulette-minigame.js) — единообразно для игрока, откуда бы Связка ни пришла.
            if(this._roulResultTxt) this._roulResultTxt.text = '🗝 СВЯЗКА КЛЮЧЕЙ! Ты теперь владелец!';
        } else {
            // Валюта уже начислена сервером (roulette.spin → applyPatch в dvor-roulette.js) —
            // здесь только применяем ПОДСКАЗКИ для ещё не мигрировавших подсистем (оружие/
            // боевой пропуск), тем же приёмом, что и у зариков/покера (см. dvor-dice-game.js).
            (clientRewards || []).forEach(cr => {
                if(cr.type === 'battlepass_xp'){ if(window.battlepass) battlepass.addXp(cr.amt); }
                else if(window.weapons && (cr.type === 'auto' || cr.type === 'gun')){ weapons.grantAmmo(cr.type, cr.amt); }
            });
            iface.updateUp();
            if(this._roulResultTxt) this._roulResultTxt.text = '';
        }

        this._addExp('roulette', 1);
        // 28.09.2026 (репорт "спички рулетки выдаются вдвойне"): roulette_spichki уже начислен
        // сервером и применён через applyPatch() выше по стеку — не передаём его сюда, иначе
        // achievements.onDvorGame() прибавит его ещё раз (см. фикс в achievements.js).
        if(window.achievements) achievements.onDvorGame('roulette', {});

        this._roulSpinning = false;
        this._updateRouletteUI();

        if(this._roulAutoOn && slot.type !== 'super'){
            setTimeout(()=>{ if(this._roulWin && this._roulWin.parent) this._spinRoulette(); }, 1500);
        }
    };
}
